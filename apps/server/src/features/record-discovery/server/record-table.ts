import { createHash } from "node:crypto";
import type { ProjectShellAccess } from "@cantiara/api/project-shell";
import {
  assumptionRecordSchema,
  decisionRecordSchema,
  milestoneRecordSchema,
  openQuestionRecordSchema,
  type ProjectSourceRecord,
  type ProjectSourceRecordsAccess,
  productionIncidentRecordSchema,
  projectReleaseRecordSchema,
  riskRecordSchema,
} from "@cantiara/api/project-source-records";
import {
  type RecordTableAccess,
  type RecordTableCellUpdateInput,
  type RecordTableInput,
  type RecordTablePasteInput,
  type RecordTableRecord,
  recordTableDecisionLifeSchema,
} from "@cantiara/api/record-discovery";
import {
  type WorkLifecycleAccess,
  workDescriptionSchema,
  workEffortSchema,
  workOpenStatusSchema,
  workPlannedStartDateSchema,
  workTargetDateSchema,
  workTitleSchema,
} from "@cantiara/api/work-lifecycle";
import { ORPCError } from "@orpc/server";

type RecordTableSourceType = Exclude<RecordTableInput["recordType"], "Work">;
type RecordTablePasteRow = RecordTablePasteInput["rows"][number];
type RecordTableCreatePasteRow = Extract<
  RecordTablePasteRow,
  { kind: "create" }
>;
type RecordTableUpdatePasteRow = Extract<
  RecordTablePasteRow,
  { kind: "update" }
>;

export interface RecordTableWriteOwners {
  projectSourceRecords: Pick<
    ProjectSourceRecordsAccess,
    "create" | "find" | "transition" | "update"
  >;
  workLifecycle: Pick<WorkLifecycleAccess, "create" | "find" | "updateFields">;
}

type RecordTableWriteTransaction = (
  run: (owners: RecordTableWriteOwners) => Promise<RecordTableRecord[]>,
) => Promise<RecordTableRecord[]>;

function recordNotFound(): never {
  throw new ORPCError("NOT_FOUND", { message: "Record not found." });
}

function requireProjectSourceRecord(
  record: ProjectSourceRecord | null,
): ProjectSourceRecord {
  if (!record) {
    return recordNotFound();
  }
  return record;
}

function tableFieldValue<T>(
  currentValue: T,
  field: string,
  fields: Record<string, unknown>,
  parse: (value: unknown) => T,
) {
  return Object.hasOwn(fields, field) ? parse(fields[field]) : currentValue;
}

