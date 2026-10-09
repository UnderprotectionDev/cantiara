import type { DocumentEvidenceSelection } from "@cantiara/api/documents";
import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  assumptionRecordSchema,
  createProjectSourceRecordInputSchema,
  decisionRecordSchema,
  milestoneRecordSchema,
  openQuestionRecordSchema,
  type ProjectSourceRecord,
  ProjectSourceRecordConflictError,
  type ProjectSourceRecordsAccess,
  type ProjectSourceType,
  productionIncidentRecordSchema,
  projectReleaseRecordSchema,
  projectSourceRecordInputSchema,
  projectSourceRecordSchema,
  projectSourceRecordsProjectInputSchema,
  riskRecordSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "@cantiara/api/project-source-records";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { usageLink } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
import { and, asc, eq } from "drizzle-orm";

import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

import { createDatabaseDecisionSupersession } from "./decision-supersession-database";

type DecisionRecord = typeof decision.$inferSelect;
type MilestoneRecord = typeof projectMilestone.$inferSelect;
type ReleaseRecord = typeof projectRelease.$inferSelect;
type IncidentRecord = typeof productionIncident.$inferSelect;
type RiskRecord = typeof risk.$inferSelect;
type AssumptionRecord = typeof assumption.$inferSelect;
type OpenQuestionRecord = typeof openQuestion.$inferSelect;

type ProjectSourceMutationValue =
  | {
      decision: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      risk: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      assumption: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      openQuestion: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      milestone: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      projectRelease: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    }
  | {
      productionIncident: ProjectSourceRecord | null;
      documentEvidence?: DocumentEvidenceSelection;
    };

function assertNever(value: never): never {
  throw new Error(`Unsupported project source record: ${String(value)}`);
}

