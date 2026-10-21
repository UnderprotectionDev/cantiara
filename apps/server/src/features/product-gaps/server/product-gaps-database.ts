// biome-ignore-all lint/performance/noAwaitInLoops: Link rows are inserted in their stored order.
import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  buildProductGapFollowUpPlan,
  isSameProductGapFollowUpPlan,
  type ParsedConfirmProductGapFollowUpInput,
  type ParsedPreviewProductGapFollowUpInput,
  type ProductGapFollowUpSource,
  type ProductGapLinkInput,
  type ProductGapLinkKind,
  type ProductGapLinkTarget,
  type ProductGapLinkTargetType,
  type ProductGapStatus,
  type ProductGapStore,
  type ProductGapStoredRecord,
  type ProductGapTargetLive,
  type ProductGapTargetResolver,
  type ToolEscapeFilter,
  type ToolEscapeReason,
  type ToolEscapeStored,
} from "@cantiara/api/product-gaps";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import {
  productGap,
  productGapLink,
  toolEscape,
} from "@cantiara/db/schema/product-gap";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { insertWorkWithKeyAllocation } from "../../evidence/server/evidence-record-creation";
import type { FeedbackExecutor } from "../../feedback/server/feedback-database";
import {
  MutationApplyFailedError,
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createProductGaps,
  ProductGapFollowUpStaleError,
} from "./product-gaps";

type Executor = FeedbackExecutor;

const CANDIDATE_LIMIT = 500;

async function findWorkspaceId(executor: Executor, accountId: string) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

function hiddenReason(row: {
  archivedAt?: Date | null;
  status?: string;
  title: string;
  trashedAt?: Date | null;
}) {
  if (row.trashedAt) {
    return "In Trash" as const;
  }
  if (row.archivedAt || row.status === "Archived") {
    return "Archived" as const;
  }
  return null;
}

const gone: ProductGapTargetLive = {
  reason: "Permanently deleted",
  state: "broken",
};

/**
 * Live owner-record resolver of one Workspace. A Project, Work, Feature or
 * Decision is bound only when it belongs to a Project of this Workspace and is
 * still visible; nothing but its id is stored, so a title can never stand in.
 */
function createGapResolver(
  executor: Executor,
  workspaceId: string,
): ProductGapTargetResolver {
  async function row(type: ProductGapLinkTargetType, targetId: string) {
    switch (type) {
      case "Project": {
        const [found] = await executor
          .select({
            archivedAt: project.archivedAt,
            projectId: project.id,
            title: project.name,
          })
          .from(project)
          .where(
            and(eq(project.id, targetId), eq(project.workspaceId, workspaceId)),
          );
        return found ?? null;
      }
      case "Work":
      case "Feature": {
        const [found] = await executor
          .select({
            archivedAt: work.archivedAt,
            projectId: work.projectId,
            status: work.status,
            title: work.title,
            trashedAt: work.trashedAt,
            type: work.type,
          })
          .from(work)
          .innerJoin(project, eq(project.id, work.projectId))
          .where(
            and(eq(work.id, targetId), eq(project.workspaceId, workspaceId)),
          );
        // A Feature is a Work of type Feature; the two families never mix.
        return found && (found.type === "Feature") === (type === "Feature")
          ? found
          : null;
      }
      default: {
        const [found] = await executor
          .select({ projectId: decision.projectId, title: decision.title })
          .from(decision)
          .innerJoin(project, eq(project.id, decision.projectId))
          .where(
            and(
              eq(decision.id, targetId),
              eq(project.workspaceId, workspaceId),
            ),
          );
        return found ?? null;
      }
    }
  }

  async function read(
    link: ProductGapLinkInput,
  ): Promise<ProductGapTargetLive> {
    const found = await row(link.targetType, link.targetId);
    if (!found) {
      return gone;
    }
    const hidden = hiddenReason(found);
    return hidden
      ? { reason: hidden, state: "broken" }
      : { label: found.title, state: "resolved" };
  }

  return {
    bindSource: async (link) => {
      const found = await row(link.targetType, link.targetId);
      return found && !hiddenReason(found)
        ? { label: found.title, projectId: found.projectId }
        : null;
    },
    bind: async (link) => {
      const live = await read(link);
      return live.state === "resolved" ? { label: live.label } : null;
    },
    candidates: async (type): Promise<ProductGapLinkTarget[]> => {
      const plain = (rows: { id: string; title: string }[]) =>
        rows.map(({ id, title }) => ({
          label: title,
          targetId: id,
          targetType: type,
        }));
      switch (type) {
        case "Project":
          return plain(
            (
              await executor
                .select({
                  archivedAt: project.archivedAt,
                  id: project.id,
                  title: project.name,
                })
                .from(project)
                .where(eq(project.workspaceId, workspaceId))
                .orderBy(asc(project.name), asc(project.id))
                .limit(CANDIDATE_LIMIT)
            ).filter((candidate) => !candidate.archivedAt),
          );
        case "Work":
        case "Feature":
          return plain(
            (
              await executor
                .select({
                  archivedAt: work.archivedAt,
                  id: work.id,
                  status: work.status,
                  title: work.title,
                  trashedAt: work.trashedAt,
                  type: work.type,
                })
                .from(work)
                .innerJoin(project, eq(project.id, work.projectId))
                .where(eq(project.workspaceId, workspaceId))
                .orderBy(asc(work.title), asc(work.id))
                .limit(CANDIDATE_LIMIT)
            ).filter(
              (candidate) =>
                (candidate.type === "Feature") === (type === "Feature") &&
                !hiddenReason(candidate),
            ),
          );
        default:
          return plain(
            await executor
              .select({ id: decision.id, title: decision.title })
              .from(decision)
              .innerJoin(project, eq(project.id, decision.projectId))
              .where(eq(project.workspaceId, workspaceId))
              .orderBy(asc(decision.title), asc(decision.id))
              .limit(CANDIDATE_LIMIT),
          );
      }
    },
    read,
  };
}