function tableUpdateFields(
  record: ProjectSourceRecord,
  fields: Record<string, unknown>,
  identity: {
    baseRevision: number;
    clientIdempotencyKey: string;
    projectId: string;
    sourceId: string;
  },
) {
  switch (record.sourceType) {
    case "Decision":
      return {
        ...identity,
        decision: tableFieldValue(
          record.decision,
          "decision",
          fields,
          (value) => decisionRecordSchema.shape.decision.parse(value),
        ),
        rationale: tableFieldValue(
          record.rationale,
          "rationale",
          fields,
          (value) => decisionRecordSchema.shape.rationale.parse(value),
        ),
        sourceType: "Decision" as const,
        title: tableFieldValue(record.title, "title", fields, (value) =>
          decisionRecordSchema.shape.title.parse(value),
        ),
      };
    case "Risk":
      return {
        ...identity,
        description: tableFieldValue(
          record.description,
          "description",
          fields,
          (value) => riskRecordSchema.shape.description.parse(value),
        ),
        impact: tableFieldValue(record.impact, "impact", fields, (value) =>
          riskRecordSchema.shape.impact.parse(value),
        ),
        probability: tableFieldValue(
          record.probability,
          "probability",
          fields,
          (value) => riskRecordSchema.shape.probability.parse(value),
        ),
        rationale: tableFieldValue(
          record.rationale,
          "rationale",
          fields,
          (value) => riskRecordSchema.shape.rationale.parse(value),
        ),
        response: tableFieldValue(
          record.response,
          "response",
          fields,
          (value) => riskRecordSchema.shape.response.parse(value),
        ),
        sourceType: "Risk" as const,
        title: tableFieldValue(record.title, "title", fields, (value) =>
          riskRecordSchema.shape.title.parse(value),
        ),
      };
    case "Assumption":
      return {
        ...identity,
        rationale: tableFieldValue(
          record.rationale,
          "rationale",
          fields,
          (value) => assumptionRecordSchema.shape.rationale.parse(value),
        ),
        sourceType: "Assumption" as const,
        statement: tableFieldValue(
          record.statement,
          "statement",
          fields,
          (value) => assumptionRecordSchema.shape.statement.parse(value),
        ),
        title: tableFieldValue(record.title, "title", fields, (value) =>
          assumptionRecordSchema.shape.title.parse(value),
        ),
      };
    case "Open Question":
      return {
        ...identity,
        answer: tableFieldValue(record.answer, "answer", fields, (value) =>
          openQuestionRecordSchema.shape.answer.parse(value),
        ),
        context: tableFieldValue(record.context, "context", fields, (value) =>
          openQuestionRecordSchema.shape.context.parse(value),
        ),
        question: tableFieldValue(
          record.question,
          "question",
          fields,
          (value) => openQuestionRecordSchema.shape.question.parse(value),
        ),
        sourceType: "Open Question" as const,
        title: tableFieldValue(record.title, "title", fields, (value) =>
          openQuestionRecordSchema.shape.title.parse(value),
        ),
      };
    case "Milestone":
      return {
        ...identity,
        description: tableFieldValue(
          record.description,
          "description",
          fields,
          (value) => milestoneRecordSchema.shape.description.parse(value),
        ),
        sourceType: "Milestone" as const,
        targetDate: tableFieldValue(
          record.targetDate,
          "targetDate",
          fields,
          (value) => milestoneRecordSchema.shape.targetDate.parse(value),
        ),
        title: tableFieldValue(record.title, "title", fields, (value) =>
          milestoneRecordSchema.shape.title.parse(value),
        ),
      };
    case "Project Release":
      return {
        ...identity,
        description: tableFieldValue(
          record.description,
          "description",
          fields,
          (value) => projectReleaseRecordSchema.shape.description.parse(value),
        ),
        name: tableFieldValue(record.name, "name", fields, (value) =>
          projectReleaseRecordSchema.shape.name.parse(value),
        ),
        sourceType: "Project Release" as const,
        versionLabel: tableFieldValue(
          record.versionLabel,
          "versionLabel",
          fields,
          (value) => projectReleaseRecordSchema.shape.versionLabel.parse(value),
        ),
      };
    case "Production Incident":
      return {
        ...identity,
        detectedHow: tableFieldValue(
          record.detectedHow,
          "detectedHow",
          fields,
          (value) =>
            productionIncidentRecordSchema.shape.detectedHow.parse(value),
        ),
        impact: tableFieldValue(record.impact, "impact", fields, (value) =>
          productionIncidentRecordSchema.shape.impact.parse(value),
        ),
        learning: tableFieldValue(
          record.learning,
          "learning",
          fields,
          (value) => productionIncidentRecordSchema.shape.learning.parse(value),
        ),
        occurredAt: tableFieldValue(
          record.occurredAt,
          "occurredAt",
          fields,
          (value) =>
            productionIncidentRecordSchema.shape.occurredAt.parse(value),
        ),
        resolution: tableFieldValue(
          record.resolution,
          "resolution",
          fields,
          (value) =>
            productionIncidentRecordSchema.shape.resolution.parse(value),
        ),
        rootCause: tableFieldValue(
          record.rootCause,
          "rootCause",
          fields,
          (value) =>
            productionIncidentRecordSchema.shape.rootCause.parse(value),
        ),
        sourceType: "Production Incident" as const,
        title: tableFieldValue(record.title, "title", fields, (value) =>
          productionIncidentRecordSchema.shape.title.parse(value),
        ),
      };
    default:
      return recordNotFound();
  }
}

