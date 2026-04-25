import { prisma } from "@/lib/prisma";
import { addTagToList, computeNextRunAt } from "./schemas";

export interface ProcessResult {
  processed: number;
  advanced: number;
  completed: number;
  errors: number;
  emails: number;
  tags: number;
}

/**
 * Advance all due enrollments for a workspace by exactly one step each.
 *
 * Designed to be invoked from a server action (manual "Run now") or a cron job.
 * Email "sending" is simulated — in production this would integrate with the
 * mail module added in Module 9.
 */
export async function processDueEnrollments(workspaceId: string, now = new Date()): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    advanced: 0,
    completed: 0,
    errors: 0,
    emails: 0,
    tags: 0,
  };

  const due = await prisma.workflowEnrollment.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      nextRunAt: { lte: now },
      workflow: { status: "ACTIVE" },
    },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
    },
    take: 200,
  });

  for (const e of due) {
    result.processed++;
    const step = e.workflow.steps[e.currentStep];

    if (!step) {
      // No more steps — complete enrollment.
      await prisma.workflowEnrollment.update({
        where: { id: e.id },
        data: { status: "COMPLETED", completedAt: now },
      });
      result.completed++;
      continue;
    }

    try {
      if (step.type === "SEND_EMAIL") {
        // Simulated send — log via audit-style activity on the contact.
        const contact = await prisma.contact.findFirst({
          where: { id: e.contactId, workspaceId },
          select: { id: true, email: true },
        });
        if (contact?.email) {
          await prisma.activity.create({
            data: {
              workspaceId,
              contactId: contact.id,
              type: "EMAIL",
              subject: step.emailSubject ?? "(no subject)",
              body: `[Workflow ${e.workflow.name}] sent email to ${contact.email}`,
            },
          });
          result.emails++;
        }
      } else if (step.type === "ADD_TAG" && step.tag) {
        const contact = await prisma.contact.findFirst({
          where: { id: e.contactId, workspaceId },
          select: { tags: true },
        });
        if (contact) {
          const next = addTagToList(contact.tags, step.tag);
          if (next) {
            await prisma.contact.update({
              where: { id: e.contactId },
              data: { tags: next },
            });
            result.tags++;
          }
        }
      }
      // WAIT_DAYS is implicit — just advance.

      const nextStepIndex = e.currentStep + 1;
      const nextStep = e.workflow.steps[nextStepIndex];
      const isDone = !nextStep;

      await prisma.workflowEnrollment.update({
        where: { id: e.id },
        data: isDone
          ? { status: "COMPLETED", completedAt: now, currentStep: nextStepIndex, lastError: null }
          : {
              currentStep: nextStepIndex,
              nextRunAt: computeNextRunAt(nextStep.type, nextStep.waitDays, now),
              lastError: null,
            },
      });

      if (isDone) result.completed++;
      else result.advanced++;
    } catch (err) {
      result.errors++;
      await prisma.workflowEnrollment.update({
        where: { id: e.id },
        data: { lastError: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return result;
}