function toDecision(record: DecisionRecord) {
  return decisionRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Decision",
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function listDecisionRecords(database: Database, projectId: string) {
  const rows = await database
    .select()
    .from(decision)
    .where(eq(decision.projectId, projectId))
    .orderBy(asc(decision.createdAt), asc(decision.id));
  return rows.map(toDecision);
}

function toMilestone(record: MilestoneRecord): ProjectSourceRecord {
  return milestoneRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Milestone",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProjectRelease(record: ReleaseRecord): ProjectSourceRecord {
  return projectReleaseRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Project Release",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProductionIncident(record: IncidentRecord): ProjectSourceRecord {
  return productionIncidentRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    occurredAt: record.occurredAt.toISOString(),
    sourceType: "Production Incident",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toRisk(record: RiskRecord): ProjectSourceRecord {
  return riskRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Risk",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toAssumption(record: AssumptionRecord): ProjectSourceRecord {
  return assumptionRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Assumption",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toOpenQuestion(record: OpenQuestionRecord): ProjectSourceRecord {
  return openQuestionRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Open Question",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function targetForRecord(
  record: ProjectSourceRecord,
): MutationTarget<ProjectSourceMutationValue> {
  switch (record.sourceType) {
    case "Risk":
      return {
        id: record.id,
        revision: record.revision,
        value: { risk: record },
      };
    case "Assumption":
      return {
        id: record.id,
        revision: record.revision,
        value: { assumption: record },
      };
    case "Open Question":
      return {
        id: record.id,
        revision: record.revision,
        value: { openQuestion: record },
      };
    case "Decision":
      return {
        id: record.id,
        revision: record.revision,
        value: { decision: record },
      };
    case "Milestone":
      return {
        id: record.id,
        revision: record.revision,
        value: { milestone: record },
      };
    case "Project Release":
      return {
        id: record.id,
        revision: record.revision,
        value: { projectRelease: record },
      };
    case "Production Incident":
      return {
        id: record.id,
        revision: record.revision,
        value: { productionIncident: record },
      };
    default:
      return assertNever(record);
  }
}

function emptyTarget(
  sourceType: ProjectSourceType,
  targetId: string,
): MutationTarget<ProjectSourceMutationValue> {
  switch (sourceType) {
    case "Risk":
      return { id: targetId, revision: 0, value: { risk: null } };
    case "Assumption":
      return { id: targetId, revision: 0, value: { assumption: null } };
    case "Open Question":
      return { id: targetId, revision: 0, value: { openQuestion: null } };
    case "Decision":
      return { id: targetId, revision: 0, value: { decision: null } };
    case "Milestone":
      return { id: targetId, revision: 0, value: { milestone: null } };
    case "Project Release":
      return { id: targetId, revision: 0, value: { projectRelease: null } };
    case "Production Incident":
      return {
        id: targetId,
        revision: 0,
        value: { productionIncident: null },
      };
    default:
      return assertNever(sourceType);
  }
}

function recordFromValue(value: ProjectSourceMutationValue) {
  if ("decision" in value) {
    return value.decision;
  }
  if ("risk" in value) {
    return value.risk;
  }
  if ("assumption" in value) {
    return value.assumption;
  }
  if ("openQuestion" in value) {
    return value.openQuestion;
  }
  if ("milestone" in value) {
    return value.milestone;
  }
  if ("projectRelease" in value) {
    return value.projectRelease;
  }
  return value.productionIncident;
}

function sourceTypeFromPayload(
  payload?: MutationPayload,
): ProjectSourceType | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { sourceType } = payload as Record<string, unknown>;
  return sourceType === "Decision" ||
    sourceType === "Risk" ||
    sourceType === "Assumption" ||
    sourceType === "Open Question" ||
    sourceType === "Milestone" ||
    sourceType === "Project Release" ||
    sourceType === "Production Incident"
    ? sourceType
    : null;
}

function projectIdFromPayload(payload?: MutationPayload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { projectId } = payload as Record<string, unknown>;
  return typeof projectId === "string" ? projectId : null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const [ownedWorkspace] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  if (!ownedWorkspace) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(
      and(
        eq(project.id, projectId),
        eq(project.workspaceId, ownedWorkspace.id),
      ),
    )
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function targetFromQuery<TRecord>(
  query: PromiseLike<TRecord[]> & {
    for: (lock: "update") => PromiseLike<TRecord[]>;
  },
  lock: boolean,
  sourceType: ProjectSourceType,
  targetId: string,
  toRecord: (record: TRecord) => ProjectSourceRecord,
): Promise<MutationTarget<ProjectSourceMutationValue>> {
  const rows = lock ? await query.for("update") : await query;
  const [record] = rows;
  return record
    ? targetForRecord(toRecord(record))
    : emptyTarget(sourceType, targetId);
}

async function findMutationTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  sourceType: ProjectSourceType,
  targetId: string,
  projectId: string,
  lock: boolean,
): Promise<MutationTarget<ProjectSourceMutationValue> | null> {
  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    projectId,
    lock,
  );
  if (!ownedProject || (lock && ownedProject.archivedAt !== null)) {
    return null;
  }

  switch (sourceType) {
    case "Risk":
      return targetFromQuery(
        executor
          .select()
          .from(risk)
          .where(and(eq(risk.id, targetId), eq(risk.projectId, projectId)))
          .limit(1),
        lock,
        sourceType,
        targetId,
        toRisk,
      );
    case "Assumption":
      return targetFromQuery(
        executor
          .select()
          .from(assumption)
          .where(
            and(
              eq(assumption.id, targetId),
              eq(assumption.projectId, projectId),
            ),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toAssumption,
      );
    case "Open Question":
      return targetFromQuery(
        executor
          .select()
          .from(openQuestion)
          .where(
            and(
              eq(openQuestion.id, targetId),
              eq(openQuestion.projectId, projectId),
            ),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toOpenQuestion,
      );
    case "Decision":
      return targetFromQuery(
        executor
          .select()
          .from(decision)
          .where(
            and(eq(decision.id, targetId), eq(decision.projectId, projectId)),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toDecision,
      );
    case "Milestone":
      return targetFromQuery(
        executor
          .select()
          .from(projectMilestone)
          .where(
            and(
              eq(projectMilestone.id, targetId),
              eq(projectMilestone.projectId, projectId),
            ),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toMilestone,
      );
    case "Project Release":
      return targetFromQuery(
        executor
          .select()
          .from(projectRelease)
          .where(
            and(
              eq(projectRelease.id, targetId),
              eq(projectRelease.projectId, projectId),
            ),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toProjectRelease,
      );
    case "Production Incident":
      return targetFromQuery(
        executor
          .select()
          .from(productionIncident)
          .where(
            and(
              eq(productionIncident.id, targetId),
              eq(productionIncident.projectId, projectId),
            ),
          )
          .limit(1),
        lock,
        sourceType,
        targetId,
        toProductionIncident,
      );
    default:
      return assertNever(sourceType);
  }
}

interface WriteSourceRecordInput {
  committedAt: Date;
  executor: MutationDatabaseExecutor;
  expectedRevision: number;
  record: ProjectSourceRecord;
  targetId: string;
}

async function writeRiskRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Risk" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    description: record.description,
    impact: record.impact,
    life: record.life,
    probability: record.probability,
    projectId: record.projectId,
    rationale: record.rationale,
    response: record.response,
    revision: expectedRevision + 1,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(risk)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: risk.id })
      .returning();
    return inserted ? targetForRecord(toRisk(inserted)) : null;
  }
  const [updated] = await executor
    .update(risk)
    .set(values)
    .where(
      and(
        eq(risk.id, targetId),
        eq(risk.projectId, record.projectId),
        eq(risk.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toRisk(updated)) : null;
}

async function writeAssumptionRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Assumption" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    life: record.life,
    projectId: record.projectId,
    rationale: record.rationale,
    revision: expectedRevision + 1,
    statement: record.statement,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(assumption)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: assumption.id })
      .returning();
    return inserted ? targetForRecord(toAssumption(inserted)) : null;
  }
  const [updated] = await executor
    .update(assumption)
    .set(values)
    .where(
      and(
        eq(assumption.id, targetId),
        eq(assumption.projectId, record.projectId),
        eq(assumption.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toAssumption(updated)) : null;
}

async function writeOpenQuestionRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Open Question" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    context: record.context,
    life: record.life,
    projectId: record.projectId,
    question: record.question,
    revision: expectedRevision + 1,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(openQuestion)
      .values({
        ...values,
        answer: record.answer,
        createdAt: committedAt,
        id: record.id,
      })
      .onConflictDoNothing({ target: openQuestion.id })
      .returning();
    return inserted ? targetForRecord(toOpenQuestion(inserted)) : null;
  }
  const [updated] = await executor
    .update(openQuestion)
    .set({ ...values, answer: record.answer })
    .where(
      and(
        eq(openQuestion.id, targetId),
        eq(openQuestion.projectId, record.projectId),
        eq(openQuestion.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toOpenQuestion(updated)) : null;
}

async function writeDecisionRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Decision" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    decision: record.decision,
    life: record.life,
    withdrawnAt: record.withdrawnAt ? new Date(record.withdrawnAt) : null,
    withdrawalRationale: record.withdrawalRationale ?? null,
    projectId: record.projectId,
    rationale: record.rationale,
    revision: expectedRevision + 1,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(decision)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: decision.id })
      .returning();
    return inserted ? targetForRecord(toDecision(inserted)) : null;
  }
  const [updated] = await executor
    .update(decision)
    .set(values)
    .where(
      and(
        eq(decision.id, targetId),
        eq(decision.projectId, record.projectId),
        eq(decision.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toDecision(updated)) : null;
}

async function writeMilestoneRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Milestone" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    description: record.description,
    projectId: record.projectId,
    revision: expectedRevision + 1,
    status: record.status,
    targetDate: record.targetDate,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(projectMilestone)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: projectMilestone.id })
      .returning();
    return inserted ? targetForRecord(toMilestone(inserted)) : null;
  }
  const [updated] = await executor
    .update(projectMilestone)
    .set(values)
    .where(
      and(
        eq(projectMilestone.id, targetId),
        eq(projectMilestone.projectId, record.projectId),
        eq(projectMilestone.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toMilestone(updated)) : null;
}

async function writeProjectReleaseRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Project Release" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    description: record.description,
    name: record.name,
    projectId: record.projectId,
    revision: expectedRevision + 1,
    status: record.status,
    updatedAt: committedAt,
    versionLabel: record.versionLabel,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(projectRelease)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: projectRelease.id })
      .returning();
    return inserted ? targetForRecord(toProjectRelease(inserted)) : null;
  }
  const [updated] = await executor
    .update(projectRelease)
    .set(values)
    .where(
      and(
        eq(projectRelease.id, targetId),
        eq(projectRelease.projectId, record.projectId),
        eq(projectRelease.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toProjectRelease(updated)) : null;
}

async function writeProductionIncidentRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Production Incident" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    detectedHow: record.detectedHow,
    impact: record.impact,
    learning: record.learning,
    occurredAt: new Date(record.occurredAt),
    projectId: record.projectId,
    resolution: record.resolution,
    revision: expectedRevision + 1,
    rootCause: record.rootCause,
    status: record.status,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(productionIncident)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: productionIncident.id })
      .returning();
    return inserted ? targetForRecord(toProductionIncident(inserted)) : null;
  }
  const [updated] = await executor
    .update(productionIncident)
    .set(values)
    .where(
      and(
        eq(productionIncident.id, targetId),
        eq(productionIncident.projectId, record.projectId),
        eq(productionIncident.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toProductionIncident(updated)) : null;
}

function writeProjectSourceRecord(input: WriteSourceRecordInput) {
  switch (input.record.sourceType) {
    case "Risk":
      return writeRiskRecord({ ...input, record: input.record });
    case "Assumption":
      return writeAssumptionRecord({ ...input, record: input.record });
    case "Open Question":
      return writeOpenQuestionRecord({ ...input, record: input.record });
    case "Decision":
      return writeDecisionRecord({ ...input, record: input.record });
    case "Milestone":
      return writeMilestoneRecord({ ...input, record: input.record });
    case "Project Release":
      return writeProjectReleaseRecord({ ...input, record: input.record });
    case "Production Incident":
      return writeProductionIncidentRecord({ ...input, record: input.record });
    default:
      return assertNever(input.record);
  }
}

function projectSourceMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<ProjectSourceMutationValue> {
  return {
    committedValue(target) {
      return target.value;
    },

    find(executor, targetId, lock, context) {
      const sourceType = sourceTypeFromPayload(context?.payload);
      const projectId = projectIdFromPayload(context?.payload);
      if (!(sourceType && projectId)) {
        return Promise.resolve(null);
      }
      return findMutationTarget(
        executor,
        accountId,
        sourceType,
        targetId,
        projectId,
        lock,
      );
    },

    async update(executor, input) {
      const record = recordFromValue(input.nextValue);
      if (!record || record.id !== input.targetId) {
        return null;
      }
      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        record.projectId,
        true,
      );
      if (!ownedProject || ownedProject.archivedAt !== null) {
        return null;
      }
      const evidence = input.nextValue.documentEvidence;
      if (evidence) {
        const [sourceDocument] = await executor
          .select({
            body: document.body,
            projectId: document.projectId,
            revision: document.revision,
          })
          .from(document)
          .innerJoin(project, eq(document.projectId, project.id))
          .innerJoin(workspace, eq(project.workspaceId, workspace.id))
          .where(
            and(
              eq(document.id, evidence.documentId),
              eq(document.projectId, record.projectId),
              eq(workspace.ownerAccountId, accountId),
            ),
          )
          .for("update")
          .limit(1);
        if (
          !sourceDocument ||
          sourceDocument.revision !== evidence.documentRevision ||
          sourceDocument.body.slice(
            evidence.selectionStart,
            evidence.selectionEnd,
          ) !== evidence.selectedText
        ) {
          throw new MutationConflictError(input.targetId);
        }
      }
      const written = await writeProjectSourceRecord({
        committedAt: input.committedAt,
        expectedRevision: input.expectedRevision,
        executor,
        record,
        targetId: input.targetId,
      });
      if (written && evidence) {
        await executor.insert(usageLink).values({
          id: crypto.randomUUID(),
          kind: "Pinned bind",
          location: {
            documentVersion: {
              documentId: evidence.documentId,
              revision: evidence.documentRevision,
            },
            end: evidence.selectionEnd,
            excerpt: evidence.selectedText,
            start: evidence.selectionStart,
          },
          revision: 1,
          sourceRecordId: evidence.documentId,
          sourceRecordType: "Document",
          surfaceRecordId: record.id,
          surfaceRecordType: record.sourceType,
          workspaceId: ownedProject.workspaceId,
        });
        return {
          ...written,
          value: { ...written.value, documentEvidence: evidence },
        };
      }
      return written;
    },
  };
}