function tableUpdateInput(
  record: ProjectSourceRecord,
  input: RecordTableCellUpdateInput,
) {
  return tableUpdateFields(
    record,
    { [input.field]: input.value },
    {
      baseRevision: input.baseRevision,
      clientIdempotencyKey: input.clientIdempotencyKey,
      projectId: input.projectId,
      sourceId: input.recordId,
    },
  );
}

function recordTablePasteKey(
  clientIdempotencyKey: string,
  rowIndex: number,
  operation: "content" | "create" | "status",
) {
  const key = `${clientIdempotencyKey}:row:${rowIndex}:${operation}`;
  if (key.length <= 100) {
    return key;
  }
  const fingerprint = createHash("sha256")
    .update(`${clientIdempotencyKey}\0${rowIndex}\0${operation}`)
    .digest("hex");
  return `table:${fingerprint}`;
}

function workTableFields(fields: Record<string, unknown>) {
  const parsed: Parameters<WorkLifecycleAccess["updateFields"]>[1]["fields"] =
    {};
  for (const [field, value] of Object.entries(fields)) {
    switch (field) {
      case "description":
        parsed.description = workDescriptionSchema.parse(value);
        break;
      case "effort":
        parsed.effort = workEffortSchema.parse(value);
        break;
      case "plannedStartDate":
        parsed.plannedStartDate = workPlannedStartDateSchema.parse(value);
        break;
      case "status":
        parsed.status = workOpenStatusSchema.parse(value);
        break;
      case "targetDate":
        parsed.targetDate = workTargetDateSchema.parse(value);
        break;
      case "title":
        parsed.title = workTitleSchema.parse(value);
        break;
      default:
        recordNotFound();
    }
  }
  return parsed;
}

async function createProjectSourceRecord(
  accountId: string,
  owners: RecordTableWriteOwners,
  recordType: RecordTableSourceType,
  row: Extract<RecordTablePasteInput["rows"][number], { kind: "create" }>,
  clientIdempotencyKey: string,
) {
  if (!row.recordId) {
    return recordNotFound();
  }
  const identity = {
    baseRevision: 0,
    clientIdempotencyKey,
    id: row.recordId,
    projectId: row.projectId,
  };
  const { fields } = row;
  switch (recordType) {
    case "Decision":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          decision: decisionRecordSchema.shape.decision.parse(fields.decision),
          rationale: decisionRecordSchema.shape.rationale.parse(
            fields.rationale ?? null,
          ),
          sourceType: "Decision",
          title: decisionRecordSchema.shape.title.parse(fields.title),
        }),
      );
    case "Risk":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          description: riskRecordSchema.shape.description.parse(
            fields.description ?? null,
          ),
          impact: riskRecordSchema.shape.impact.parse(fields.impact ?? null),
          probability: riskRecordSchema.shape.probability.parse(
            fields.probability ?? null,
          ),
          response: riskRecordSchema.shape.response.parse(
            fields.response ?? null,
          ),
          sourceType: "Risk",
          title: riskRecordSchema.shape.title.parse(fields.title),
        }),
      );
    case "Assumption":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          rationale: assumptionRecordSchema.shape.rationale.parse(
            fields.rationale ?? null,
          ),
          sourceType: "Assumption",
          statement: assumptionRecordSchema.shape.statement.parse(
            fields.statement,
          ),
          title: assumptionRecordSchema.shape.title.parse(fields.title),
        }),
      );
    case "Open Question":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          context: openQuestionRecordSchema.shape.context.parse(
            fields.context ?? null,
          ),
          question: openQuestionRecordSchema.shape.question.parse(
            fields.question,
          ),
          sourceType: "Open Question",
          title: openQuestionRecordSchema.shape.title.parse(fields.title),
        }),
      );
    case "Milestone":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          description: milestoneRecordSchema.shape.description.parse(
            fields.description ?? null,
          ),
          sourceType: "Milestone",
          targetDate: milestoneRecordSchema.shape.targetDate.parse(
            fields.targetDate ?? null,
          ),
          title: milestoneRecordSchema.shape.title.parse(fields.title),
        }),
      );
    case "Project Release":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          description: projectReleaseRecordSchema.shape.description.parse(
            fields.description ?? null,
          ),
          name: projectReleaseRecordSchema.shape.name.parse(
            fields.name ?? fields.title,
          ),
          sourceType: "Project Release",
          versionLabel: projectReleaseRecordSchema.shape.versionLabel.parse(
            fields.versionLabel ?? null,
          ),
        }),
      );
    case "Production Incident":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.create(accountId, {
          ...identity,
          detectedHow: productionIncidentRecordSchema.shape.detectedHow.parse(
            fields.detectedHow ?? null,
          ),
          impact: productionIncidentRecordSchema.shape.impact.parse(
            fields.impact ?? null,
          ),
          learning: productionIncidentRecordSchema.shape.learning.parse(
            fields.learning ?? null,
          ),
          occurredAt: productionIncidentRecordSchema.shape.occurredAt.parse(
            fields.occurredAt,
          ),
          resolution: productionIncidentRecordSchema.shape.resolution.parse(
            fields.resolution ?? null,
          ),
          rootCause: productionIncidentRecordSchema.shape.rootCause.parse(
            fields.rootCause ?? null,
          ),
          sourceType: "Production Incident",
          title: productionIncidentRecordSchema.shape.title.parse(fields.title),
        }),
      );
    default:
      return recordNotFound();
  }
}

