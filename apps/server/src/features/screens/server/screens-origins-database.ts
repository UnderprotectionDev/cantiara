import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  buildConvertAndBindPlan,
  findWireframeBlock,
  isSameConvertAndBindPlan,
  type ParsedConfirmConvertAndBindInput,
  type ScreenBlockOriginRecord,
  type ScreenBlockOriginRow,
  type ScreenTemplateRecord,
} from "@cantiara/api/screen-origins";
import { instantiateTemplateDocument } from "@cantiara/api/screen-templates";
import {
  type ScreenRecord,
  type ScreenStore,
  screenLifecycleOf,
} from "@cantiara/api/screens";
import type { WireframeLinkedContent } from "@cantiara/api/wireframe-document";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import {
  screen,
  screenBlockOrigin,
  screenLinkedBlock,
  screenWireframeTemplate,
  screenWireframeVersion,
} from "@cantiara/db/schema/screen";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createConvertedRecord } from "../../evidence/server/evidence-record-creation";
import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import {
  ScreenConversionStaleError,
  ScreenProjectReadOnlyError,
} from "./screens";

type Executor = FeedbackExecutor;

async function openProject(
  executor: Executor,
  accountId: string,
  projectId: string,
) {
  const owned = await findOwnedProject(executor, accountId, projectId);
  if (owned?.archivedAt) {
    throw new ScreenProjectReadOnlyError(owned.id);
  }
  return owned;
}

async function lockScreen(
  executor: Executor,
  projectId: string,
  screenId: string,
) {
  const [current] = await executor
    .select()
    .from(screen)
    .where(and(eq(screen.id, screenId), eq(screen.projectId, projectId)))
    .for("update");
  return current ?? null;
}

function toOrigin(
  row: typeof screenBlockOrigin.$inferSelect,
): ScreenBlockOriginRecord {
  return {
    actorId: row.actorId,
    blockId: row.blockId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    projectId: row.projectId,
    screenId: row.screenId,
    supersededAt: row.supersededAt?.toISOString() ?? null,
    supersedesId: row.supersedesId,
    targetRecordId: row.targetRecordId,
    targetType: row.targetType as ScreenBlockOriginRecord["targetType"],
    wireframeVersion: row.wireframeVersion,
  };
}

function toTemplate(
  row: typeof screenWireframeTemplate.$inferSelect,
): ScreenTemplateRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    document: row.document,
    id: row.id,
    name: row.name,
  };
}

async function versionRow(
  executor: Executor,
  screenId: string,
  version: number,
) {
  const [row] = await executor
    .select()
    .from(screenWireframeVersion)
    .where(
      and(
        eq(screenWireframeVersion.screenId, screenId),
        eq(screenWireframeVersion.version, version),
      ),
    );
  return row ?? null;
}

/** Throws `ScreenConversionStaleError` unless the previewed plan still holds. */
function assertCurrentPlan(
  plan: ParsedConfirmConvertAndBindInput["plan"],
  document: unknown,
  owner: { id: string; name: string },
  current: { id: string; title: string },
) {
  const rederived = tryBuildPlan(plan, document, owner, current);
  if (!(rederived && isSameConvertAndBindPlan(plan, rederived))) {
    throw new ScreenConversionStaleError(current.id);
  }
}

function tryBuildPlan(
  plan: ParsedConfirmConvertAndBindInput["plan"],
  document: unknown,
  owner: { id: string; name: string },
  current: { id: string; title: string },
) {
  try {
    return buildConvertAndBindPlan({
      document,
      input: {
        blockId: plan.originLocation.blockId,
        projectId: owner.id,
        screenId: current.id,
        targetType: plan.targetType,
        title: plan.title,
        wireframeVersion: plan.originLocation.wireframeVersion,
        workType: plan.workType ?? undefined,
      },
      project: { id: owner.id, name: owner.name },
      screen: { id: current.id, title: current.title },
    });
  } catch {
    // A block that is gone or an invalid document is a stale plan, not a result.
    return null;
  }
}

type RecordTable =
  | typeof work
  | typeof decision
  | typeof risk
  | typeof openQuestion;

