// biome-ignore-all lint/performance/noAwaitInLoops: Canonically ordered Project locks serialize with lifecycle writes.
import {
  confirmDocumentEvidenceInputSchema,
  type DocumentEvidenceAccess,
  type DocumentEvidenceBinding,
  type DocumentEvidenceForTarget,
  type DocumentEvidencePlan,
  type DocumentEvidenceTarget,
  type DocumentSelection,
  documentEvidenceBindingSchema,
  documentEvidencePlanSchema,
  documentEvidenceRecordFields,
  documentEvidenceTargetSchema,
  documentSelectionSchema,
  type PreviewDocumentEvidenceInput,
  previewDocumentEvidenceInputSchema,
} from "@cantiara/api/document-evidence";
import { documentSchema } from "@cantiara/api/documents";
import {
  pinEvidenceText,
  versionPinnedEvidenceSchema,
} from "@cantiara/api/evidence";
import {
  canonicalizeMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { evidenceBinding, recordOrigin } from "@cantiara/db/schema/evidence";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  MutationConflictError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { rethrowSourceError } from "../../sources-and-freshness/server/sources-database";
import {
  reviewEvidenceBinding,
  writeEvidenceBinding,
} from "./evidence-database";
import { createEvidenceRecord } from "./evidence-record-creation";
import {
  evidenceProject,
  evidenceTarget,
  listEvidenceTargets,
} from "./evidence-targets";

type Row = typeof evidenceBinding.$inferSelect;
interface Value {
  binding: DocumentEvidenceBinding | null;
}
const TARGET_TYPES = new Set([
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
]);

/** Exact Document version text. Historical versions come from the mutation snapshots, like `getVersion`. */
async function readDocumentVersion(
  executor: MutationDatabaseExecutor,
  selection: DocumentSelection,
  revision: number,
) {
  const [current] = await executor
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, selection.documentId),
        eq(document.projectId, selection.projectId),
      ),
    );
  if (!current || revision < 1 || revision > current.revision) {
    return null;
  }
  let { body } = current;
  if (revision !== current.revision) {
    const snapshot =
      revision === 1
        ? sql<unknown>`${mutationHistory.previousValue}->'document'`
        : sql<unknown>`${mutationHistory.nextValue}->'document'`;
    const [entry] = await executor
      .select({ snapshot })
      .from(mutationHistory)
      .where(
        and(
          eq(mutationHistory.targetId, selection.documentId),
          eq(mutationHistory.revision, revision === 1 ? 2 : revision),
        ),
      )
      .limit(1);
    const parsed = documentSchema.safeParse(entry?.snapshot);
    if (
      !parsed.success ||
      parsed.data.id !== selection.documentId ||
      parsed.data.revision !== revision
    ) {
      return null;
    }
    ({ body } = parsed.data);
  }
  return {
    body,
    currentRevision: current.revision,
    archived: current.archivedAt !== null,
  };
}

async function binding(
  executor: MutationDatabaseExecutor,
  id: string,
  selection: DocumentSelection,
) {
  const [row] = await executor
    .select()
    .from(evidenceBinding)
    .where(eq(evidenceBinding.id, id));
  if (
    row &&
    (row.sourceRecordId !== selection.documentId ||
      row.sourceProjectId !== selection.projectId ||
      versionPinnedEvidenceSchema.parse(row.pin).source.recordType !==
        "Document")
  ) {
    return;
  }
  return row ?? null;
}
function targetOf(row: Row) {
  if (row.targetProjectId === null || !TARGET_TYPES.has(row.targetRecordType)) {
    return null;
  }
  return documentEvidenceTargetSchema.parse({
    projectId: row.targetProjectId,
    recordId: row.targetRecordId,
    type: row.targetRecordType,
  });
}