async function toStoredGaps(
  executor: Executor,
  rows: (typeof productGap.$inferSelect)[],
): Promise<ProductGapStoredRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const linkRows = await executor
    .select()
    .from(productGapLink)
    .where(
      inArray(
        productGapLink.gapId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(productGapLink.position));
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    links: linkRows
      .filter((link) => link.gapId === row.id)
      .map((link) => ({
        createdAt: link.createdAt.toISOString(),
        id: link.id,
        kind: link.kind as ProductGapLinkKind,
        targetId: link.targetId,
        targetType: link.targetType as ProductGapLinkTargetType,
      })),
    scope: row.scope,
    status: row.status as ProductGapStatus,
    statusChangedAt: row.statusChangedAt.toISOString(),
    title: row.title,
    unmetNeed: row.unmetNeed,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

function toStoredEscape(row: typeof toolEscape.$inferSelect): ToolEscapeStored {
  return {
    gapId: row.gapId,
    id: row.id,
    intendedJob: row.intendedJob,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    reasons: row.reasons as ToolEscapeReason[],
    recordedAt: row.recordedAt.toISOString(),
    source: {
      projectId: row.projectId,
      targetId: row.sourceId,
      targetType: row.sourceType as ProductGapLinkTargetType,
    },
    tool: row.tool,
  };
}

async function findGapRow(
  executor: Executor,
  workspaceId: string,
  gapId: string,
  lock: boolean,
) {
  const query = executor
    .select()
    .from(productGap)
    .where(
      and(eq(productGap.id, gapId), eq(productGap.workspaceId, workspaceId)),
    );
  const [row] = await (lock ? query.for("update") : query);
  return row ?? null;
}

/**
 * Reads the gap and the chosen follow-up target. A Work target locks its
 * Project row (key allocation), a Feature must still be visible.
 */
async function readFollowUpSourceOf(
  executor: Executor,
  accountId: string,
  input: ParsedPreviewProductGapFollowUpInput,
  lock: boolean,
): Promise<
  | (ProductGapFollowUpSource & { projectRow?: typeof project.$inferSelect })
  | null
> {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const row = await findGapRow(executor, workspaceId, input.gapId, lock);
  if (!row) {
    return null;
  }
  const [gap] = await toStoredGaps(executor, [row]);
  if (!gap) {
    return null;
  }
  if (input.kind === "Feature relation") {
    const live = await createGapResolver(executor, workspaceId).bind({
      targetId: input.featureId,
      targetType: "Feature",
    });
    return {
      gap,
      target: live
        ? {
            feature: { id: input.featureId, label: live.label },
            kind: "Feature relation",
          }
        : null,
    };
  }
  const projectQuery = executor
    .select()
    .from(project)
    .where(
      and(
        eq(project.id, input.projectId),
        eq(project.workspaceId, workspaceId),
      ),
    );
  const [projectRow] = await (lock ? projectQuery.for("update") : projectQuery);
  return {
    gap,
    projectRow,
    target: projectRow
      ? {
          kind: "Work",
          project: {
            id: projectRow.id,
            name: projectRow.name,
            readOnly: projectRow.archivedAt !== null,
          },
        }
      : null,
  };
}

interface FollowUpValue {
  linkId: string | null;
  nextWorkKey: string | null;
}

/**
 * Atomic follow-up: the new Work (when the plan has one), its key allocation
 * and the `Follow-up` link commit together through the Mutation Contract, so a
 * retry with the same key returns the same result. The Gap row is never
 * written: status, text and revision stay as they were.
 */
async function confirmFollowUpOf(
  database: Database,
  accountId: string,
  input: ParsedConfirmProductGapFollowUpInput,
) {
  const { plan } = input;
  const previewInput: ParsedPreviewProductGapFollowUpInput =
    plan.kind === "Work"
      ? {
          gapId: input.gapId,
          kind: "Work",
          projectId: plan.targetProject.id,
          workType: plan.work.type,
        }
      : {
          featureId: plan.feature.id,
          gapId: input.gapId,
          kind: "Feature relation",
        };
  const adapter: MutationDatabaseTargetAdapter<FollowUpValue> = {
    async find(executor, id, lock) {
      const source = await readFollowUpSourceOf(
        executor,
        accountId,
        previewInput,
        lock,
      );
      if (!source) {
        return null;
      }
      const [existing] = await executor
        .select({ gapId: productGapLink.gapId })
        .from(productGapLink)
        .where(eq(productGapLink.id, id));
      if (existing && existing.gapId !== input.gapId) {
        return null;
      }
      const key =
        source.projectRow && !source.projectRow.archivedAt
          ? `${source.projectRow.shortCode}-${source.projectRow.workCount + 1}`
          : null;
      return {
        id,
        revision: existing ? 1 : 0,
        value: {
          linkId: existing ? id : null,
          nextWorkKey: key,
        },
      };
    },
    async update(executor, update) {
      const source = await readFollowUpSourceOf(
        executor,
        accountId,
        previewInput,
        true,
      );
      // The exact previewed plan, re-derived under the Gap and Project locks.
      if (
        !(
          source?.target &&
          isSameProductGapFollowUpPlan(
            plan,
            buildProductGapFollowUpPlan(
              { gap: source.gap, target: source.target },
              plan.kind === "Work" ? plan.work.type : undefined,
            ),
          )
        ) ||
        (source.target.kind === "Work" && source.target.project.readOnly)
      ) {
        throw new MutationConflictError(input.gapId);
      }
      let targetId = plan.kind === "Feature relation" ? plan.feature.id : "";
      if (plan.kind === "Work" && source.projectRow && input.workId) {
        const key = await insertWorkWithKeyAllocation(
          executor,
          source.projectRow,
          {
            committedAt: update.committedAt,
            description: plan.work.description,
            idempotencyKey: update.idempotencyKey.key,
            payloadFingerprint: update.payloadFingerprint,
            title: plan.work.title,
            type: plan.work.type,
            workId: input.workId,
          },
        );
        if (key !== update.nextValue.nextWorkKey) {
          throw new MutationConflictError(input.gapId);
        }
        targetId = input.workId;
      }
      await executor.insert(productGapLink).values({
        createdAt: update.committedAt,
        gapId: input.gapId,
        id: update.targetId,
        kind: "Follow-up",
        position: source.gap.links.length,
        targetId,
        targetType: plan.kind === "Work" ? "Work" : "Feature",
      });
      return {
        id: update.targetId,
        revision: update.expectedRevision + 1,
        value: update.nextValue,
      };
    },
  };
  const mutation = createDatabaseMutationContract<FollowUpValue>(database, {
    target: adapter,
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
          operation: "confirmProductGapFollowUp",
          ...input,
        } as MutationPayload,
      },
      ({ currentValue }) => {
        if (currentValue.linkId) {
          throw new MutationConflictError(input.id);
        }
        if (plan.kind === "Work" && !currentValue.nextWorkKey) {
          throw new MutationConflictError(input.id);
        }
        return {
          linkId: input.id,
          nextWorkKey: plan.kind === "Work" ? currentValue.nextWorkKey : null,
        };
      },
    );
    return {
      linkId: input.id,
      workId: input.workId ?? null,
      workKey: receipt.nextValue.nextWorkKey,
    };
  } catch (error) {
    if (error instanceof MutationTargetNotFoundError) {
      return null;
    }
    throw rethrowFollowUpError(error, input.gapId);
  }
}

