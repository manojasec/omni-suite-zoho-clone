import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Job, JobStatus } from "@prisma/client";

/**
 * DB-backed background job queue.
 *
 * Design goals:
 * - Zero-dep: no Redis/BullMQ. Uses the existing MySQL Prisma connection.
 * - Multi-process safe via optimistic locking on `lockedBy + lockedAt`.
 * - Idempotent enqueue via `uniqueKey`.
 * - Retry with exponential backoff up to `maxAttempts`.
 *
 * NOT designed for >100 jobs/sec. Sufficient for invoice posting, email send,
 * webhook delivery, social publish, scheduled flow steps, etc.
 */

export type JobHandlerCtx = {
  job: Job;
  workspaceId: string | null;
};

export type JobHandler<TPayload = unknown> = (
  payload: TPayload,
  ctx: JobHandlerCtx,
) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

export function registerHandler<T = unknown>(kind: string, handler: JobHandler<T>): void {
  handlers.set(kind, handler as JobHandler);
}

export function getRegisteredKinds(): string[] {
  return Array.from(handlers.keys());
}

export type EnqueueInput = {
  kind: string;
  payload: unknown;
  workspaceId?: string | null;
  runAt?: Date;
  priority?: number;
  maxAttempts?: number;
  /** Idempotency key — duplicates return the existing job */
  uniqueKey?: string;
};

export async function enqueue(input: EnqueueInput): Promise<Job> {
  const data: Prisma.JobCreateInput = {
    kind: input.kind,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    workspaceId: input.workspaceId ?? null,
    runAt: input.runAt ?? new Date(),
    priority: input.priority ?? 0,
    maxAttempts: input.maxAttempts ?? 5,
    uniqueKey: input.uniqueKey ?? null,
  };
  if (input.uniqueKey) {
    const existing = await prisma.job.findUnique({ where: { uniqueKey: input.uniqueKey } });
    if (existing) return existing;
  }
  return prisma.job.create({ data });
}

/**
 * Atomically claim the next runnable job for this worker.
 * Uses a single UPDATE so concurrent workers race-free without SKIP LOCKED.
 */
export async function claimNext(workerId: string): Promise<Job | null> {
  // Find candidate
  const candidate = await prisma.job.findFirst({
    where: { status: "QUEUED", runAt: { lte: new Date() } },
    orderBy: [{ priority: "desc" }, { runAt: "asc" }],
    select: { id: true },
  });
  if (!candidate) return null;
  // Optimistic claim
  const result = await prisma.job.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      lockedAt: new Date(),
      lockedBy: workerId,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (result.count !== 1) return null; // lost the race
  return prisma.job.findUnique({ where: { id: candidate.id } });
}

/** Compute exponential backoff (capped). */
export function nextBackoff(attempts: number): Date {
  const base = 1000; // 1s
  const cap = 5 * 60 * 1000; // 5m
  const delay = Math.min(cap, base * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delay);
}

export async function processOnce(workerId = `worker-${process.pid}`): Promise<JobStatus | "IDLE"> {
  const job = await claimNext(workerId);
  if (!job) return "IDLE";
  const handler = handlers.get(job.kind);
  if (!handler) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        lastError: `No handler registered for kind="${job.kind}"`,
      },
    });
    return "FAILED";
  }
  try {
    const result = await handler(job.payload, { job, workspaceId: job.workspaceId });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        result: (result ?? null) as Prisma.InputJsonValue,
      },
    });
    return "DONE";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (job.attempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), lastError: message },
      });
      return "FAILED";
    }
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        runAt: nextBackoff(job.attempts),
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return "QUEUED";
  }
}

/** Long-running worker loop. Call from a worker entrypoint script. */
export async function runWorker(opts: { workerId?: string; pollMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const workerId = opts.workerId ?? `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const pollMs = opts.pollMs ?? 1000;
  while (!opts.signal?.aborted) {
    const status = await processOnce(workerId);
    if (status === "IDLE") await new Promise((r) => setTimeout(r, pollMs));
  }
}

export async function cancelJob(id: string): Promise<void> {
  await prisma.job.update({ where: { id }, data: { status: "CANCELLED", finishedAt: new Date() } });
}

export async function getJob(id: string): Promise<Job | null> {
  return prisma.job.findUnique({ where: { id } });
}
