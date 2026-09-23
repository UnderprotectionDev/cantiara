import {
  type ExternalExecutionHandoff,
  type ExternalExecutionHandoffStartCommand,
  type ExternalExecutionHandoffsAccess,
  externalExecutionHandoffSchema,
  externalExecutionHandoffSelectedVersionsSchema,
  externalExecutionHandoffWorkSnapshotSchema,
  renderExternalExecutionHandoffPackage,
} from "@cantiara/api/external-handoffs";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { and, asc, eq, isNull } from "drizzle-orm";

type HandoffRecord = typeof workExternalExecutionHandoff.$inferSelect;

export class ExternalExecutionHandoffStaleWorkError extends Error {
  readonly code = "EXTERNAL_HANDOFF_STALE_WORK" as const;

  constructor() {
    super("Work changed after the handoff form was opened.");
    this.name = "ExternalExecutionHandoffStaleWorkError";
  }
}

export class ExternalExecutionHandoffIdempotencyConflictError extends Error {
  readonly code = "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" as const;

  constructor() {
    super("The handoff idempotency key was reused with a different payload.");
    this.name = "ExternalExecutionHandoffIdempotencyConflictError";
  }
}

function toExternalExecutionHandoff(
  record: HandoffRecord,
): ExternalExecutionHandoff {
  const selectedVersions = externalExecutionHandoffSelectedVersionsSchema.parse(
    record.selectedVersions,
  );
  return externalExecutionHandoffSchema.parse({
    constraints: record.constraints,
    createdAt: record.createdAt.toISOString(),
    executor: record.executor,
    expectedOutput: record.expectedOutput,
    githubContext: selectedVersions.githubContext,
    handoffId: record.handoffId,
    includeWork: selectedVersions.work !== null,
    packageMarkdown: record.packageMarkdown,
    packageProducedAt: record.packageProducedAt.toISOString(),
    purpose: record.purpose,
    selectedWorkRevision: selectedVersions.work?.revision ?? null,
    status: record.status,
    workId: record.workId,
  });
}

function workSnapshot(record: typeof work.$inferSelect) {
  return externalExecutionHandoffWorkSnapshotSchema.parse({
    description: record.description,
    id: record.id,
    key: record.key,
    revision: record.revision,
    status: record.status,
    targetDate: record.targetDate,
    title: record.title,
    type: record.type,
  });
}

function handoffPayloadFingerprint(
  command: ExternalExecutionHandoffStartCommand,
) {
  return fingerprintMutationPayload({
    baseRevision: command.baseRevision,
    constraints: command.constraints,
    executor: command.executor,
    expectedOutput: command.expectedOutput,
    githubContext: command.githubContext,
    includeWork: command.includeWork,
    purpose: command.purpose,
    workId: command.workId,
  });
}

export interface DatabaseExternalExecutionHandoffOptions {
  newId?: () => string;
  now?: () => Date;
}

export function createDatabaseExternalExecutionHandoffs(
  database: Database,
  options: DatabaseExternalExecutionHandoffOptions = {},
): ExternalExecutionHandoffsAccess {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => `handoff-${crypto.randomUUID()}`);

  async function ownedWork(
    executor: Pick<Database, "select">,
    accountId: string,
    workId: string,
    lock: boolean,
  ) {
    const query = executor
      .select({ record: work })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .innerJoin(user, eq(workspace.ownerAccountId, user.id))
      .where(
        and(
          eq(work.id, workId),
          eq(user.id, accountId),
          isNull(work.archivedAt),
          isNull(project.archivedAt),
        ),
      )
      .limit(1);
    const rows = lock ? await query.for("update") : await query;
    return rows[0]?.record ?? null;
  }

  return {
    async list(accountId, workId) {
      const ownerWork = await ownedWork(database, accountId, workId, false);
      if (!ownerWork) {
        return null;
      }
      const records = await database
        .select()
        .from(workExternalExecutionHandoff)
        .where(eq(workExternalExecutionHandoff.workId, workId))
        .orderBy(
          asc(workExternalExecutionHandoff.createdAt),
          asc(workExternalExecutionHandoff.handoffId),
        );
      return records.map(toExternalExecutionHandoff);
    },

    async start(accountId, command) {
      const fingerprint = await handoffPayloadFingerprint(command);
      return database.transaction(async (transaction) => {
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          command.workId,
          true,
        );
        if (!ownerWork) {
          return null;
        }

        const [existing] = await transaction
          .select()
          .from(workExternalExecutionHandoff)
          .where(
            and(
              eq(workExternalExecutionHandoff.workId, command.workId),
              eq(
                workExternalExecutionHandoff.clientIdempotencyKey,
                command.clientIdempotencyKey,
              ),
            ),
          )
          .limit(1);
        if (existing) {
          if (existing.payloadFingerprint !== fingerprint) {
            throw new ExternalExecutionHandoffIdempotencyConflictError();
          }
          return toExternalExecutionHandoff(existing);
        }

        if (ownerWork.revision !== command.baseRevision) {
          throw new ExternalExecutionHandoffStaleWorkError();
        }

        const producedAt = now();
        const handoffId = newId();
        const snapshot = workSnapshot(ownerWork);
        const packageInput = {
          constraints: command.constraints,
          executor: command.executor,
          expectedOutput: command.expectedOutput,
          githubContext: command.githubContext,
          includeWork: command.includeWork,
          purpose: command.purpose,
          workId: command.workId,
        };
        const packageMarkdown = renderExternalExecutionHandoffPackage({
          handoffId,
          input: packageInput,
          producedAt: producedAt.toISOString(),
          work: snapshot,
        });
        const selectedVersions =
          externalExecutionHandoffSelectedVersionsSchema.parse({
            githubContext: command.githubContext,
            work: command.includeWork
              ? {
                  recordId: ownerWork.id,
                  recordType: "Work",
                  revision: ownerWork.revision,
                }
              : null,
          });
        const [created] = await transaction
          .insert(workExternalExecutionHandoff)
          .values({
            clientIdempotencyKey: command.clientIdempotencyKey,
            constraints: command.constraints,
            createdAt: producedAt,
            createdByAccountId: accountId,
            executor: command.executor,
            expectedOutput: command.expectedOutput,
            handoffId,
            packageMarkdown,
            packageProducedAt: producedAt,
            payloadFingerprint: fingerprint,
            purpose: command.purpose,
            selectedVersions,
            status: "Open",
            workId: ownerWork.id,
          })
          .returning();
        return created ? toExternalExecutionHandoff(created) : null;
      });
    },
  };
}
