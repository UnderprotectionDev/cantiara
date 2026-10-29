// biome-ignore-all lint/performance/noAwaitInLoops: The fixed target catalog is read sequentially, without concurrent scans.

import type { MutationDatabaseExecutor } from "@cantiara/api/mutation-contract-database";
import type {
  ResearchBindingPlan,
  ResearchBindingTargets,
  ResearchEvidenceBinding,
} from "@cantiara/api/research-session-bindings";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { feedback } from "@cantiara/db/schema/feedback";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { work, workKeyAllocation } from "@cantiara/db/schema/work";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createFeedbackFromResearch } from "../../feedback/server/feedback-database";

export async function researchBindingTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  target: ResearchBindingPlan["target"],
  lock: boolean,
) {
  const query = executor
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(project.id, target.projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  const [owner] = lock
    ? await query.for("update", { of: project })
    : await query;
  if (!owner || owner.project.archivedAt) {
    throw new ORPCError("NOT_FOUND", {
      message: "Target Project is unavailable.",
    });
  }
  if (target.mode === "create") {
    return { project: owner.project, label: target.title };
  }
  const table = {
    Decision: decision,
    Assumption: assumption,
    "Open Question": openQuestion,
    Feedback: feedback,
    Work: work,
    Feature: work,
  }[target.type];
  const lookup = executor
    .select()
    .from(table)
    .where(
      and(eq(table.id, target.recordId), eq(table.projectId, target.projectId)),
    );
  const [record] = lock ? await lookup.for("update") : await lookup;
  if (
    !record ||
    ("trashedAt" in record &&
      (record.trashedAt || ("archivedAt" in record && record.archivedAt))) ||
    (target.type === "Feature" &&
      (!("type" in record) || record.type !== "Feature")) ||
    (target.type === "Work" && "type" in record && record.type === "Feature") ||
    ("status" in record && record.status === "Archived")
  ) {
    throw new ORPCError("NOT_FOUND", {
      message: "Target record is unavailable.",
    });
  }
  return { project: owner.project, label: record.title };
}

export async function createResearchBindingTarget(
  executor: MutationDatabaseExecutor,
  plan: ResearchBindingPlan,
  owner: typeof project.$inferSelect,
  input: {
    recordId: string;
    committedAt: Date;
    idempotencyKey: string;
    payloadFingerprint: string;
  },
) {
  if (plan.target.mode !== "create") {
    return;
  }
  const base = {
    id: input.recordId,
    projectId: owner.id,
    title: plan.target.title,
    createdAt: input.committedAt,
    updatedAt: input.committedAt,
    revision: 1,
  };
  const { excerpt } = plan.pin;
  switch (plan.target.type) {
    case "Assumption":
      await executor
        .insert(assumption)
        .values({ ...base, statement: excerpt, life: "Open" });
      return;
    case "Open Question":
      await executor
        .insert(openQuestion)
        .values({ ...base, question: excerpt, life: "Open" });
      return;
    case "Decision":
      await executor
        .insert(decision)
        .values({ ...base, decision: excerpt, life: "Valid" });
      return;
    case "Feedback":
      await createFeedbackFromResearch(executor, {
        ...base,
        originalMessage: excerpt,
        channel: plan.fields.channel ?? null,
        occurredAt: new Date(plan.fields.occurredAt ?? input.committedAt),
        committedAt: input.committedAt,
      });
      return;
    case "Work":
    case "Feature": {
      // Same locked Project/key allocation boundary as Document → Work creation.
      const number = owner.workCount + 1;
      const key = `${owner.shortCode}-${number}`;
      await executor
        .update(project)
        .set({
          workCount: number,
          revision: owner.revision + 1,
          updatedAt: input.committedAt,
        })
        .where(eq(project.id, owner.id));
      await executor.insert(workKeyAllocation).values({
        id: crypto.randomUUID(),
        projectId: owner.id,
        clientIdempotencyKey: input.idempotencyKey,
        key,
        number,
        payloadFingerprint: input.payloadFingerprint,
        shortCode: owner.shortCode,
        workId: input.recordId,
        reservedAt: input.committedAt,
      });
      const workType =
        plan.target.type === "Feature" ? "Feature" : plan.target.workType;
      if (!workType) {
        throw new ORPCError("BAD_REQUEST");
      }
      await executor.insert(work).values({
        ...base,
        key,
        number,
        description: excerpt,
        type: workType,
        status: "Not Started",
        originOwnerRecordId: plan.pin.source.recordId,
        originComponentId: plan.pin.source.componentId,
        originSourceVersion: String(plan.pin.source.revision),
        originLocation: null,
      });
      return;
    }
    default:
      return;
  }
}

export async function listResearchBindingTargets(
  executor: MutationDatabaseExecutor,
  workspaceId: string,
): Promise<ResearchBindingTargets> {
  const projects = await executor
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(
      and(eq(project.workspaceId, workspaceId), isNull(project.archivedAt)),
    );
  const records: ResearchBindingTargets["records"] = [];
  for (const entry of [
    { type: "Assumption", table: assumption },
    { type: "Open Question", table: openQuestion },
    { type: "Decision", table: decision },
    { type: "Feedback", table: feedback },
    { type: "Work", table: work },
  ] as const) {
    if (!projects.length) {
      break;
    }
    const rows = await executor
      .select()
      .from(entry.table)
      .where(
        inArray(
          entry.table.projectId,
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
      records.push({
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        type: "type" in row && row.type === "Feature" ? "Feature" : entry.type,
      });
    }
  }
  return { projects, records };
}

/** Resolve historical ends without applying the stricter new-binding write eligibility gate. */
export async function readResearchBindingTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  target: Pick<
    ResearchEvidenceBinding["target"],
    "projectId" | "recordId" | "type"
  >,
): Promise<ResearchEvidenceBinding["target"]> {
  function broken(
    reason: NonNullable<ResearchEvidenceBinding["target"]["brokenReason"]>,
  ): ResearchEvidenceBinding["target"] {
    const canOpenSourceRecord = reason === "Archived" || reason === "In Trash";
    return {
      ...target,
      projectId: canOpenSourceRecord ? target.projectId : null,
      label: null,
      brokenReason: reason,
      canOpenSourceRecord,
    };
  }
  if (!target.projectId) {
    return broken("Permanently deleted");
  }
  const [owner] = await executor
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(project.id, target.projectId),
        eq(workspace.id, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  if (!owner) {
    return broken("No access");
  }
  const table = {
    Decision: decision,
    Assumption: assumption,
    "Open Question": openQuestion,
    Feedback: feedback,
    Work: work,
    Feature: work,
  }[target.type];
  const [record] = await executor
    .select()
    .from(table)
    .where(
      and(eq(table.id, target.recordId), eq(table.projectId, target.projectId)),
    );
  if (
    !record ||
    (target.type === "Feature" &&
      (!("type" in record) || record.type !== "Feature")) ||
    (target.type === "Work" && "type" in record && record.type === "Feature")
  ) {
    return broken("Permanently deleted");
  }
  if ("trashedAt" in record && record.trashedAt) {
    return broken("In Trash");
  }
  if (
    owner.project.archivedAt ||
    ("archivedAt" in record && record.archivedAt) ||
    ("status" in record && record.status === "Archived")
  ) {
    return broken("Archived");
  }
  return {
    ...target,
    label: record.title,
    brokenReason: null,
    canOpenSourceRecord: true,
  };
}
