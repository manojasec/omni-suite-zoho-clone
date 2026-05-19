/**
 * Background job queue (DB-backed, zero external deps).
 *
 * Usage:
 *   import { enqueue, registerHandler } from "@/platform/jobs";
 *
 *   registerHandler<{ to: string; subject: string }>("email.send", async (p) => {
 *     await sendMail(p.to, p.subject);
 *   });
 *
 *   await enqueue({ kind: "email.send", payload: { to: "x@y", subject: "Hi" } });
 */
export {
  enqueue,
  registerHandler,
  getRegisteredKinds,
  processOnce,
  claimNext,
  runWorker,
  cancelJob,
  getJob,
  nextBackoff,
} from "./queue";

export type { JobHandler, JobHandlerCtx, EnqueueInput } from "./queue";
