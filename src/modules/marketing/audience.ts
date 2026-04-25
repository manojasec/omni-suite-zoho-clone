import type { Prisma } from "@prisma/client";

type Filter = {
  stage?: ("LEAD" | "MQL" | "SQL" | "CUSTOMER" | "CHURNED")[];
  tag?: string[];
  hasEmail?: boolean;
};

/**
 * Compile the audience filter DSL into a Prisma `where` clause scoped to
 * a single workspace.
 */
export function compileAudienceWhere(workspaceId: string, dsl: Filter): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { workspaceId };
  if (dsl.stage && dsl.stage.length > 0) {
    where.lifecycleStage = { in: dsl.stage };
  }
  // Note: tag membership filtering is not applied at the database layer because
  // MySQL stores tags as JSON. Callers that need tag filtering should fetch the
  // candidate set and filter in-memory.
  void dsl.tag;
  if (dsl.hasEmail) {
    where.email = { not: null };
  }
  return where;
}