function requireMutationContract(database: Database, accountId: string) {
  return createDatabaseMutationContract<ProjectSourceMutationValue>(database, {
    target: projectSourceMutationTarget(accountId),
  });
}

function recordFromReceipt(value: ProjectSourceMutationValue) {
  return recordFromValue(value);
}

function currentRecord(value: ProjectSourceMutationValue) {
  return recordFromValue(value);
}

function statusOf(record: ProjectSourceRecord) {
  return "life" in record ? record.life : record.status;
}

function allowsTransition(
  record: ProjectSourceRecord,
  next: ProjectSourceRecord,
) {
  const previousStatus = statusOf(record);
  const nextStatus = statusOf(next);
  if (previousStatus === nextStatus) {
    return false;
  }
  if (record.sourceType === "Decision") {
    return record.life === "Valid" && next.sourceType === "Decision";
  }
  if (record.sourceType === "Milestone") {
    return record.status === "Planned" && next.sourceType === "Milestone";
  }
  if (record.sourceType === "Project Release") {
    return (
      (record.status === "Draft" || record.status === "Preparing") &&
      next.sourceType === "Project Release"
    );
  }
  if (record.sourceType === "Production Incident") {
    return next.sourceType === "Production Incident";
  }
  return false;
}

export function createDatabaseProjectSourceRecords(
  database: Database,
): ProjectSourceRecordsAccess & {
  supersession: ReturnType<typeof createDatabaseDecisionSupersession>;
} {
  return {
    supersession: createDatabaseDecisionSupersession(database),
    async listDecisions(accountId, projectId) {
      const input = projectSourceRecordsProjectInputSchema.parse({ projectId });
      const ownedProject = await findOwnedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!ownedProject) {
        return null;
      }
      return {
        records: await listDecisionRecords(database, input.projectId),
        readOnly: ownedProject.archivedAt !== null,
      };
    },
    async create(accountId, rawInput) {
      const input = createProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "create", ...fields },
            targetId: input.id,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            if (currentRecord(currentValue)) {
              throw new MutationConflictError(input.id);
            }
            let initialValue: object;
            let documentEvidence: DocumentEvidenceSelection | undefined;
            switch (fields.sourceType) {
              case "Decision": {
                const { documentEvidence: evidence, ...decisionFields } =
                  fields;
                documentEvidence = evidence;
                initialValue = { ...decisionFields, life: "Valid" };
                break;
              }
              case "Risk": {
                const { documentEvidence: evidence, ...riskFields } = fields;
                documentEvidence = evidence;
                initialValue = { ...riskFields, life: "Open" };
                break;
              }
              case "Assumption": {
                const { documentEvidence: evidence, ...assumptionFields } =
                  fields;
                documentEvidence = evidence;
                initialValue = { ...assumptionFields, life: "Open" };
                break;
              }
              case "Open Question": {
                const { documentEvidence: evidence, ...questionFields } =
                  fields;
                documentEvidence = evidence;
                initialValue = {
                  ...questionFields,
                  answer: null,
                  life: "Open",
                };
                break;
              }
              case "Milestone":
                initialValue = { ...fields, status: "Planned" };
                break;
              case "Project Release":
                initialValue = { ...fields, status: "Draft" };
                break;
              case "Production Incident":
                initialValue = { ...fields, status: "Open" };
                break;
              default:
                assertNever(fields);
            }
            const record = projectSourceRecordSchema.parse({
              ...initialValue,
              createdAt: committedAt,
              revision: currentRevision + 1,
              updatedAt: committedAt,
            });
            return {
              ...targetForRecord(record).value,
              ...(documentEvidence ? { documentEvidence } : {}),
            };
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.id, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async update(accountId, rawInput) {
      const input = updateProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "update", ...fields },
            targetId: input.sourceId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentRecord(currentValue);
            if (
              !current ||
              current.projectId !== input.projectId ||
              current.sourceType !== input.sourceType
            ) {
              throw new MutationConflictError(input.sourceId);
            }
            if (
              current.sourceType === "Decision" &&
              current.life === "Superseded"
            ) {
              throw new MutationConflictError(input.sourceId);
            }
            let record: ProjectSourceRecord;
            switch (input.sourceType) {
              case "Decision":
                record = decisionRecordSchema.parse({
                  ...current,
                  decision: input.decision,
                  id: input.sourceId,
                  rationale: input.rationale,
                  revision: currentRevision + 1,
                  sourceType: "Decision",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Risk":
                record = riskRecordSchema.parse({
                  ...current,
                  description: input.description,
                  id: input.sourceId,
                  impact: input.impact,
                  probability: input.probability,
                  rationale: input.rationale,
                  response: input.response,
                  revision: currentRevision + 1,
                  sourceType: "Risk",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Assumption":
                record = assumptionRecordSchema.parse({
                  ...current,
                  id: input.sourceId,
                  rationale: input.rationale,
                  revision: currentRevision + 1,
                  sourceType: "Assumption",
                  statement: input.statement,
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Open Question":
                record = openQuestionRecordSchema.parse({
                  ...current,
                  answer: input.answer,
                  context: input.context,
                  id: input.sourceId,
                  question: input.question,
                  revision: currentRevision + 1,
                  sourceType: "Open Question",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Milestone":
                record = milestoneRecordSchema.parse({
                  ...current,
                  description: input.description,
                  id: input.sourceId,
                  revision: currentRevision + 1,
                  sourceType: "Milestone",
                  targetDate: input.targetDate,
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Project Release":
                record = projectReleaseRecordSchema.parse({
                  ...current,
                  description: input.description,
                  id: input.sourceId,
                  name: input.name,
                  revision: currentRevision + 1,
                  sourceType: "Project Release",
                  updatedAt: committedAt,
                  versionLabel: input.versionLabel,
                });
                break;
              case "Production Incident":
                record = productionIncidentRecordSchema.parse({
                  ...current,
                  detectedHow: input.detectedHow,
                  id: input.sourceId,
                  impact: input.impact,
                  learning: input.learning,
                  occurredAt: input.occurredAt,
                  resolution: input.resolution,
                  revision: currentRevision + 1,
                  rootCause: input.rootCause,
                  sourceType: "Production Incident",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              default:
                assertNever(input);
            }
            return targetForRecord(record).value;
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.sourceId, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async transition(accountId, rawInput) {
      const input = transitionProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "transition", ...fields },
            targetId: input.sourceId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentRecord(currentValue);
            if (
              !current ||
              current.projectId !== input.projectId ||
              current.sourceType !== input.sourceType
            ) {
              throw new MutationConflictError(input.sourceId);
            }
            const record = projectSourceRecordSchema.parse(
              input.sourceType === "Decision"
                ? {
                    ...current,
                    life: input.life,
                    withdrawnAt:
                      input.life === "Withdrawn" ? committedAt : null,
                    withdrawalRationale:
                      input.life === "Withdrawn"
                        ? (input.rationale ?? null)
                        : null,
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  }
                : {
                    ...current,
                    revision: currentRevision + 1,
                    status: input.status,
                    updatedAt: committedAt,
                  },
            );
            if (!allowsTransition(current, record)) {
              throw new MutationConflictError(input.sourceId);
            }
            return targetForRecord(record).value;
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.sourceId, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async find(accountId, sourceType, sourceId) {
      const identity = projectSourceRecordInputSchema.parse({
        sourceId,
        sourceType,
      });
      const record = await readRecord(
        database,
        accountId,
        identity.sourceType,
        identity.sourceId,
      );
      return record;
    },

    async list(accountId, projectId) {
      const input = projectSourceRecordsProjectInputSchema.parse({ projectId });
      const ownedProject = await findOwnedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!ownedProject) {
        return null;
      }
      const [
        decisions,
        risks,
        assumptions,
        openQuestions,
        milestones,
        releases,
        incidents,
      ] = await Promise.all([
        listDecisionRecords(database, input.projectId),
        database
          .select()
          .from(risk)
          .where(eq(risk.projectId, input.projectId))
          .orderBy(asc(risk.createdAt), asc(risk.id)),
        database
          .select()
          .from(assumption)
          .where(eq(assumption.projectId, input.projectId))
          .orderBy(asc(assumption.createdAt), asc(assumption.id)),
        database
          .select()
          .from(openQuestion)
          .where(eq(openQuestion.projectId, input.projectId))
          .orderBy(asc(openQuestion.createdAt), asc(openQuestion.id)),
        database
          .select()
          .from(projectMilestone)
          .where(eq(projectMilestone.projectId, input.projectId))
          .orderBy(asc(projectMilestone.createdAt), asc(projectMilestone.id)),
        database
          .select()
          .from(projectRelease)
          .where(eq(projectRelease.projectId, input.projectId))
          .orderBy(asc(projectRelease.createdAt), asc(projectRelease.id)),
        database
          .select()
          .from(productionIncident)
          .where(eq(productionIncident.projectId, input.projectId))
          .orderBy(
            asc(productionIncident.createdAt),
            asc(productionIncident.id),
          ),
      ]);
      return [
        ...decisions,
        ...risks.map(toRisk),
        ...assumptions.map(toAssumption),
        ...openQuestions.map(toOpenQuestion),
        ...milestones.map(toMilestone),
        ...releases.map(toProjectRelease),
        ...incidents.map(toProductionIncident),
      ].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.sourceType.localeCompare(right.sourceType) ||
          left.id.localeCompare(right.id),
      );
    },
  };
}

async function readRecord(
  database: Database,
  accountId: string,
  sourceType: ProjectSourceType,
  sourceId: string,
): Promise<ProjectSourceRecord | null> {
  let record: ProjectSourceRecord | null = null;
  switch (sourceType) {
    case "Risk": {
      const [row] = await database
        .select()
        .from(risk)
        .where(eq(risk.id, sourceId))
        .limit(1);
      record = row ? toRisk(row) : null;
      break;
    }
    case "Assumption": {
      const [row] = await database
        .select()
        .from(assumption)
        .where(eq(assumption.id, sourceId))
        .limit(1);
      record = row ? toAssumption(row) : null;
      break;
    }
    case "Open Question": {
      const [row] = await database
        .select()
        .from(openQuestion)
        .where(eq(openQuestion.id, sourceId))
        .limit(1);
      record = row ? toOpenQuestion(row) : null;
      break;
    }
    case "Decision": {
      const [row] = await database
        .select()
        .from(decision)
        .where(eq(decision.id, sourceId))
        .limit(1);
      record = row ? toDecision(row) : null;
      break;
    }
    case "Milestone": {
      const [row] = await database
        .select()
        .from(projectMilestone)
        .where(eq(projectMilestone.id, sourceId))
        .limit(1);
      record = row ? toMilestone(row) : null;
      break;
    }
    case "Project Release": {
      const [row] = await database
        .select()
        .from(projectRelease)
        .where(eq(projectRelease.id, sourceId))
        .limit(1);
      record = row ? toProjectRelease(row) : null;
      break;
    }
    case "Production Incident": {
      const [row] = await database
        .select()
        .from(productionIncident)
        .where(eq(productionIncident.id, sourceId))
        .limit(1);
      record = row ? toProductionIncident(row) : null;
      break;
    }
    default:
      return assertNever(sourceType);
  }
  if (!record) {
    return null;
  }
  const ownedProject = await findOwnedProject(
    database,
    accountId,
    record.projectId,
    false,
  );
  return ownedProject ? record : null;
}
