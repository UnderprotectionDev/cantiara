// biome-ignore-all lint/performance/noAwaitInLoops: the final set is written in file order inside one transaction.
import type { ImportCatalogType } from "@cantiara/api/data-import";
import type { MutationDatabaseExecutor } from "@cantiara/api/mutation-contract-database";
import { workspace } from "@cantiara/db/schema/auth";
import { dataImportOrigin } from "@cantiara/db/schema/data-import";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { work, workKeyAllocation } from "@cantiara/db/schema/work";
import { and, eq, sql } from "drizzle-orm";

import type {
  ImportFinalSet,
  ImportWritePlan,
  ImportWriteRecord,
} from "./data-import-apply";

const WORK_TYPES: readonly ImportCatalogType[] = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
];
const WORK_STATUSES = ["Not Started", "In Progress", "Blocked"];
const WORK_FIELDS_WRITTEN = new Set([
  "title",
  "description",
  "status",
  "dueDate",
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TITLE_LIMIT = 255;

/**
 * What this deployment can write in one transaction today: Documents (Markdown
 * and Document JSON) and the five Work types, with title, description, status
 * and due date. Every other catalog type, and Work priority and labels, is
 * refused before the commit barrier with the reason, never written partly.
 */
export function unavailableImportWrite(final: ImportFinalSet) {
  if (final.family === "Document") {
    const tooLong = [...final.creates, ...final.updates].find(
      (row) => (row.values.title ?? "").length > TITLE_LIMIT,
    );
    return tooLong
      ? `Row ${tooLong.rowNumber}: the Document title is longer than ${TITLE_LIMIT} characters.`
      : null;
  }
  const type = final.catalogType;
  if (!(type && WORK_TYPES.includes(type))) {
    return `Applying ${type ?? "this file"} is not available yet. Nothing was written.`;
  }
  const unwritten = final.mappedFields.filter(
    (field) => !WORK_FIELDS_WRITTEN.has(field),
  );
  if (unwritten.length > 0) {
    return `Applying ${unwritten.join(", ")} for Work is not available yet. Skip those columns and preview again. Nothing was written.`;
  }
  for (const row of [...final.creates, ...final.updates]) {
    const { dueDate, status } = row.values;
    if (status !== undefined && !WORK_STATUSES.includes(status)) {
      return `Row ${row.rowNumber}: status "${status}" is not Not Started, In Progress or Blocked.`;
    }
    if (dueDate !== undefined && !DATE_PATTERN.test(dueDate)) {
      return `Row ${row.rowNumber}: due date "${dueDate}" is not YYYY-MM-DD.`;
    }
  }
  return null;
}

async function lockProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
) {
  const [row] = await executor
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1)
    .for("update", { of: project });
  if (row?.project.status !== "Active" || row.project.archivedAt) {
    throw new Error("The Project is not open for import.");
  }
  return row.project;
}

async function writeDocuments(
  executor: MutationDatabaseExecutor,
  plan: ImportWritePlan,
  committedAt: Date,
) {
  let projectId: string | null = null;
  let workspaceId: string | null = null;
  if (plan.scope.kind === "project") {
    projectId = (
      await lockProject(executor, plan.accountId, plan.scope.projectId)
    ).id;
  } else if (plan.scope.kind === "wiki") {
    const [owned] = await executor
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, plan.accountId))
      .limit(1);
    workspaceId = owned?.id ?? null;
  }
  if (!(projectId || workspaceId)) {
    throw new Error("The Document scope was not found.");
  }
  for (const record of plan.updates) {
    const updated = await executor
      .update(document)
      .set({
        ...(record.values.body === undefined
          ? {}
          : { body: record.values.body }),
        ...(record.values.title === undefined
          ? {}
          : { title: record.values.title }),
        revision: sql`${document.revision} + 1`,
        updatedAt: committedAt,
      })
      .where(
        and(
          eq(document.id, record.recordId),
          projectId
            ? eq(document.projectId, projectId)
            : eq(document.workspaceId, workspaceId as string),
        ),
      )
      .returning({ id: document.id });
    if (updated.length !== 1) {
      throw new Error("A Document to update was not found in this scope.");
    }
  }
  for (const record of plan.creates) {
    await executor.insert(document).values({
      body: record.values.body ?? "",
      createdAt: committedAt,
      id: record.id,
      projectId,
      revision: 1,
      title: record.values.title ?? "",
      type: "General",
      updatedAt: committedAt,
      workspaceId,
    });
  }
}

