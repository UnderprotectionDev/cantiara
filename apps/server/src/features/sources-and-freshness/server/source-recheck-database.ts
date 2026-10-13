import { createHash } from "node:crypto";
import type {
  SmartLinkPreview,
  SmartLinkPreviewAccess,
} from "@cantiara/api/smart-link-preview";
import {
  recheckSourceInputSchema,
  type SourceCheck,
  type SourceRecheckAccess,
  sourceCheckDecisionInputSchema,
  sourceCheckSchema,
} from "@cantiara/api/source-recheck";
import {
  SourceConflictError,
  type SourceRecord,
  sourceVersionSchema,
} from "@cantiara/api/sources-and-freshness";
import type { Database } from "@cantiara/db";
import { sourceCheck } from "@cantiara/db/schema/source";
import { eq } from "drizzle-orm";
import {
  MutationConflictError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  ownedProject,
  readRecord,
  rethrowSourceError,
  sourceTarget,
} from "./sources-database";

interface CheckValue {
  check: SourceCheck | null;
}

async function approveCandidate(
  executor: MutationDatabaseExecutor,
  input: Parameters<MutationDatabaseTargetAdapter<CheckValue>["update"]>[1],
  check: SourceCheck,
  accountId: string,
  projectId: string,
) {
  const { sourceId } = check;
  const approved = check.approvedRevision;
  const current = await readRecord(executor, sourceId, projectId);
  if (!current) {
    throw new MutationConflictError(sourceId);
  }
  if (
    input.expectedRevision > 0 &&
    current.revision !== check.comparedRevision
  ) {
    throw new MutationConflictError(sourceId);
  }
  if (approved && input.expectedRevision > 0) {
    if (current.revision !== approved - 1 || !check.candidate) {
      throw new MutationConflictError(sourceId);
    }
    const updated = await sourceTarget(accountId, projectId).update(executor, {
      ...input,
      targetId: sourceId,
      expectedRevision: current.revision,
      committedAt: input.committedAt,
      nextValue: {
        record: {
          ...current,
          revision: approved,
          updatedAt: input.committedAt.toISOString(),
          version: sourceVersionSchema.parse({
            ...check.candidate,
            revision: approved,
            savedAt: input.committedAt.toISOString(),
          }),
        },
      },
    });
    if (!updated) {
      throw new MutationConflictError(sourceId);
    }
  }
}

function captureCheck(
  input: Parameters<SourceRecheckAccess["recheck"]>[1],
  current: SourceRecord,
  result: SmartLinkPreview,
  accountId: string,
  checkedAt: string,
) {
  const candidate =
    result.kind === "preview" && result.fetchResult
      ? {
          sourceId: input.sourceId,
          url: result.player ? result.url : result.fetchResult.finalUrl,
          title: result.title,
          accessedAt: result.accessedAt,
          capturedContent: result.capturedContent,
          provider: current.version.provider,
          externalRecordType: current.version.externalRecordType,
          externalId: current.version.externalId,
        }
      : null;
  return sourceCheckSchema.parse({
    id: input.id,
    sourceId: input.sourceId,
    revision: 1,
    comparedRevision: current.revision,
    checkedAt,
    checkedBy: accountId,
    startUrl: current.version.url,
    fetchResult: result.fetchResult ?? null,
    fingerprint: candidate
      ? createHash("sha256")
          .update(
            JSON.stringify({
              title: candidate.title,
              capturedContent: candidate.capturedContent,
            }),
          )
          .digest("hex")
      : null,
    error: candidate
      ? null
      : (result.error ?? "Source Check metadata unavailable."),
    candidate,
    decision: null,
    approvedRevision: null,
  });
}