/** Owns both Projects (canonical lock order) and, for bind, the target record. */
async function ownedEnds(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: DocumentSelection,
  end: { projectId: string; target: DocumentEvidenceTarget | null },
  lock: boolean,
) {
  const owners: NonNullable<Awaited<ReturnType<typeof evidenceProject>>>[] = [];
  for (const id of [...new Set([selection.projectId, end.projectId])].sort()) {
    const owner = await evidenceProject(executor, accountId, id, lock);
    if (!owner || (lock && owner.archivedAt)) {
      return null;
    }
    owners.push(owner);
  }
  const sourceOwner = owners.find((owner) => owner.id === selection.projectId);
  const targetOwner = owners.find((owner) => owner.id === end.projectId);
  if (
    !(sourceOwner && targetOwner) ||
    owners.some((owner) => owner.workspaceId !== sourceOwner.workspaceId)
  ) {
    return null;
  }
  let targetTitle: string | null = null;
  let readOnly = owners.some((owner) => owner.archivedAt !== null);
  if (end.target) {
    const record = await evidenceTarget(executor, end.target, lock);
    if (!record || (lock && record.readOnly)) {
      return null;
    }
    targetTitle = record.title;
    readOnly = readOnly || record.readOnly;
  }
  return {
    workspaceId: sourceOwner.workspaceId,
    targetOwner,
    targetTitle,
    readOnly,
  };
}

const targetTables = {
  Work: work,
  Decision: decision,
  Risk: risk,
  Assumption: assumption,
  "Open Question": openQuestion,
};