async function transitionProjectSourceRecord(
  accountId: string,
  owners: Pick<RecordTableWriteOwners, "projectSourceRecords">,
  record: ProjectSourceRecord,
  status: unknown,
  baseRevision: number,
  clientIdempotencyKey: string,
) {
  switch (record.sourceType) {
    case "Decision":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.transition(accountId, {
          baseRevision,
          clientIdempotencyKey,
          life: recordTableDecisionLifeSchema.parse(status),
          projectId: record.projectId,
          sourceId: record.id,
          sourceType: "Decision",
        }),
      );
    case "Milestone": {
      const nextStatus = milestoneRecordSchema.shape.status.parse(status);
      if (nextStatus === "Planned") {
        if (record.status === "Planned") {
          return record;
        }
        throw new ORPCError("BAD_REQUEST", {
          message: "A Milestone cannot return to Planned.",
        });
      }
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.transition(accountId, {
          baseRevision,
          clientIdempotencyKey,
          projectId: record.projectId,
          sourceId: record.id,
          sourceType: "Milestone",
          status: nextStatus,
        }),
      );
    }
    case "Project Release":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.transition(accountId, {
          baseRevision,
          clientIdempotencyKey,
          projectId: record.projectId,
          sourceId: record.id,
          sourceType: "Project Release",
          status: projectReleaseRecordSchema.shape.status.parse(status),
        }),
      );
    case "Production Incident":
      return requireProjectSourceRecord(
        await owners.projectSourceRecords.transition(accountId, {
          baseRevision,
          clientIdempotencyKey,
          projectId: record.projectId,
          sourceId: record.id,
          sourceType: "Production Incident",
          status: productionIncidentRecordSchema.shape.status.parse(status),
        }),
      );
    default:
      return recordNotFound();
  }
}

async function createWorkPasteRow(
  accountId: string,
  row: RecordTableCreatePasteRow,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  const parsed = workTableFields(row.fields);
  const { status, ...createFields } = parsed;
  let record = await owners.workLifecycle.create(accountId, {
    ...createFields,
    baseRevision: 0,
    clientIdempotencyKey: recordTablePasteKey(pasteKey, rowIndex, "create"),
    projectId: row.projectId,
    title: workTitleSchema.parse(row.fields.title),
  });
  if (status && status !== record.status) {
    record = await owners.workLifecycle.updateFields(accountId, {
      baseRevision: record.revision,
      clientIdempotencyKey: recordTablePasteKey(pasteKey, rowIndex, "status"),
      fields: { status },
      workId: record.id,
    });
  }
  return record;
}