async function writeWork(
  executor: MutationDatabaseExecutor,
  plan: ImportWritePlan,
  committedAt: Date,
) {
  if (plan.scope.kind !== "project") {
    throw new Error("Work is imported into a Project.");
  }
  const owner = await lockProject(
    executor,
    plan.accountId,
    plan.scope.projectId,
  );
  let count = owner.workCount;
  for (const record of plan.updates) {
    const { description, dueDate, status, title } = record.values;
    const updated = await executor
      .update(work)
      .set({
        ...(description === undefined ? {} : { description }),
        ...(dueDate === undefined ? {} : { targetDate: dueDate }),
        ...(status === undefined
          ? {}
          : { status, statusChangedAt: committedAt }),
        ...(title === undefined ? {} : { title }),
        revision: sql`${work.revision} + 1`,
        updatedAt: committedAt,
      })
      .where(and(eq(work.id, record.recordId), eq(work.projectId, owner.id)))
      .returning({ id: work.id });
    if (updated.length !== 1) {
      throw new Error("A Work to update was not found in this Project.");
    }
  }
  for (const record of plan.creates) {
    count += 1;
    const key = `${owner.shortCode}-${count}`;
    await executor.insert(workKeyAllocation).values({
      clientIdempotencyKey: `data-import:${plan.idempotencyKey}:${record.id}`,
      id: crypto.randomUUID(),
      key,
      number: count,
      projectId: owner.id,
      reservedAt: committedAt,
      shortCode: owner.shortCode,
      workId: record.id,
    });
    await executor.insert(work).values({
      createdAt: committedAt,
      description: record.values.description ?? null,
      id: record.id,
      key,
      number: count,
      projectId: owner.id,
      revision: 1,
      status: record.values.status ?? "Not Started",
      statusChangedAt: committedAt,
      targetDate: record.values.dueDate ?? null,
      title: record.values.title ?? "",
      type: record.recordType,
      updatedAt: committedAt,
    });
  }
  if (plan.creates.length > 0) {
    await executor
      .update(project)
      .set({
        revision: owner.revision + 1,
        updatedAt: committedAt,
        workCount: count,
      })
      .where(eq(project.id, owner.id));
  }
}

/** How an origin names its scope: a Project id, or `wiki` / `workspace`. */
export function importScopeColumns(scope: ImportWritePlan["scope"]) {
  return scope.kind === "project"
    ? { scopeId: scope.projectId, scopeKind: "project" }
    : { scopeId: scope.kind, scopeKind: scope.kind };
}

async function writeOrigins(
  executor: MutationDatabaseExecutor,
  plan: ImportWritePlan,
  committedAt: Date,
) {
  const { provenance } = plan;
  if (!provenance) {
    return;
  }
  const keyed = plan.creates.filter(
    (record): record is ImportWriteRecord & { originKey: string } =>
      record.originKey !== null,
  );
  for (const record of keyed) {
    await executor.insert(dataImportOrigin).values({
      accountId: plan.accountId,
      createdAt: committedAt,
      id: crypto.randomUUID(),
      originKey: record.originKey,
      provenance,
      receiptKey: plan.idempotencyKey,
      recordId: record.id,
      recordType: record.recordType,
      ...importScopeColumns(plan.scope),
    });
  }
}

/**
 * The commit barrier's write: every record and the origin it came from, inside
 * the Mutation Contract finalize transaction. Any throw rolls all of it back.
 */
export async function writeImportPlan(
  executor: MutationDatabaseExecutor,
  plan: ImportWritePlan,
  committedAt: Date,
) {
  if (plan.family === "Document") {
    await writeDocuments(executor, plan, committedAt);
  } else {
    await writeWork(executor, plan, committedAt);
  }
  await writeOrigins(executor, plan, committedAt);
}