/** Resolves a historical target without the stricter new-bind write gate. */
async function readTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  target: Omit<DocumentEvidenceTarget, "projectId"> & {
    projectId: string | null;
  },
): Promise<DocumentEvidenceBinding["target"]> {
  function broken(
    reason: NonNullable<DocumentEvidenceBinding["target"]["brokenReason"]>,
  ): DocumentEvidenceBinding["target"] {
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
  const table = targetTables[target.type];
  const [record] = await executor
    .select()
    .from(table)
    .where(
      and(eq(table.id, target.recordId), eq(table.projectId, target.projectId)),
    );
  if (!record) {
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

async function view(
  executor: MutationDatabaseExecutor,
  accountId: string,
  row: Row,
  currentRevision: number,
  documentReadOnly: boolean,
): Promise<DocumentEvidenceBinding | null> {
  if (!TARGET_TYPES.has(row.targetRecordType)) {
    return null;
  }
  const pin = versionPinnedEvidenceSchema.parse(row.pin);
  const target = await readTarget(executor, accountId, row.workspaceId, {
    type: row.targetRecordType as DocumentEvidenceTarget["type"],
    projectId: row.targetProjectId,
    recordId: row.targetRecordId,
  });
  const [origin] = await executor
    .select({ id: recordOrigin.id })
    .from(recordOrigin)
    .where(eq(recordOrigin.evidenceBindingId, row.id));
  return documentEvidenceBindingSchema.parse({
    id: row.id,
    revision: row.revision,
    pin,
    role: row.role,
    target: {
      type: row.targetRecordType,
      recordId: row.targetRecordId,
      projectId: target.projectId,
      label: target.label,
      brokenReason: target.brokenReason,
      canOpenSourceRecord: target.canOpenSourceRecord,
    },
    origin: !!origin,
    newerVersionExists: pin.source.revision < currentRevision,
    currentRevision,
    readOnly: documentReadOnly || target.brokenReason !== null,
    createdAt: row.createdAt.toISOString(),
    actorId: row.actorId,
  });
}

/** A rebind pins the current version; a range outside the exact version is a conflict. */
function assertExactSelection(
  source: { body: string; currentRevision: number },
  input: PreviewDocumentEvidenceInput,
  rebind: boolean,
) {
  if (
    (rebind && input.versionRevision !== source.currentRevision) ||
    input.end > source.body.length
  ) {
    throw new MutationConflictError(input.documentId);
  }
}

function planMode(row: Row | null, newRecord: unknown) {
  if (row) {
    return "rebind";
  }
  return newRecord ? "create" : "bind";
}

async function prepare(
  executor: MutationDatabaseExecutor,
  accountId: string,
  raw: unknown,
  lock: boolean,
): Promise<{
  plan: DocumentEvidencePlan;
  workspaceId: string;
  targetOwner: typeof project.$inferSelect;
} | null> {
  const input = previewDocumentEvidenceInputSchema.parse(raw);
  const row = input.bindingId
    ? await binding(executor, input.bindingId, input)
    : null;
  if (input.bindingId && !row) {
    return null;
  }
  const target = row ? targetOf(row) : (input.target ?? null);
  const newRecord = input.newRecord ?? null;
  if (row && !target) {
    return null;
  }
  const projectId = target?.projectId ?? newRecord?.projectId;
  if (!projectId) {
    return null;
  }
  const ends = await ownedEnds(
    executor,
    accountId,
    input,
    { projectId, target },
    lock,
  );
  const source = await readDocumentVersion(
    executor,
    input,
    input.versionRevision,
  );
  if (!(ends && source) || source.archived || ends.readOnly) {
    return null;
  }
  assertExactSelection(source, input, Boolean(row));
  const pin = pinEvidenceText(
    {
      recordType: "Document",
      recordId: input.documentId,
      projectId: input.projectId,
      revision: input.versionRevision,
      componentId: null,
    },
    source.body,
    input.start,
    input.end,
  );
  const plan = documentEvidencePlanSchema.parse({
    pin,
    mode: planMode(row ?? null, newRecord),
    target,
    newRecord,
    targetTitle: ends.targetTitle ?? newRecord?.title,
    fields: newRecord
      ? documentEvidenceRecordFields(newRecord, pin.excerpt)
      : {},
    bindingId: row?.id ?? null,
    bindingRevision: row?.revision ?? 0,
    currentRevision: source.currentRevision,
  });
  return { plan, workspaceId: ends.workspaceId, targetOwner: ends.targetOwner };
}

function previewInputOf(
  selection: DocumentSelection,
  plan: DocumentEvidencePlan,
) {
  return {
    ...selection,
    versionRevision: plan.pin.source.revision,
    start: plan.pin.start,
    end: plan.pin.end,
    ...(plan.bindingId ? { bindingId: plan.bindingId } : {}),
    ...(!plan.bindingId && plan.target ? { target: plan.target } : {}),
    ...(plan.newRecord ? { newRecord: plan.newRecord } : {}),
  };
}

type CommitInput = Parameters<
  MutationDatabaseTargetAdapter<Value>["update"]
>[1];

/** Writes the single previewed change: rebind a pin, or bind (optionally creating the one new record). */
async function commitPlan(
  executor: MutationDatabaseExecutor,
  accountId: string,
  prepared: NonNullable<Awaited<ReturnType<typeof prepare>>>,
  recordId: string | undefined,
  input: CommitInput,
) {
  const { plan, workspaceId, targetOwner } = prepared;
  if (plan.mode === "rebind") {
    const row = await reviewEvidenceBinding(executor, {
      id: input.targetId,
      expectedRevision: input.expectedRevision,
      pin: plan.pin,
      reviewedSourceRevision: plan.currentRevision,
      actorId: accountId,
      committedAt: input.committedAt,
    });
    if (!row) {
      throw new MutationConflictError(input.targetId);
    }
    return;
  }
  let { target } = plan;
  if (plan.mode === "create") {
    if (!(recordId && plan.newRecord)) {
      throw new MutationConflictError(input.targetId);
    }
    await createEvidenceRecord(executor, plan, targetOwner, {
      recordId,
      committedAt: input.committedAt,
      idempotencyKey: String(input.idempotencyKey),
      payloadFingerprint: input.payloadFingerprint,
    });
    target = {
      projectId: plan.newRecord.projectId,
      recordId,
      type: plan.newRecord.type,
    };
  }
  if (!target) {
    throw new MutationConflictError(input.targetId);
  }
  await writeEvidenceBinding(executor, {
    id: input.targetId,
    workspaceId,
    pin: plan.pin,
    target,
    origin: plan.mode === "create",
    actorId: accountId,
    committedAt: input.committedAt,
  });
}

async function liveSource(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  pin: ReturnType<typeof versionPinnedEvidenceSchema.parse>,
) {
  const [source] = await executor
    .select({
      title: document.title,
      revision: document.revision,
      archivedAt: document.archivedAt,
    })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(document.id, pin.source.recordId),
        eq(document.projectId, pin.source.projectId),
        eq(workspace.id, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  return source ?? null;
}
function sourceBrokenReason(source: { archivedAt: Date | null } | null) {
  if (!source) {
    return "No access" as const;
  }
  return source.archivedAt ? ("Archived" as const) : null;
}

function targetEvidence(
  row: Row,
  pin: ReturnType<typeof versionPinnedEvidenceSchema.parse>,
  source: Awaited<ReturnType<typeof liveSource>>,
): DocumentEvidenceForTarget {
  return {
    id: row.id,
    pin: source ? pin : null,
    role: row.role,
    source: {
      documentId: pin.source.recordId,
      projectId: source ? pin.source.projectId : null,
      title: source?.title ?? null,
      brokenReason: sourceBrokenReason(source),
      canOpenSourceRecord: Boolean(source),
    },
    newerVersionExists: source ? pin.source.revision < source.revision : false,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createDatabaseDocumentEvidence(
  database: Database,
): DocumentEvidenceAccess {
  function adapter(
    accountId: string,
    selection: DocumentSelection,
    command: { plan: DocumentEvidencePlan; recordId?: string },
  ): MutationDatabaseTargetAdapter<Value> {
    return {
      async find(executor, id, lock) {
        const prepared = await prepare(
          executor,
          accountId,
          previewInputOf(selection, command.plan),
          lock,
        );
        if (!prepared) {
          return null;
        }
        const row = await binding(executor, id, selection);
        if (row === undefined) {
          return null;
        }
        const current = row
          ? await view(
              executor,
              accountId,
              row,
              prepared.plan.currentRevision,
              false,
            )
          : null;
        if (row && !current) {
          return null;
        }
        return {
          id,
          revision: row?.revision ?? 0,
          value: { binding: current },
        };
      },
      async update(executor, input) {
        const prepared = await prepare(
          executor,
          accountId,
          previewInputOf(selection, command.plan),
          true,
        );
        // Confirmation commits only the exact previewed plan; a drifted plan is a conflict.
        if (
          !prepared ||
          canonicalizeMutationPayload(prepared.plan) !==
            canonicalizeMutationPayload(command.plan)
        ) {
          throw new MutationConflictError(selection.documentId);
        }
        await commitPlan(
          executor,
          accountId,
          prepared,
          command.recordId,
          input,
        );
        return {
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: input.nextValue,
        };
      },
    };
  }

  return {
    targets(accountId, raw) {
      const selection = documentSelectionSchema.parse(raw);
      return database.transaction(
        async (executor) => {
          const owner = await evidenceProject(
            executor,
            accountId,
            selection.projectId,
            false,
          );
          const source = owner
            ? await readDocumentVersion(executor, selection, 1)
            : null;
          if (!(owner && source)) {
            return null;
          }
          const records = await listEvidenceTargets(
            executor,
            owner.workspaceId,
          );
          return records.filter(({ type }) => TARGET_TYPES.has(type)) as Array<
            DocumentEvidenceTarget & { title: string }
          >;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    preview(accountId, raw) {
      return database.transaction(
        async (executor) =>
          (await prepare(executor, accountId, raw, false))?.plan ?? null,
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async confirm(accountId, raw) {
      const input = confirmDocumentEvidenceInputSchema.parse(raw);
      const { plan } = input;
      if (
        input.baseRevision !== plan.bindingRevision ||
        (plan.mode === "rebind") !== Boolean(plan.bindingId) ||
        (plan.mode === "rebind" ? plan.bindingId !== input.id : false) ||
        (plan.mode === "create" && !input.recordId) ||
        (plan.mode !== "create" && input.recordId) ||
        plan.pin.source.recordId !== input.documentId ||
        plan.pin.source.projectId !== input.projectId
      ) {
        throw new MutationConflictError(input.id);
      }
      const selection = {
        documentId: input.documentId,
        projectId: input.projectId,
      };
      const mutation = createDatabaseMutationContract<Value>(database, {
        target: adapter(accountId, selection, {
          plan,
          recordId: input.recordId,
        }),
      });
      try {
        const receipt = await mutation.mutate(
          {
            kind: "human",
            actor: { type: "User", actorId: accountId },
            targetId: input.id,
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            payload: {
              operation: "confirmDocumentEvidence",
              ...input,
            } as MutationPayload,
          },
          ({ currentValue, committedAt }) => {
            if (plan.mode !== "rebind" && currentValue.binding) {
              throw new MutationConflictError(input.id);
            }
            const recordId =
              plan.mode === "create" ? input.recordId : plan.target?.recordId;
            const projectId =
              plan.newRecord?.projectId ?? plan.target?.projectId;
            const type = plan.newRecord?.type ?? plan.target?.type;
            if (!(recordId && projectId && type)) {
              throw new MutationConflictError(input.id);
            }
            return {
              binding: documentEvidenceBindingSchema.parse({
                id: input.id,
                revision: input.baseRevision + 1,
                pin: plan.pin,
                role: currentValue.binding?.role ?? "Unspecified",
                target: {
                  type,
                  recordId,
                  projectId,
                  label: plan.targetTitle,
                  brokenReason: null,
                  canOpenSourceRecord: true,
                },
                origin: plan.mode === "create",
                newerVersionExists: false,
                currentRevision: plan.currentRevision,
                readOnly: false,
                createdAt: committedAt,
                actorId: accountId,
              }),
            };
          },
        );
        return receipt.nextValue.binding;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        return rethrowSourceError(error, input.id);
      }
    },
    list(accountId, raw) {
      const selection = documentSelectionSchema.parse(raw);
      return database.transaction(
        async (executor) => {
          if (
            !(await evidenceProject(
              executor,
              accountId,
              selection.projectId,
              false,
            ))
          ) {
            return null;
          }
          const [current] = await executor
            .select({
              revision: document.revision,
              archivedAt: document.archivedAt,
            })
            .from(document)
            .where(
              and(
                eq(document.id, selection.documentId),
                eq(document.projectId, selection.projectId),
              ),
            );
          if (!current) {
            return null;
          }
          const rows = await executor
            .select()
            .from(evidenceBinding)
            .where(
              and(
                eq(evidenceBinding.sourceProjectId, selection.projectId),
                eq(evidenceBinding.sourceRecordId, selection.documentId),
              ),
            )
            .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
          const bindings: DocumentEvidenceBinding[] = [];
          for (const row of rows) {
            if (
              versionPinnedEvidenceSchema.parse(row.pin).source.recordType !==
              "Document"
            ) {
              continue;
            }
            const item = await view(
              executor,
              accountId,
              row,
              current.revision,
              current.archivedAt !== null,
            );
            if (item) {
              bindings.push(item);
            }
          }
          return bindings;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    forTarget(accountId, raw) {
      const target = documentEvidenceTargetSchema.parse(raw);
      return database.transaction(
        async (executor) => {
          const owner = await evidenceProject(
            executor,
            accountId,
            target.projectId,
            false,
          );
          if (!(owner && (await evidenceTarget(executor, target, false)))) {
            return null;
          }
          const rows = await executor
            .select()
            .from(evidenceBinding)
            .where(
              and(
                eq(evidenceBinding.targetProjectId, target.projectId),
                eq(evidenceBinding.targetRecordId, target.recordId),
                eq(evidenceBinding.targetRecordType, target.type),
              ),
            )
            .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
          const result: DocumentEvidenceForTarget[] = [];
          for (const row of rows) {
            const pin = versionPinnedEvidenceSchema.parse(row.pin);
            if (pin.source.recordType !== "Document") {
              continue;
            }
            // A persisted pin never authorizes reads: the live owned Document gates the text.
            const source = await liveSource(
              executor,
              accountId,
              owner.workspaceId,
              pin,
            );
            result.push(targetEvidence(row, pin, source));
          }
          return result;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