async function updateWorkPasteRow(
  accountId: string,
  row: RecordTableUpdatePasteRow,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  const record = await owners.workLifecycle.find(accountId, row.recordId);
  if (!record || record.projectId !== row.projectId) {
    return recordNotFound();
  }
  return owners.workLifecycle.updateFields(accountId, {
    baseRevision: row.baseRevision,
    clientIdempotencyKey: recordTablePasteKey(pasteKey, rowIndex, "content"),
    fields: workTableFields(row.fields),
    workId: record.id,
  });
}

async function createProjectSourcePasteRow(
  accountId: string,
  recordType: RecordTableSourceType,
  row: RecordTableCreatePasteRow,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  const record = await createProjectSourceRecord(
    accountId,
    owners,
    recordType,
    row,
    recordTablePasteKey(pasteKey, rowIndex, "create"),
  );
  if (recordType !== "Open Question" || !Object.hasOwn(row.fields, "answer")) {
    return record;
  }
  const updated = await owners.projectSourceRecords.update(
    accountId,
    tableUpdateFields(
      record,
      { answer: row.fields.answer },
      {
        baseRevision: record.revision,
        clientIdempotencyKey: recordTablePasteKey(
          pasteKey,
          rowIndex,
          "content",
        ),
        projectId: row.projectId,
        sourceId: record.id,
      },
    ),
  );
  if (!updated) {
    return recordNotFound();
  }
  return updated;
}

async function updateProjectSourcePasteRow(
  accountId: string,
  recordType: RecordTableSourceType,
  row: RecordTableUpdatePasteRow,
  contentFields: Record<string, unknown>,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  const record = await owners.projectSourceRecords.find(
    accountId,
    recordType,
    row.recordId,
  );
  if (!record || record.projectId !== row.projectId) {
    return recordNotFound();
  }
  if (Object.keys(contentFields).length === 0) {
    return record;
  }
  const updated = await owners.projectSourceRecords.update(
    accountId,
    tableUpdateFields(record, contentFields, {
      baseRevision: row.baseRevision,
      clientIdempotencyKey: recordTablePasteKey(pasteKey, rowIndex, "content"),
      projectId: row.projectId,
      sourceId: record.id,
    }),
  );
  if (!updated) {
    return recordNotFound();
  }
  return updated;
}

async function applyProjectSourcePasteRow(
  accountId: string,
  recordType: RecordTableSourceType,
  row: RecordTablePasteRow,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  const statusField = recordType === "Decision" ? "life" : "status";
  const { [statusField]: desiredStatus, ...contentFields } = row.fields;
  const hasStatus = Object.hasOwn(row.fields, statusField);
  const record =
    row.kind === "create"
      ? await createProjectSourcePasteRow(
          accountId,
          recordType,
          row,
          rowIndex,
          pasteKey,
          owners,
        )
      : await updateProjectSourcePasteRow(
          accountId,
          recordType,
          row,
          contentFields,
          rowIndex,
          pasteKey,
          owners,
        );
  if (!hasStatus) {
    return record;
  }
  const currentStatus = "life" in record ? record.life : record.status;
  if (currentStatus === desiredStatus) {
    return record;
  }
  const baseRevision =
    row.kind === "update" && Object.keys(contentFields).length === 0
      ? row.baseRevision
      : record.revision;
  return transitionProjectSourceRecord(
    accountId,
    owners,
    record,
    desiredStatus,
    baseRevision,
    recordTablePasteKey(pasteKey, rowIndex, "status"),
  );
}

