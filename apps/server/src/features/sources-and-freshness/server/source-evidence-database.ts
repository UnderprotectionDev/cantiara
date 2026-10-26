// biome-ignore-all lint/performance/noAwaitInLoops: Canonically ordered Project locks serialize with lifecycle writes.
import {
  pinEvidenceText,
  versionPinnedEvidenceSchema,
} from "@cantiara/api/evidence";
import {
  canonicalizeMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  MutationConflictError,
  MutationTargetNotFoundError,
} from "@cantiara/api/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "@cantiara/api/mutation-contract-database";
import {
  bindSourceEvidenceInputSchema,
  reviewSourceEvidenceInputSchema,
  type SourceEvidenceAccess,
  type SourceEvidencePlan,
  type SourceEvidenceTarget,
  type SourceEvidenceUse,
  sourceEvidencePlanSchema,
  sourceEvidencePreviewInputSchema,
  sourceEvidenceTargetSchema,
} from "@cantiara/api/source-evidence";
import { sourceSelectionSchema } from "@cantiara/api/sources-and-freshness";
import type { Database } from "@cantiara/db";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { sourceVersion } from "@cantiara/db/schema/source";
import { and, asc, eq } from "drizzle-orm";
import {
  reviewEvidenceBinding,
  writeEvidenceBinding,
} from "../../evidence/server/evidence-database";
import {
  evidenceProject,
  evidenceTarget,
  listEvidenceTargets,
} from "../../evidence/server/evidence-targets";
import { readRecord, rethrowSourceError } from "./sources-database";

interface Selection {
  projectId: string;
  sourceId: string;
}
type Row = typeof evidenceBinding.$inferSelect;
interface Value {
  use: SourceEvidenceUse | null;
}

async function binding(
  executor: MutationDatabaseExecutor,
  id: string,
  selection: Selection,
) {
  const [row] = await executor
    .select()
    .from(evidenceBinding)
    .where(eq(evidenceBinding.id, id));
  if (
    row &&
    (row.sourceRecordId !== selection.sourceId ||
      row.sourceProjectId !== selection.projectId ||
      versionPinnedEvidenceSchema.parse(row.pin).source.recordType !== "Source")
  ) {
    return;
  }
  return row ?? null;
}
async function version(
  executor: MutationDatabaseExecutor,
  selection: Selection,
  revision: number,
) {
  const [row] = await executor
    .select()
    .from(sourceVersion)
    .where(
      and(
        eq(sourceVersion.sourceId, selection.sourceId),
        eq(sourceVersion.revision, revision),
      ),
    );
  return row ?? null;
}
function targetOf(row: Row) {
  if (row.targetProjectId === null) {
    return null;
  }
  return sourceEvidenceTargetSchema.parse({
    projectId: row.targetProjectId,
    recordId: row.targetRecordId,
    type: row.targetRecordType,
  });
}
async function ownedEnds(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: Selection,
  target: SourceEvidenceTarget,
  lock: boolean,
) {
  const owners: NonNullable<Awaited<ReturnType<typeof evidenceProject>>>[] = [];
  for (const id of [
    ...new Set([selection.projectId, target.projectId]),
  ].sort()) {
    const owner = await evidenceProject(executor, accountId, id, lock);
    if (!owner || (lock && owner.archivedAt)) {
      return null;
    }
    owners.push(owner);
  }
  const sourceOwner = owners.find((owner) => owner.id === selection.projectId);
  if (
    !sourceOwner ||
    owners.some((owner) => owner.workspaceId !== sourceOwner.workspaceId)
  ) {
    return null;
  }
  const record = await evidenceTarget(executor, target, lock);
  if (!record || (lock && record.readOnly)) {
    return null;
  }
  return {
    workspaceId: sourceOwner.workspaceId,
    targetTitle: record.title,
    readOnly:
      record.readOnly || owners.some((owner) => owner.archivedAt !== null),
  };
}
async function readUse(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: Selection,
  row: Row,
): Promise<SourceEvidenceUse | null> {
  const target = targetOf(row);
  if (!target) {
    return null;
  }
  const ends = await ownedEnds(executor, accountId, selection, target, false);
  const current = await readRecord(
    executor,
    selection.sourceId,
    selection.projectId,
  );
  const pin = versionPinnedEvidenceSchema.parse(row.pin);
  const capture = await version(executor, selection, pin.source.revision);
  if (!(ends && current && capture) || row.workspaceId !== ends.workspaceId) {
    return null;
  }
  return {
    id: row.id,
    revision: row.revision,
    pin,
    target,
    targetTitle: ends.targetTitle,
    accessedAt: capture.accessedAt.toISOString(),
    role: row.role,
    newerVersionExists: pin.source.revision < current.revision,
    reviewedSourceRevision: row.reviewedSourceRevision,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    readOnly: ends.readOnly,
  };
}
async function prepare(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: Parameters<SourceEvidenceAccess["preview"]>[1],
): Promise<SourceEvidencePlan | null> {
  const row = input.bindingId
    ? await binding(executor, input.bindingId, input)
    : null;
  if (input.bindingId && !row) {
    return null;
  }
  const target = row ? targetOf(row) : input.target;
  if (!target) {
    return null;
  }
  const ends = await ownedEnds(executor, accountId, input, target, false);
  const current = await readRecord(executor, input.sourceId, input.projectId);
  if (!ends || ends.readOnly || !current) {
    return null;
  }
  if (
    current.revision !== input.expectedSourceRevision ||
    (row && input.versionRevision !== current.revision)
  ) {
    throw new MutationConflictError(input.sourceId);
  }
  const capture = await version(executor, input, input.versionRevision);
  if (!capture) {
    throw new MutationConflictError(input.sourceId);
  }
  const pin = pinEvidenceText(
    {
      recordType: "Source",
      recordId: input.sourceId,
      projectId: input.projectId,
      revision: capture.revision,
      componentId: null,
    },
    capture.capturedContent,
    input.start,
    input.end,
  );
  return sourceEvidencePlanSchema.parse({
    pin,
    target,
    targetTitle: ends.targetTitle,
    accessedAt: capture.accessedAt.toISOString(),
    expectedSourceRevision: current.revision,
    bindingId: row?.id ?? null,
    bindingRevision: row?.revision ?? 0,
  });
}