function rethrowFollowUpError(error: unknown, gapId: string): unknown {
  const cause = error instanceof MutationApplyFailedError ? error.cause : error;
  return cause instanceof MutationConflictError ||
    cause instanceof MutationStaleBaseRevisionError
    ? new ProductGapFollowUpStaleError(gapId, { cause })
    : error;
}

/**
 * PostgreSQL adapter of the Product Gaps seam. It reads `workspace_product_gap`
 * and its links and writes them; a status change updates the Gap row alone, so
 * no Project, Work, Feature or Decision table is touched. Only a confirmed
 * follow-up creates a Work, through the Mutation Contract.
 */
export function createDatabaseProductGapStore(
  database: Database,
): ProductGapStore {
  return {
    confirmFollowUp: (accountId, input) =>
      confirmFollowUpOf(database, accountId, input),

    readFollowUpSource: (accountId, input) =>
      database.transaction(
        async (executor) => {
          const source = await readFollowUpSourceOf(
            executor,
            accountId,
            input,
            false,
          );
          return source ? { gap: source.gap, target: source.target } : null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      ),

    run(accountId, mode, unit) {
      return database.transaction(
        async (executor) => {
          const workspaceId = await findWorkspaceId(executor, accountId);
          if (!workspaceId) {
            return null;
          }
          return await unit({
            findGap: async (gapId, lock) => {
              const row = await findGapRow(executor, workspaceId, gapId, lock);
              return row
                ? ((await toStoredGaps(executor, [row]))[0] ?? null)
                : null;
            },
            insertEscape: async (event) => {
              await executor.insert(toolEscape).values({
                gapId: event.gapId,
                id: event.id,
                intendedJob: event.intendedJob,
                note: event.note,
                occurredAt: new Date(event.occurredAt),
                projectId: event.source.projectId,
                reasons: event.reasons,
                recordedAt: new Date(event.recordedAt),
                sourceId: event.source.targetId,
                sourceType: event.source.targetType,
                tool: event.tool,
              });
            },
            insertGap: async (record) => {
              await executor.insert(productGap).values({
                createdAt: new Date(record.createdAt),
                id: record.id,
                scope: record.scope,
                status: record.status,
                statusChangedAt: new Date(record.statusChangedAt),
                title: record.title,
                unmetNeed: record.unmetNeed,
                updatedAt: new Date(record.updatedAt),
                workspaceId,
              });
              for (const [position, link] of record.links.entries()) {
                await executor.insert(productGapLink).values({
                  createdAt: new Date(link.createdAt),
                  gapId: record.id,
                  id: link.id,
                  kind: link.kind,
                  position,
                  targetId: link.targetId,
                  targetType: link.targetType,
                });
              }
            },
            // Only this Workspace's Gaps own events; no row is ever updated.
            listEscapes: async (filter: ToolEscapeFilter) =>
              (
                await executor
                  .select({ event: toolEscape })
                  .from(toolEscape)
                  .innerJoin(productGap, eq(productGap.id, toolEscape.gapId))
                  .where(
                    and(
                      eq(productGap.workspaceId, workspaceId),
                      filter.gapId
                        ? eq(toolEscape.gapId, filter.gapId)
                        : undefined,
                      filter.tool
                        ? sql`lower(${toolEscape.tool}) = lower(${filter.tool})`
                        : undefined,
                      filter.reason
                        ? sql`${filter.reason} = any(${toolEscape.reasons})`
                        : undefined,
                      filter.projectId
                        ? eq(toolEscape.projectId, filter.projectId)
                        : undefined,
                    ),
                  )
                  .orderBy(desc(toolEscape.occurredAt), asc(toolEscape.id))
              ).map(({ event }) => toStoredEscape(event)),
            listGaps: async () =>
              await toStoredGaps(
                executor,
                await executor
                  .select()
                  .from(productGap)
                  .where(eq(productGap.workspaceId, workspaceId))
                  .orderBy(desc(productGap.createdAt), asc(productGap.id)),
              ),
            resolver: createGapResolver(executor, workspaceId),
            // The status moves only while it is still the one the caller saw,
            // and only the Gap row is written.
            setStatus: async (gapId, expected, to, changedAt) => {
              const updated = await executor
                .update(productGap)
                .set({
                  status: to,
                  statusChangedAt: new Date(changedAt),
                  updatedAt: new Date(changedAt),
                })
                .where(
                  and(
                    eq(productGap.id, gapId),
                    eq(productGap.workspaceId, workspaceId),
                    eq(productGap.status, expected),
                  ),
                )
                .returning({ id: productGap.id });
              return updated.length === 1;
            },
          });
        },
        mode === "read"
          ? { accessMode: "read only", isolationLevel: "repeatable read" }
          : undefined,
      );
    },
  };
}

export function createDatabaseProductGaps(database: Database) {
  return createProductGaps(createDatabaseProductGapStore(database));
}