/** Live titles keyed by record id, read only inside the account's own Workspaces. */
async function readTitles(
  executor: Executor,
  accountId: string,
  type: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const table: RecordTable | null =
    {
      Decision: decision,
      "Open Question": openQuestion,
      Risk: risk,
      Work: work,
    }[type] ?? null;
  if (!table) {
    return new Map();
  }
  const rows = await executor
    .select({ id: table.id, title: table.title })
    .from(table)
    .innerJoin(project, eq(project.id, table.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(inArray(table.id, ids), eq(workspace.ownerAccountId, accountId)),
    );
  return new Map(rows.map(({ id, title }) => [id, title]));
}

/**
 * PostgreSQL side of `Convert and Bind`, Wireframe templates and live cards.
 * The only main-record write is `createConvertedRecord`, the same boundary
 * Evidence conversions use; everything else touches Screen tables.
 */
export function createDatabaseOriginStore(
  database: Database,
): Pick<
  ScreenStore,
  | "convertBlock"
  | "createScreenFromTemplate"
  | "findTemplate"
  | "listOrigins"
  | "listTemplates"
  | "projectSummary"
  | "readLiveCards"
  | "rebindOrigin"
  | "saveTemplate"
> {
  return {
    convertBlock(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const [existing] = await executor
          .select()
          .from(screenBlockOrigin)
          .where(eq(screenBlockOrigin.id, input.originId));
        if (existing) {
          // A retry with the same identity returns the same origin and record.
          if (existing.screenId !== input.screenId) {
            throw new ScreenConversionStaleError(input.screenId);
          }
          return toOrigin(existing);
        }
        const current = await lockScreen(executor, owned.id, input.screenId);
        if (!current || current.trashedAt !== null) {
          return null;
        }
        const { wireframeVersion } = input.plan.originLocation;
        const version = await versionRow(
          executor,
          current.id,
          wireframeVersion,
        );
        if (!version) {
          throw new ScreenConversionStaleError(current.id);
        }
        // The exact previewed plan, re-derived under the Project and Screen locks.
        assertCurrentPlan(input.plan, version.document, owned.project, current);
        const now = new Date();
        await createConvertedRecord(executor, owned.project, {
          body: input.plan.body,
          committedAt: now,
          idempotencyKey: input.originId,
          origin: {
            componentId: input.plan.originLocation.blockId,
            ownerRecordId: current.id,
            sourceVersion: String(wireframeVersion),
          },
          payloadFingerprint: await fingerprintMutationPayload({
            operation: "convertAndBind",
            originId: input.originId,
            recordId: input.recordId,
          }),
          recordId: input.recordId,
          title: input.plan.title,
          type: input.plan.targetType,
          workType: input.plan.workType,
        });
        const [created] = await executor
          .insert(screenBlockOrigin)
          .values({
            actorId: accountId,
            blockId: input.plan.originLocation.blockId,
            createdAt: now,
            id: input.originId,
            projectId: owned.id,
            screenId: current.id,
            targetRecordId: input.recordId,
            targetType: input.plan.targetType,
            wireframeVersion,
          })
          .returning();
        if (!created) {
          throw new Error("Origin was not created.");
        }
        return toOrigin(created);
      });
    },

    createScreenFromTemplate(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const definitions = Object.values(
          (
            input.template.document as {
              linkedDefinitions: Record<
                string,
                { content: WireframeLinkedContent; id: string; name: string }
              >;
            }
          ).linkedDefinitions,
        );
        const now = new Date();
        // Fresh Project-scoped definitions: the new Screen shares none with the source.
        const idMap = new Map<string, string>();
        for (const definition of definitions) {
          idMap.set(definition.id, crypto.randomUUID());
        }
        await Promise.all(
          definitions.map((definition) =>
            executor.insert(screenLinkedBlock).values({
              content: definition.content,
              createdAt: now,
              id: idMap.get(definition.id) ?? crypto.randomUUID(),
              name: definition.name,
              projectId: owned.id,
              revision: 1,
              updatedAt: now,
            }),
          ),
        );
        const [created] = await executor
          .insert(screen)
          .values({
            createdAt: now,
            id: crypto.randomUUID(),
            projectId: owned.id,
            revision: 1,
            title: input.title,
            updatedAt: now,
          })
          .returning();
        if (!created) {
          throw new Error("Screen was not created.");
        }
        const [first] = await executor
          .insert(screenWireframeVersion)
          .values({
            createdAt: now,
            document: instantiateTemplateDocument(
              input.template.document,
              idMap,
            ) as unknown as Record<string, unknown>,
            id: crypto.randomUUID(),
            screenId: created.id,
            version: 1,
          })
          .returning();
        if (!first) {
          throw new Error("Wireframe version was not created.");
        }
        const record: ScreenRecord = {
          createdAt: created.createdAt.toISOString(),
          id: created.id,
          lifecycle: screenLifecycleOf(created),
          projectId: created.projectId,
          revision: created.revision,
          title: created.title,
          updatedAt: created.updatedAt.toISOString(),
          wireframeVersions: [
            {
              createdAt: first.createdAt.toISOString(),
              id: first.id,
              version: first.version,
            },
          ],
        };
        return record;
      });
    },

    findTemplate(accountId, projectId, templateId) {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const [row] = await executor
            .select()
            .from(screenWireframeTemplate)
            .where(
              and(
                eq(screenWireframeTemplate.id, templateId),
                eq(screenWireframeTemplate.workspaceId, owned.workspaceId),
              ),
            );
          return row ? toTemplate(row) : null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    listOrigins(accountId, projectId, screenId) {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const rows = await executor
            .select()
            .from(screenBlockOrigin)
            .where(
              and(
                eq(screenBlockOrigin.screenId, screenId),
                eq(screenBlockOrigin.projectId, owned.id),
              ),
            )
            .orderBy(
              asc(screenBlockOrigin.createdAt),
              asc(screenBlockOrigin.id),
            );
          const titles = new Map(
            await Promise.all(
              [...new Set(rows.map((row) => row.targetType))].map(
                async (type) =>
                  [
                    type,
                    await readTitles(
                      executor,
                      accountId,
                      type,
                      rows
                        .filter((row) => row.targetType === type)
                        .map((row) => row.targetRecordId),
                    ),
                  ] as const,
              ),
            ),
          );
          return rows.map(
            (row): ScreenBlockOriginRow => ({
              ...toOrigin(row),
              targetTitle:
                titles.get(row.targetType)?.get(row.targetRecordId) ?? null,
            }),
          );
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    listTemplates(accountId, projectId) {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const rows = await executor
            .select()
            .from(screenWireframeTemplate)
            .where(eq(screenWireframeTemplate.workspaceId, owned.workspaceId))
            .orderBy(
              asc(screenWireframeTemplate.name),
              desc(screenWireframeTemplate.createdAt),
            );
          return rows.map(toTemplate);
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    projectSummary(accountId, projectId) {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          return owned ? { id: owned.id, name: owned.project.name } : null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    readLiveCards(accountId, refs) {
      return database.transaction(
        async (executor) => {
          const grouped = await Promise.all(
            [...new Set(refs.map((ref) => ref.recordType))].map(
              async (type) => {
                const ids = refs
                  .filter((ref) => ref.recordType === type)
                  .map((ref) => ref.recordId);
                const titles = await readTitles(executor, accountId, type, ids);
                return ids.map((recordId) => ({
                  recordId,
                  recordType: type,
                  title: titles.get(recordId) ?? null,
                }));
              },
            ),
          );
          const results = grouped.flat();
          return results;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    rebindOrigin(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const current = await lockScreen(
          executor,
          owned.id,
          input.plan.screenId,
        );
        if (!current || current.trashedAt !== null) {
          return null;
        }
        const [old] = await executor
          .select()
          .from(screenBlockOrigin)
          .where(
            and(
              eq(screenBlockOrigin.id, input.plan.originId),
              eq(screenBlockOrigin.screenId, current.id),
            ),
          )
          .for("update");
        if (!old || old.supersededAt !== null) {
          throw new ScreenConversionStaleError(current.id);
        }
        const target = await versionRow(
          executor,
          current.id,
          input.plan.to.wireframeVersion,
        );
        if (
          !(
            target && findWireframeBlock(target.document, input.plan.to.blockId)
          )
        ) {
          throw new ScreenConversionStaleError(current.id);
        }
        const now = new Date();
        // The old origin stays readable; only its "current" mark moves.
        await executor
          .update(screenBlockOrigin)
          .set({ supersededAt: now })
          .where(eq(screenBlockOrigin.id, old.id));
        const [created] = await executor
          .insert(screenBlockOrigin)
          .values({
            actorId: accountId,
            blockId: input.plan.to.blockId,
            createdAt: now,
            id: input.newOriginId,
            projectId: owned.id,
            screenId: current.id,
            supersedesId: old.id,
            targetRecordId: old.targetRecordId,
            targetType: old.targetType,
            wireframeVersion: input.plan.to.wireframeVersion,
          })
          .returning();
        return created ? toOrigin(created) : null;
      });
    },

    saveTemplate(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await findReadableProject(
          executor,
          accountId,
          input.projectId,
        );
        if (!owned) {
          return null;
        }
        const [created] = await executor
          .insert(screenWireframeTemplate)
          .values({
            createdAt: new Date(),
            document: input.document as Record<string, unknown>,
            id: crypto.randomUUID(),
            name: input.name,
            workspaceId: owned.workspaceId,
          })
          .returning();
        return created ? toTemplate(created) : null;
      });
    },
  };
}