async function authorizeBinding(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: Selection,
  id: string,
  newTarget: SourceEvidenceTarget | undefined,
  lock: boolean,
) {
  const observed = await binding(executor, id, selection);
  if (observed === undefined) {
    return false;
  }
  const target = observed ? targetOf(observed) : newTarget;
  if (
    !(target && (await ownedEnds(executor, accountId, selection, target, lock)))
  ) {
    return false;
  }
  return Boolean(
    await readRecord(executor, selection.sourceId, selection.projectId),
  );
}

async function verifyPlan(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: Selection,
  preview: SourceEvidencePlan,
) {
  const current = await prepare(executor, accountId, {
    ...selection,
    ...(preview.bindingId
      ? { bindingId: preview.bindingId }
      : { target: preview.target }),
    expectedSourceRevision: preview.expectedSourceRevision,
    versionRevision: preview.pin.source.revision,
    start: preview.pin.start,
    end: preview.pin.end,
  });
  if (
    !current ||
    canonicalizeMutationPayload(current) !==
      canonicalizeMutationPayload(preview)
  ) {
    throw new MutationConflictError(selection.sourceId);
  }
}

async function commitEvidenceUse(
  executor: MutationDatabaseExecutor,
  input: Parameters<MutationDatabaseTargetAdapter<Value>["update"]>[1],
  use: SourceEvidenceUse,
  workspaceId: string,
  accountId: string,
  sourceRevision: number,
) {
  if (input.expectedRevision === 0) {
    await writeEvidenceBinding(executor, {
      id: input.targetId,
      workspaceId,
      pin: use.pin,
      target: { ...use.target },
      origin: false,
      actorId: accountId,
      committedAt: input.committedAt,
    });
  } else {
    const row = await reviewEvidenceBinding(executor, {
      id: input.targetId,
      expectedRevision: input.expectedRevision,
      pin: use.pin,
      reviewedSourceRevision: sourceRevision,
      actorId: accountId,
      committedAt: input.committedAt,
    });
    if (!row) {
      throw new MutationConflictError(input.targetId);
    }
  }
}