function applyPasteRow(
  accountId: string,
  recordType: RecordTableInput["recordType"],
  row: RecordTablePasteRow,
  rowIndex: number,
  pasteKey: string,
  owners: RecordTableWriteOwners,
) {
  if (recordType === "Work") {
    return row.kind === "create"
      ? createWorkPasteRow(accountId, row, rowIndex, pasteKey, owners)
      : updateWorkPasteRow(accountId, row, rowIndex, pasteKey, owners);
  }
  return applyProjectSourcePasteRow(
    accountId,
    recordType,
    row,
    rowIndex,
    pasteKey,
    owners,
  );
}

async function updateWorkCell(
  accountId: string,
  input: RecordTableCellUpdateInput,
  workLifecycle: WorkLifecycleAccess,
) {
  const record = await workLifecycle.find(accountId, input.recordId);
  if (!record || record.projectId !== input.projectId) {
    return recordNotFound();
  }
  if (input.field === "status") {
    return workLifecycle.updateStatus(
      accountId,
      {
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        status: workOpenStatusSchema.parse(input.value),
        workId: record.id,
      },
      { kind: "Visible user" },
    );
  }
  return workLifecycle.updateFields(accountId, {
    baseRevision: input.baseRevision,
    clientIdempotencyKey: input.clientIdempotencyKey,
    fields: workTableFields({ [input.field]: input.value }),
    workId: record.id,
  });
}

async function updateProjectSourceCell(
  accountId: string,
  input: RecordTableCellUpdateInput & { recordType: RecordTableSourceType },
  projectSourceRecords: ProjectSourceRecordsAccess,
) {
  const record = await projectSourceRecords.find(
    accountId,
    input.recordType,
    input.recordId,
  );
  if (!record || record.projectId !== input.projectId) {
    return recordNotFound();
  }
  if (input.field === "life" || input.field === "status") {
    return transitionProjectSourceRecord(
      accountId,
      { projectSourceRecords },
      record,
      input.value,
      input.baseRevision,
      input.clientIdempotencyKey,
    );
  }
  const updated = await projectSourceRecords.update(
    accountId,
    tableUpdateInput(record, input),
  );
  if (!updated) {
    return recordNotFound();
  }
  return updated;
}

export function createRecordTableAccess({
  withWriteTransaction,
  projectShell,
  projectSourceRecords,
  workLifecycle,
}: {
  withWriteTransaction?: RecordTableWriteTransaction;
  projectShell: ProjectShellAccess;
  projectSourceRecords: ProjectSourceRecordsAccess;
  workLifecycle: WorkLifecycleAccess;
}): RecordTableAccess {
  return {
    async list(accountId, input: RecordTableInput) {
      const projects = input.projectId
        ? [await projectShell.find(accountId, input.projectId)].filter(
            (project) => project !== null,
          )
        : await projectShell.list(accountId);

      const records = await Promise.all(
        projects.map(async (project): Promise<RecordTableRecord[]> => {
          if (input.recordType === "Work") {
            return workLifecycle.list(accountId, project.id);
          }
          const sourceRecords = await projectSourceRecords.list(
            accountId,
            project.id,
          );
          return (
            sourceRecords?.filter(
              (record) => record.sourceType === input.recordType,
            ) ?? []
          );
        }),
      );

      return records.flat();
    },
    updateCell(accountId, input) {
      const { recordType } = input;
      if (recordType === "Work") {
        return updateWorkCell(accountId, input, workLifecycle);
      }
      return updateProjectSourceCell(
        accountId,
        { ...input, recordType },
        projectSourceRecords,
      );
    },
    applyPaste(accountId, input) {
      if (!withWriteTransaction) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Record Table paste requires a write transaction.",
        });
      }
      return withWriteTransaction((owners) => {
        let records = Promise.resolve([] as RecordTableRecord[]);
        for (const [rowIndex, row] of input.rows.entries()) {
          records = records.then((completed) =>
            applyPasteRow(
              accountId,
              input.recordType,
              row,
              rowIndex,
              input.clientIdempotencyKey,
              owners,
            ).then((record) => [...completed, record]),
          );
        }
        return records;
      });
    },
  };
}
