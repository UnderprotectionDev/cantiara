import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { feedback } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

/** Minimal existing-source intake; access and atomic finalization belong to the caller. */
export async function createFeedbackFromResearch(
  executor: MutationDatabaseExecutor,
  input: {
    id: string;
    projectId: string;
    title: string;
    originalMessage: string;
    channel: string | null;
    occurredAt: Date;
    committedAt: Date;
  },
) {
  await executor.insert(feedback).values({
    ...input,
    createdAt: input.committedAt,
    updatedAt: input.committedAt,
    status: "New",
    revision: 1,
  });
}

/** Owner-scoped original-message reader for existing-source intake consumers. */
export async function listFeedbackRecords(
  database: Database,
  accountId: string,
  projectId: string,
) {
  const rows = await database
    .select({ record: feedback })
    .from(feedback)
    .innerJoin(project, eq(project.id, feedback.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  return rows.map(({ record }) => ({
    ...record,
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}