export function createDatabaseSourceEvidence(
  database: Database,
): SourceEvidenceAccess {
  function adapter(
    accountId: string,
    selection: Selection,
    command: {
      target?: SourceEvidenceTarget;
      plan?: SourceEvidencePlan;
      expectedSourceRevision: number;
    },
  ): MutationDatabaseTargetAdapter<Value> {
    return {
      async find(executor, id, lock) {
        if (
          !(await authorizeBinding(
            executor,
            accountId,
            selection,
            id,
            command.target,
            lock,
          ))
        ) {
          return null;
        }
        // Re-read after the Project lock: another review may have committed while we waited.
        const row = await binding(executor, id, selection);
        if (row === undefined) {
          return null;
        }
        const use = row
          ? await readUse(executor, accountId, selection, row)
          : null;
        if (row && !use) {
          return null;
        }
        return { id, revision: row?.revision ?? 0, value: { use } };
      },
      async update(executor, input) {
        const { use } = input.nextValue;
        if (!use) {
          return null;
        }
        const ends = await ownedEnds(
          executor,
          accountId,
          selection,
          use.target,
          true,
        );
        const current = await readRecord(
          executor,
          selection.sourceId,
          selection.projectId,
        );
        if (!(ends && current)) {
          return null;
        }
        if (current.revision !== command.expectedSourceRevision) {
          throw new MutationConflictError(selection.sourceId);
        }
        if (command.plan) {
          await verifyPlan(executor, accountId, selection, command.plan);
        }
        await commitEvidenceUse(
          executor,
          input,
          use,
          ends.workspaceId,
          accountId,
          current.revision,
        );
        return {
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: { use },
        };
      },
    };
  }
  async function mutate(
    accountId: string,
    selection: Selection,
    id: string,
    baseRevision: number,
    key: string,
    payload: MutationPayload,
    command: Parameters<typeof adapter>[2],
    reduce: (
      use: SourceEvidenceUse | null,
      committedAt: string,
    ) => SourceEvidenceUse,
  ) {
    const mutation = createDatabaseMutationContract<Value>(database, {
      target: adapter(accountId, selection, command),
    });
    try {
      const receipt = await mutation.mutate(
        {
          kind: "human",
          actor: { type: "User", actorId: accountId },
          targetId: id,
          baseRevision,
          clientIdempotencyKey: key,
          payload,
        },
        ({ currentValue, committedAt }) => ({
          use: reduce(currentValue.use, committedAt),
        }),
      );
      return receipt.nextValue.use;
    } catch (error) {
      if (error instanceof MutationTargetNotFoundError) {
        return null;
      }
      return rethrowSourceError(error, id);
    }
  }
  return {
    targets(accountId, raw) {
      const selection = sourceSelectionSchema.parse(raw);
      return database.transaction(
        async (executor) => {
          const owner = await evidenceProject(
            executor,
            accountId,
            selection.projectId,
            false,
          );
          if (
            !(
              owner &&
              (await readRecord(
                executor,
                selection.sourceId,
                selection.projectId,
              ))
            )
          ) {
            return null;
          }
          return listEvidenceTargets(executor, owner.workspaceId);
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    list(accountId, raw) {
      const selection = sourceSelectionSchema.parse(raw);
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
          const current = await readRecord(
            executor,
            selection.sourceId,
            selection.projectId,
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
                eq(evidenceBinding.sourceRecordId, selection.sourceId),
              ),
            )
            .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
          const uses: SourceEvidenceUse[] = [];
          for (const row of rows) {
            if (
              versionPinnedEvidenceSchema.parse(row.pin).source.recordType !==
              "Source"
            ) {
              continue;
            }
            const use = await readUse(executor, accountId, selection, row);
            if (use) {
              uses.push(use);
            }
          }
          const useIds = uses
            .filter(
              (use) =>
                !use.readOnly &&
                use.newerVersionExists &&
                (use.reviewedSourceRevision ?? 0) < current.revision,
            )
            .map((use) => use.id);
          return {
            uses,
            signal: useIds.length
              ? {
                  id: `source-version-in-use:${selection.sourceId}`,
                  type: "source-version-in-use" as const,
                  sourceId: selection.sourceId,
                  versionRevision: current.revision,
                  useIds,
                }
              : null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async preview(accountId, raw) {
      const input = sourceEvidencePreviewInputSchema.parse(raw);
      try {
        return await database.transaction(
          (executor) => prepare(executor, accountId, input),
          { isolationLevel: "repeatable read", accessMode: "read only" },
        );
      } catch (error) {
        return rethrowSourceError(error, input.sourceId);
      }
    },
    bind(accountId, raw) {
      const input = bindSourceEvidenceInputSchema.parse(raw);
      if (
        input.plan.bindingId ||
        input.plan.bindingRevision !== 0 ||
        input.baseRevision !== 0
      ) {
        throw new MutationConflictError(input.id);
      }
      const { plan } = input;
      return mutate(
        accountId,
        input,
        input.id,
        input.baseRevision,
        input.clientIdempotencyKey,
        { operation: "bindSourceEvidence", ...input },
        {
          target: plan.target,
          plan,
          expectedSourceRevision: plan.expectedSourceRevision,
        },
        (current) => {
          if (current) {
            throw new MutationConflictError(input.id);
          }
          return {
            id: input.id,
            revision: 1,
            pin: plan.pin,
            target: plan.target,
            targetTitle: plan.targetTitle,
            accessedAt: plan.accessedAt,
            role: "Unspecified",
            newerVersionExists:
              plan.pin.source.revision < plan.expectedSourceRevision,
            reviewedSourceRevision: null,
            reviewedAt: null,
            reviewedBy: null,
            readOnly: false,
          };
        },
      );
    },
    review(accountId, raw) {
      const input = reviewSourceEvidenceInputSchema.parse(raw);
      return mutate(
        accountId,
        input,
        input.bindingId,
        input.baseRevision,
        input.clientIdempotencyKey,
        { operation: "reviewSourceEvidence", ...input },
        {
          plan: input.plan,
          expectedSourceRevision: input.expectedSourceRevision,
        },
        (use, committedAt) => {
          if (
            !use?.newerVersionExists ||
            (input.plan &&
              (input.plan.bindingId !== use.id ||
                input.plan.bindingRevision !== use.revision ||
                input.plan.expectedSourceRevision !==
                  input.expectedSourceRevision))
          ) {
            throw new MutationConflictError(input.bindingId);
          }
          return {
            ...use,
            revision: use.revision + 1,
            pin: input.plan?.pin ?? use.pin,
            accessedAt: input.plan?.accessedAt ?? use.accessedAt,
            newerVersionExists: !input.plan,
            reviewedSourceRevision: input.expectedSourceRevision,
            reviewedAt: committedAt,
            reviewedBy: accountId,
          };
        },
      );
    },
  };
}