export function createDatabaseSourceRecheck(
  database: Database,
  preview: SmartLinkPreviewAccess,
): SourceRecheckAccess {
  function target(
    accountId: string,
    projectId: string,
    sourceId: string,
  ): MutationDatabaseTargetAdapter<CheckValue> {
    return {
      async find(executor, id, lock) {
        if (
          !(
            (await ownedProject(executor, accountId, projectId, lock)) &&
            (await readRecord(executor, sourceId, projectId))
          )
        ) {
          return null;
        }
        const [row] = await executor
          .select()
          .from(sourceCheck)
          .where(eq(sourceCheck.id, id));
        if (row && row.sourceId !== sourceId) {
          return null;
        }
        return {
          id,
          revision: row?.revision ?? 0,
          value: { check: row ? sourceCheckSchema.parse(row.value) : null },
        };
      },
      async update(executor, input) {
        const { check } = input.nextValue;
        if (!check || check.sourceId !== sourceId) {
          return null;
        }
        await approveCandidate(executor, input, check, accountId, projectId);
        const values = {
          sourceId,
          revision: input.expectedRevision + 1,
          value: check,
        };
        const rows =
          input.expectedRevision === 0
            ? await executor
                .insert(sourceCheck)
                .values({ id: input.targetId, ...values })
                .onConflictDoNothing()
                .returning()
            : await executor
                .update(sourceCheck)
                .set(values)
                .where(eq(sourceCheck.id, input.targetId))
                .returning();
        if (!rows[0]) {
          throw new MutationConflictError(input.targetId);
        }
        return {
          id: input.targetId,
          revision: values.revision,
          value: { check },
        };
      },
    };
  }
  function list(
    accountId: string,
    input: { sourceId: string; projectId: string },
  ) {
    return database.transaction(
      async (executor) => {
        if (
          !(
            (await ownedProject(executor, accountId, input.projectId, false)) &&
            (await readRecord(executor, input.sourceId, input.projectId))
          )
        ) {
          return null;
        }
        const rows = await executor
          .select()
          .from(sourceCheck)
          .where(eq(sourceCheck.sourceId, input.sourceId));
        return rows
          .map((row) => sourceCheckSchema.parse(row.value))
          .sort(
            (a, b) =>
              a.checkedAt.localeCompare(b.checkedAt) ||
              a.id.localeCompare(b.id),
          );
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  return {
    list,
    async recheck(accountId, rawInput) {
      const input = recheckSourceInputSchema.parse(rawInput);
      const access = target(accountId, input.projectId, input.sourceId);
      const existing = await access.find(database, input.id, false);
      if (!existing) {
        return null;
      }
      if (existing.value.check) {
        if (
          existing.value.check.comparedRevision !==
            input.expectedSourceRevision ||
          existing.value.check.checkedBy !== accountId
        ) {
          throw new SourceConflictError(input.id);
        }
        return existing.value.check;
      }
      if (!(await ownedProject(database, accountId, input.projectId, true))) {
        return null;
      }
      const current = await readRecord(
        database,
        input.sourceId,
        input.projectId,
      );
      if (!current || current.revision !== input.expectedSourceRevision) {
        throw new SourceConflictError(input.sourceId);
      }
      const checkedAt = new Date().toISOString();
      const result = await preview(current.version.url);
      const check = captureCheck(input, current, result, accountId, checkedAt);
      const mutation = createDatabaseMutationContract<CheckValue>(database, {
        target: access,
      });
      try {
        const receipt = await mutation.mutate(
          {
            kind: "human",
            actor: { type: "User", actorId: accountId },
            targetId: input.id,
            baseRevision: 0,
            clientIdempotencyKey: input.id,
            payload: { operation: "recheckSource", ...input },
          },
          () => ({ check }),
        );
        return receipt.nextValue.check;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        return rethrowSourceError(error, input.id);
      }
    },
    async decide(accountId, rawInput) {
      const input = sourceCheckDecisionInputSchema.parse(rawInput);
      const mutation = createDatabaseMutationContract<CheckValue>(database, {
        target: target(accountId, input.projectId, input.sourceId),
      });
      try {
        const receipt = await mutation.mutate(
          {
            kind: "human",
            actor: { type: "User", actorId: accountId },
            targetId: input.checkId,
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            payload: { operation: "decideSourceCheck", ...input },
          },
          ({ currentValue, currentRevision }) => {
            const { check } = currentValue;
            if (!check || check.decision) {
              throw new MutationConflictError(input.checkId);
            }
            if (check.comparedRevision !== input.expectedSourceRevision) {
              throw new MutationConflictError(input.sourceId);
            }
            if (
              input.decision === "Save as new Source version" &&
              !check.candidate
            ) {
              throw new MutationConflictError(input.checkId);
            }
            return {
              check: {
                ...check,
                revision: currentRevision + 1,
                decision: input.decision,
                approvedRevision:
                  input.decision === "Save as new Source version"
                    ? input.expectedSourceRevision + 1
                    : null,
              },
            };
          },
        );
        return receipt.nextValue.check;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        return rethrowSourceError(error, input.checkId);
      }
    },
  };
}
