// biome-ignore-all lint/performance/noAwaitInLoops: Closed target catalog, read sequentially.

import type { MutationDatabaseExecutor } from "@cantiara/api/mutation-contract-database";
import type { SourceEvidenceTarget } from "@cantiara/api/source-evidence";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { feedback } from "@cantiara/db/schema/feedback";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, isNull } from "drizzle-orm";

const targets = {
  Work: work,
  Decision: decision,
  Feedback: feedback,
  Risk: risk,
  Assumption: assumption,
  "Open Question": openQuestion,
};

export async function evidenceProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  const [owner] = lock
    ? await query.for("update", { of: project })
    : await query;
  return owner?.project ?? null;
}

export async function evidenceTarget(
  executor: MutationDatabaseExecutor,
  target: SourceEvidenceTarget,
  lock: boolean,
) {
  const table = targets[target.type];
  const query = executor
    .select()
    .from(table)
    .where(
      and(eq(table.id, target.recordId), eq(table.projectId, target.projectId)),
    );
  const [row] = lock ? await query.for("update") : await query;
  if (!row || ("trashedAt" in row && row.trashedAt)) {
    return null;
  }
  return {
    title: row.title,
    readOnly: Boolean(
      ("archivedAt" in row && row.archivedAt) ||
        ("status" in row && row.status === "Archived"),
    ),
  };
}

export async function listEvidenceTargets(
  executor: MutationDatabaseExecutor,
  workspaceId: string,
) {
  const projects = await executor
    .select({ id: project.id })
    .from(project)
    .where(
      and(eq(project.workspaceId, workspaceId), isNull(project.archivedAt)),
    );
  const result: Array<SourceEvidenceTarget & { title: string }> = [];
  if (!projects.length) {
    return result;
  }
  for (const type of Object.keys(targets) as SourceEvidenceTarget["type"][]) {
    const table = targets[type];
    const rows = await executor
      .select()
      .from(table)
      .where(
        inArray(
          table.projectId,
          projects.map((item) => item.id),
        ),
      );
    for (const row of rows) {
      if (
        ("trashedAt" in row &&
          (row.trashedAt || ("archivedAt" in row && row.archivedAt))) ||
        ("status" in row && row.status === "Archived")
      ) {
        continue;
      }
      result.push({
        type,
        projectId: row.projectId,
        recordId: row.id,
        title: row.title,
      });
    }
  }
  return result;
}
