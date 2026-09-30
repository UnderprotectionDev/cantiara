import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { accountLocalDate } from "@cantiara/api/backlog";
import {
  type CreateFocusPeriodInput,
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
  type FocusPeriodAccess,
  FocusPeriodConflictError,
  type FocusPeriodDecisionInput,
  type FocusPeriodEvaluationInput,
  type FocusPeriodFollowUpLinkInput,
  type FocusPeriodRecord,
  type FocusPeriodSnapshotWork,
  FocusPeriodUnavailableError,
} from "@cantiara/api/focus-period";
import {
  projectWorkDependencies,
  type RelationEndpointView,
  type RelationView,
} from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import {
  focusPeriod,
  focusPeriodActiveWork,
  focusPeriodFollowUpWork,
  focusPeriodLeftoverDecision,
  focusPeriodMembership,
} from "@cantiara/db/schema/focus-period";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";

type FocusPeriodReadExecutor = Pick<Database, "select">;
type FocusPeriodMutationExecutor = Pick<
  Database,
  "execute" | "insert" | "select" | "update"
>;

type StoredCloseSnapshotWork = FocusPeriodSnapshotWork & {
  inCloseScope?: false;
};
type StoredCloseSnapshot = StoredCloseSnapshotWork[];

function readStoredCloseSnapshot(
  snapshot: FocusPeriodSnapshotWork[] | null,
): StoredCloseSnapshot | null {
  return snapshot as StoredCloseSnapshot | null;
}

function publicCloseSnapshot(
  snapshot: StoredCloseSnapshot | null,
): FocusPeriodSnapshotWork[] | null {
  return snapshot?.filter((item) => item.inCloseScope !== false) ?? null;
}

export function createDatabaseFocusPeriod(
  database: Database,
  now: () => Date = () => new Date(),
): FocusPeriodAccess {
  async function scope(accountId: string) {
    const [record] = await database
      .select({ id: workspace.id, timeZone: accountPreferences.timeZone })
      .from(workspace)
      .leftJoin(
        accountPreferences,
        eq(accountPreferences.accountId, workspace.ownerAccountId),
      )
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    if (!record) {
      throw new FocusPeriodUnavailableError("Workspace is unavailable.");
    }
    return {
      workspaceId: record.id,
      today: accountLocalDate(
        now(),
        record.timeZone ?? DEFAULT_ACCOUNT_PREFERENCES.timeZone,
      ),
    };
  }

  async function ownedPeriod(workspaceId: string, periodId: string) {
    const [period] = await database
      .select()
      .from(focusPeriod)
      .where(
        and(
          eq(focusPeriod.id, periodId),
          eq(focusPeriod.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!period) {
      throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
    }
    return period;
  }

  function worksFor(workspaceId: string, includeInactive = false) {
    return database
      .select({
        id: work.id,
        key: work.key,
        projectId: project.id,
        projectName: project.name,
        status: work.status,
        title: work.title,
        type: work.type,
      })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        includeInactive
          ? eq(project.workspaceId, workspaceId)
          : and(
              eq(project.workspaceId, workspaceId),
              isNull(work.trashedAt),
              isNull(work.archivedAt),
            ),
      )
      .orderBy(asc(project.name), asc(work.number));
  }

  function snapshotWorks(
    executor: FocusPeriodReadExecutor,
    workspaceId: string,
    ids: string[],
  ) {
    if (!ids.length) {
      return [];
    }
    return executor
      .select({
        closureResult: work.closureResult,
        id: work.id,
        key: work.key,
        projectId: project.id,
        projectName: project.name,
        status: work.status,
        title: work.title,
      })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(and(eq(project.workspaceId, workspaceId), inArray(work.id, ids)))
      .orderBy(asc(project.name), asc(work.number));
  }

  async function currentIds(periodId: string) {
    const rows = await database
      .select({ workId: focusPeriodMembership.workId })
      .from(focusPeriodMembership)
      .where(
        and(
          eq(focusPeriodMembership.periodId, periodId),
          isNull(focusPeriodMembership.removedAt),
        ),
      );
    return rows.map((row) => row.workId);
  }

  async function assertNoOtherActiveMembership(
    executor: FocusPeriodReadExecutor,
    periodId: string,
    workId: string,
  ) {
    const [activeMembership] = await executor
      .select({ periodId: focusPeriodActiveWork.periodId })
      .from(focusPeriodActiveWork)
      .where(
        and(
          eq(focusPeriodActiveWork.workId, workId),
          ne(focusPeriodActiveWork.periodId, periodId),
        ),
      )
      .limit(1);
    if (activeMembership) {
      throw new FocusPeriodConflictError(
        FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
      );
    }
  }

  async function lockWorkAdvisory(
    executor: FocusPeriodMutationExecutor,
    workIds: readonly string[],
  ) {
    for (const workId of [...new Set(workIds)].sort()) {
      // biome-ignore lint/performance/noAwaitInLoops: Advisory locks must be acquired in a stable order on one transaction connection.
      await executor.execute(
        sql`select pg_advisory_xact_lock(hashtext(${workId}))`,
      );
    }
  }

  async function lockMovePeriods(
    executor: FocusPeriodMutationExecutor,
    workspaceId: string,
    targetPeriodId: string,
    workId: string,
  ) {
    await lockWorkAdvisory(executor, [workId]);
    const [activeMembership] = await executor
      .select({ periodId: focusPeriodActiveWork.periodId })
      .from(focusPeriodActiveWork)
      .where(eq(focusPeriodActiveWork.workId, workId))
      .limit(1);
    const periodIds = [
      ...new Set(
        [targetPeriodId, activeMembership?.periodId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const lockedPeriods = await executor
      .select()
      .from(focusPeriod)
      .where(
        and(
          eq(focusPeriod.workspaceId, workspaceId),
          inArray(focusPeriod.id, periodIds),
        ),
      )
      .orderBy(asc(focusPeriod.id))
      .for("update");
    const target = lockedPeriods.find((period) => period.id === targetPeriodId);
    if (!target) {
      throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
    }
    if (target.status !== "Active") {
      throw new FocusPeriodConflictError(
        "Move requires an Active Focus Period.",
      );
    }
    if (activeMembership?.periodId === targetPeriodId) {
      return null;
    }
    if (!activeMembership) {
      throw new FocusPeriodConflictError(
        "Work is not in another Active Focus Period.",
      );
    }
    const source = lockedPeriods.find(
      (period) => period.id === activeMembership.periodId,
    );
    if (source?.status !== "Active") {
      throw new FocusPeriodConflictError(
        "Work is not in another Active Focus Period.",
      );
    }
    return { sourcePeriodId: source.id, targetPeriodId: target.id };
  }

  async function endMoveSourceMembership(
    executor: FocusPeriodMutationExecutor,
    sourcePeriodId: string,
    workId: string,
    timestamp: Date,
  ) {
    const [sourceMembership] = await executor
      .select({ id: focusPeriodMembership.id })
      .from(focusPeriodMembership)
      .where(
        and(
          eq(focusPeriodMembership.periodId, sourcePeriodId),
          eq(focusPeriodMembership.workId, workId),
          isNull(focusPeriodMembership.removedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!sourceMembership) {
      throw new FocusPeriodConflictError(
        "Work is not in another Active Focus Period.",
      );
    }
    const removed = await executor
      .update(focusPeriodMembership)
      .set({ removedAt: timestamp })
      .where(
        and(
          eq(focusPeriodMembership.id, sourceMembership.id),
          isNull(focusPeriodMembership.removedAt),
        ),
      )
      .returning({ id: focusPeriodMembership.id });
    if (!removed.length) {
      throw new FocusPeriodConflictError(
        "Work is not in another Active Focus Period.",
      );
    }
  }

  async function transferActiveMembership(
    executor: FocusPeriodMutationExecutor,
    sourcePeriodId: string,
    targetPeriodId: string,
    workId: string,
  ) {
    const moved = await executor
      .update(focusPeriodActiveWork)
      .set({ periodId: targetPeriodId })
      .where(
        and(
          eq(focusPeriodActiveWork.workId, workId),
          eq(focusPeriodActiveWork.periodId, sourcePeriodId),
        ),
      )
      .returning({ workId: focusPeriodActiveWork.workId });
    if (!moved.length) {
      throw new FocusPeriodConflictError(
        "Work is not in another Active Focus Period.",
      );
    }
  }

  async function assertNoOverlappingMembership(
    executor: FocusPeriodReadExecutor,
    period: typeof focusPeriod.$inferSelect,
    workId: string,
  ) {
    const [overlapping] = await executor
      .select({ id: focusPeriodMembership.id })
      .from(focusPeriodMembership)
      .innerJoin(
        focusPeriod,
        eq(focusPeriodMembership.periodId, focusPeriod.id),
      )
      .where(
        and(
          eq(focusPeriodMembership.workId, workId),
          isNull(focusPeriodMembership.removedAt),
          eq(focusPeriod.workspaceId, period.workspaceId),
          ne(focusPeriod.id, period.id),
          inArray(focusPeriod.status, ["Planned", "Active"]),
          lte(focusPeriod.startDate, period.endDate),
          gte(focusPeriod.endDate, period.startDate),
        ),
      )
      .limit(1);
    if (overlapping) {
      throw new FocusPeriodConflictError(
        FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
      );
    }
  }

  async function claimActiveWork(
    executor: FocusPeriodMutationExecutor,
    periodId: string,
    workId: string,
  ) {
    const claimed = await executor
      .insert(focusPeriodActiveWork)
      .values({ periodId, workId })
      .onConflictDoNothing()
      .returning({ workId: focusPeriodActiveWork.workId });
    if (!claimed.length) {
      throw new FocusPeriodConflictError(
        FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
      );
    }
  }

  async function addMembership(
    executor: FocusPeriodMutationExecutor,
    workspaceId: string,
    periodId: string,
    workId: string,
  ) {
    const [period] = await executor
      .select()
      .from(focusPeriod)
      .where(
        and(
          eq(focusPeriod.id, periodId),
          eq(focusPeriod.workspaceId, workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!period) {
      throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
    }
    if (period.status !== "Planned" && period.status !== "Active") {
      throw new FocusPeriodConflictError("Focus Period is no longer open.");
    }
    const existing = await executor
      .select({ id: focusPeriodMembership.id })
      .from(focusPeriodMembership)
      .where(
        and(
          eq(focusPeriodMembership.periodId, periodId),
          eq(focusPeriodMembership.workId, workId),
          isNull(focusPeriodMembership.removedAt),
        ),
      )
      .limit(1);
    if (existing.length) {
      return;
    }
    if (period.status === "Active") {
      await assertNoOtherActiveMembership(executor, periodId, workId);
    }
    await assertNoOverlappingMembership(executor, period, workId);
    if (period.status === "Active") {
      await claimActiveWork(executor, periodId, workId);
    }
    await executor.insert(focusPeriodMembership).values({
      id: crypto.randomUUID(),
      joinedAt: now(),
      periodId,
      workId,
    });
  }

  async function activate(
    workspaceId: string,
    periodId: string,
    today: string,
  ) {
    await database.transaction(async (tx) => {
      const [period] = await tx
        .select()
        .from(focusPeriod)
        .where(
          and(
            eq(focusPeriod.id, periodId),
            eq(focusPeriod.workspaceId, workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (period?.status !== "Planned" || period.startDate > today) {
        return;
      }
      const memberships = await tx
        .select({ workId: focusPeriodMembership.workId })
        .from(focusPeriodMembership)
        .where(
          and(
            eq(focusPeriodMembership.periodId, periodId),
            isNull(focusPeriodMembership.removedAt),
          ),
        );
      const ids = memberships.map(({ workId }) => workId);
      const snapshot = await snapshotWorks(tx, workspaceId, ids);
      if (ids.length) {
        const claimed = await tx
          .insert(focusPeriodActiveWork)
          .values(ids.map((workId) => ({ workId, periodId })))
          .onConflictDoNothing()
          .returning({ workId: focusPeriodActiveWork.workId });
        if (claimed.length !== ids.length) {
          await tx
            .delete(focusPeriodActiveWork)
            .where(eq(focusPeriodActiveWork.periodId, periodId));
          return;
        }
      }
      await tx
        .update(focusPeriod)
        .set({ status: "Active", startedAt: now(), startSnapshot: snapshot })
        .where(eq(focusPeriod.id, periodId));
    });
  }

  async function sync(workspaceId: string, today: string) {
    const planned = await database
      .select({ id: focusPeriod.id })
      .from(focusPeriod)
      .where(
        and(
          eq(focusPeriod.workspaceId, workspaceId),
          eq(focusPeriod.status, "Planned"),
        ),
      )
      .orderBy(asc(focusPeriod.startDate), asc(focusPeriod.id));
    for (const period of planned) {
      // biome-ignore lint/performance/noAwaitInLoops: Activation must claim Work in a stable period order.
      await activate(workspaceId, period.id, today);
    }
  }

  async function present(
    workspaceId: string,
    periodId: string,
  ): Promise<FocusPeriodRecord> {
    const period = await ownedPeriod(workspaceId, periodId);
    const ids = await currentIds(periodId);
    const selected = new Set(ids);
    const works = await worksFor(workspaceId, true);
    const availableWorks = await worksFor(workspaceId);
    const members = works.filter((item) => selected.has(item.id));
    const memberById = new Map(members.map((item) => [item.id, item]));
    const relationRows = ids.length
      ? await database
          .select({
            blockingResolutionNote: workRelation.blockingResolutionNote,
            blockingResolvedAt: workRelation.blockingResolvedAt,
            blockingStatus: workRelation.blockingStatus,
            createdAt: workRelation.createdAt,
            id: workRelation.id,
            revision: workRelation.revision,
            sourceWorkId: workRelation.sourceWorkId,
            targetRecordId: workRelation.targetRecordId,
          })
          .from(workRelation)
          .where(
            and(
              isNull(workRelation.deletedAt),
              eq(workRelation.kind, "Blocks"),
              eq(workRelation.sourceRecordType, "Work"),
              eq(workRelation.targetRecordType, "Work"),
              inArray(workRelation.blockingStatus, ["Active", "Resolved"]),
              inArray(workRelation.sourceWorkId, ids),
              inArray(workRelation.targetRecordId, ids),
            ),
          )
      : [];
    const dependencyRelations: RelationView[] = relationRows.flatMap((row) => {
      const source = memberById.get(row.sourceWorkId);
      const target = memberById.get(row.targetRecordId);
      if (!(source && target)) {
        return [];
      }
      const endpoint = (item: (typeof members)[number]) =>
        ({
          broken: null,
          key: item.key,
          label: item.title,
          originPosition: null,
          projectId: item.projectId,
          recordId: item.id,
          recordType: "Work",
          status: item.status as RelationEndpointView["status"],
          title: item.title,
          workType: item.type as RelationEndpointView["workType"],
        }) satisfies RelationEndpointView;
      return [
        {
          blockingHistory: [],
          blockingResolutionNote: row.blockingResolutionNote,
          blockingResolvedAt: row.blockingResolvedAt?.toISOString() ?? null,
          blockingStatus: row.blockingStatus as RelationView["blockingStatus"],
          createdAt: row.createdAt.toISOString(),
          direction: "outgoing",
          id: row.id,
          inverseLabel: "Blocked by",
          kind: "Blocks",
          label: "Blocks",
          revision: row.revision,
          source: endpoint(source),
          target: endpoint(target),
        },
      ];
    });
    const dependencies = projectWorkDependencies(dependencyRelations);
    const followUpRows = await database
      .select({
        id: work.id,
        key: work.key,
        learning: focusPeriodFollowUpWork.learning,
        learningText: focusPeriodFollowUpWork.learningText,
        projectId: project.id,
        projectName: project.name,
        status: work.status,
        title: work.title,
      })
      .from(focusPeriodFollowUpWork)
      .innerJoin(work, eq(work.id, focusPeriodFollowUpWork.workId))
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        and(
          eq(focusPeriodFollowUpWork.periodId, periodId),
          eq(project.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(focusPeriodFollowUpWork.createdAt), asc(work.number));
    const membershipHistory = period.closeSnapshot
      ? await database
          .select({
            joinedAt: focusPeriodMembership.joinedAt,
            removedAt: focusPeriodMembership.removedAt,
            workId: focusPeriodMembership.workId,
          })
          .from(focusPeriodMembership)
          .where(eq(focusPeriodMembership.periodId, periodId))
      : [];
    const storedCloseSnapshot = readStoredCloseSnapshot(period.closeSnapshot);
    const closeSnapshot = publicCloseSnapshot(storedCloseSnapshot);
    const transientCloseSnapshot =
      storedCloseSnapshot?.filter((item) => item.inCloseScope === false) ?? [];
    const closeComparison =
      period.status === "Closed" &&
      period.startSnapshot &&
      closeSnapshot &&
      period.closedAt
        ? (() => {
            const startIds = new Set(
              period.startSnapshot?.map((item) => item.id),
            );
            const closeIds = new Set(closeSnapshot.map((item) => item.id));
            const addedIds = new Set(
              membershipHistory
                .filter(
                  (item) =>
                    period.startedAt && item.joinedAt >= period.startedAt,
                )
                .map((item) => item.workId),
            );
            const removedIds = new Set(
              membershipHistory
                .filter((item) => item.removedAt && !closeIds.has(item.workId))
                .map((item) => item.workId),
            );
            const historicalWorkById = new Map(
              works.map((item) => [item.id, item]),
            );
            const toWork = (item: FocusPeriodSnapshotWork) => ({
              id: item.id,
              key: item.key,
              projectId: item.projectId,
              projectName: item.projectName,
              status: item.status,
              title: item.title,
            });
            const memberForId = (id: string) => {
              const transient = transientCloseSnapshot.find(
                (item) => item.id === id,
              );
              const closed = closeSnapshot.find((item) => item.id === id);
              const started = period.startSnapshot?.find(
                (item) => item.id === id,
              );
              const current = historicalWorkById.get(id);
              if (closed) {
                return toWork(closed);
              }
              if (transient) {
                return toWork(transient);
              }
              if (started) {
                return toWork(started);
              }
              return current;
            };
            return {
              addedLater: [...addedIds]
                .filter((id) => !startIds.has(id))
                .map(memberForId)
                .filter((item): item is NonNullable<typeof item> => !!item),
              completed: closeSnapshot
                .filter(
                  (item) =>
                    item.closureResult === "Completed" &&
                    period.startSnapshot?.find(({ id }) => id === item.id)
                      ?.closureResult !== "Completed",
                )
                .map(toWork),
              inStartSnapshot: period.startSnapshot.map(toWork),
              removed: [...removedIds]
                .map(memberForId)
                .filter((item): item is NonNullable<typeof item> => !!item),
              stillOpen: closeSnapshot
                .filter((item) => item.status !== "Closed")
                .map(toWork),
            };
          })()
        : null;
    const decisions = await database
      .select({
        workId: focusPeriodLeftoverDecision.workId,
        destination: focusPeriodLeftoverDecision.destination,
        targetPeriodId: focusPeriodLeftoverDecision.targetPeriodId,
      })
      .from(focusPeriodLeftoverDecision)
      .where(eq(focusPeriodLeftoverDecision.periodId, periodId))
      .orderBy(asc(focusPeriodLeftoverDecision.workId));
    return {
      id: period.id,
      purpose: period.purpose,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status as FocusPeriodRecord["status"],
      members,
      leftoverDecisions: decisions as FocusPeriodRecord["leftoverDecisions"],
      available: availableWorks.filter((item) => !selected.has(item.id)),
      startSnapshot: period.startSnapshot ?? null,
      closeSnapshot,
      closeComparison,
      dependencies,
      evaluation:
        period.evaluationKeep ||
        period.evaluationChange ||
        period.evaluationTryNext
          ? {
              keep: period.evaluationKeep,
              change: period.evaluationChange,
              tryNext: period.evaluationTryNext,
            }
          : null,
      followUpWorks: followUpRows.map((item) => ({
        ...item,
        learning:
          item.learning as FocusPeriodRecord["followUpWorks"][number]["learning"],
      })),
      closedAt: period.closedAt?.toISOString() ?? null,
    };
  }

  async function decisionTargetId(
    executor: FocusPeriodReadExecutor,
    workspaceId: string,
    source: typeof focusPeriod.$inferSelect,
    input: FocusPeriodDecisionInput,
  ): Promise<string | null> {
    if (input.destination === "Next period") {
      const [next] = await executor
        .select({ id: focusPeriod.id })
        .from(focusPeriod)
        .where(
          and(
            eq(focusPeriod.workspaceId, workspaceId),
            inArray(focusPeriod.status, ["Planned", "Active"]),
            gte(focusPeriod.startDate, source.endDate),
            ne(focusPeriod.id, source.id),
          ),
        )
        .orderBy(asc(focusPeriod.startDate), asc(focusPeriod.id))
        .limit(1);
      if (!next) {
        throw new FocusPeriodConflictError(
          "No next Focus Period is available.",
        );
      }
      return next.id;
    }
    if (input.destination === "Another period") {
      if (!input.targetPeriodId) {
        throw new FocusPeriodConflictError("Select another Focus Period.");
      }
      const [target] = await executor
        .select()
        .from(focusPeriod)
        .where(
          and(
            eq(focusPeriod.id, input.targetPeriodId),
            eq(focusPeriod.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!target) {
        throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
      }
      if (target.status !== "Planned" && target.status !== "Active") {
        throw new FocusPeriodConflictError("Focus Period is no longer open.");
      }
      return target.id;
    }
    if (input.targetPeriodId) {
      throw new FocusPeriodConflictError(
        "This destination does not take a Focus Period.",
      );
    }
    return null;
  }

  async function validateDecisionWork(
    executor: FocusPeriodReadExecutor,
    workspaceId: string,
    input: FocusPeriodDecisionInput,
    workId: string,
  ) {
    const existing = await executor
      .select({ workId: focusPeriodLeftoverDecision.workId })
      .from(focusPeriodLeftoverDecision)
      .where(
        and(
          eq(focusPeriodLeftoverDecision.periodId, input.periodId),
          eq(focusPeriodLeftoverDecision.workId, workId),
        ),
      )
      .limit(1);
    if (existing.length) {
      throw new FocusPeriodConflictError("Work already has a close decision.");
    }
    const [current] = await executor
      .select({
        archivedAt: work.archivedAt,
        closureResult: work.closureResult,
        status: work.status,
        trashedAt: work.trashedAt,
      })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
      .for("update", { of: work })
      .limit(1);
    if (!current || current.archivedAt || current.trashedAt) {
      throw new FocusPeriodUnavailableError("Work is unavailable.");
    }
    const matches =
      input.destination === "Abandon"
        ? current?.status === "Closed" && current.closureResult === "Abandoned"
        : current?.status !== "Closed";
    if (!(current && matches)) {
      throw new FocusPeriodConflictError(
        "Work lifecycle does not match the close decision.",
      );
    }
  }

  function assertClosedPeriod(
    source: typeof focusPeriod.$inferSelect,
  ): FocusPeriodSnapshotWork[] {
    const closeSnapshot = publicCloseSnapshot(
      readStoredCloseSnapshot(source.closeSnapshot),
    );
    if (source.status !== "Closed" || !closeSnapshot) {
      throw new FocusPeriodConflictError("Close the Focus Period first.");
    }
    return closeSnapshot;
  }

  function assertSelectedOpenAtClose(
    closeSnapshot: FocusPeriodSnapshotWork[],
    input: FocusPeriodDecisionInput,
  ) {
    const openAtClose = new Set(
      closeSnapshot
        .filter((item) => item.status !== "Closed")
        .map((item) => item.id),
    );
    if (
      new Set(input.workIds).size !== input.workIds.length ||
      input.workIds.some((id) => !openAtClose.has(id))
    ) {
      throw new FocusPeriodConflictError(
        "Selected Work was not open at close.",
      );
    }
  }

  return {
    async decide(accountId, input: FocusPeriodDecisionInput) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      await database.transaction(async (tx) => {
        await lockWorkAdvisory(tx, input.workIds);
        const [source] = await tx
          .select()
          .from(focusPeriod)
          .where(
            and(
              eq(focusPeriod.id, input.periodId),
              eq(focusPeriod.workspaceId, workspaceId),
            ),
          )
          .for("update")
          .limit(1);
        if (!source) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        const closeSnapshot = assertClosedPeriod(source);
        assertSelectedOpenAtClose(closeSnapshot, input);
        const targetPeriodId = await decisionTargetId(
          tx,
          workspaceId,
          source,
          input,
        );
        for (const workId of input.workIds) {
          // biome-ignore lint/performance/noAwaitInLoops: Validate every selected Work on the transaction connection before any destination write.
          await validateDecisionWork(tx, workspaceId, input, workId);
        }
        for (const workId of input.workIds) {
          if (targetPeriodId) {
            // biome-ignore lint/performance/noAwaitInLoops: Destination membership writes stay ordered inside one transaction.
            await addMembership(tx, workspaceId, targetPeriodId, workId);
          }
          await tx.insert(focusPeriodLeftoverDecision).values({
            periodId: input.periodId,
            workId,
            destination: input.destination,
            targetPeriodId,
          });
        }
      });
    },
    async list(accountId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const periods = await database
        .select({ id: focusPeriod.id })
        .from(focusPeriod)
        .where(eq(focusPeriod.workspaceId, workspaceId))
        .orderBy(asc(focusPeriod.startDate));
      return Promise.all(periods.map(({ id }) => present(workspaceId, id)));
    },
    async find(accountId, periodId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const [period] = await database
        .select({ id: focusPeriod.id })
        .from(focusPeriod)
        .where(
          and(
            eq(focusPeriod.workspaceId, workspaceId),
            eq(focusPeriod.id, periodId),
          ),
        )
        .limit(1);
      return period ? present(workspaceId, period.id) : null;
    },
    async saveEvaluation(accountId, input: FocusPeriodEvaluationInput) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const period = await ownedPeriod(workspaceId, input.periodId);
      if (period.status !== "Closed") {
        throw new FocusPeriodConflictError(
          "Only a Closed Focus Period can save an evaluation.",
        );
      }
      const nullableText = (value: string) => value.trim() || null;
      await database
        .update(focusPeriod)
        .set({
          evaluationKeep: nullableText(input.evaluation.keep),
          evaluationChange: nullableText(input.evaluation.change),
          evaluationTryNext: nullableText(input.evaluation.tryNext),
        })
        .where(eq(focusPeriod.id, input.periodId));
    },
    async linkFollowUpWork(accountId, input: FocusPeriodFollowUpLinkInput) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const period = await ownedPeriod(workspaceId, input.periodId);
      if (period.status !== "Closed") {
        throw new FocusPeriodConflictError(
          "Follow-up Work needs a Closed Focus Period.",
        );
      }
      const learningText = input.learningText.trim();
      if (!learningText || learningText.length > 2000) {
        throw new FocusPeriodConflictError(
          "Follow-up Work needs a saved period learning.",
        );
      }
      const [ownedWork] = await database
        .select({ id: work.id })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(eq(work.id, input.workId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      if (!ownedWork) {
        throw new FocusPeriodUnavailableError("Work is unavailable.");
      }
      const inserted = await database
        .insert(focusPeriodFollowUpWork)
        .values({
          periodId: input.periodId,
          workId: input.workId,
          learning: input.learning,
          learningText,
        })
        .onConflictDoNothing()
        .returning({ workId: focusPeriodFollowUpWork.workId });
      if (inserted.length) {
        return;
      }
      const [existing] = await database
        .select({
          learning: focusPeriodFollowUpWork.learning,
          learningText: focusPeriodFollowUpWork.learningText,
          periodId: focusPeriodFollowUpWork.periodId,
        })
        .from(focusPeriodFollowUpWork)
        .where(eq(focusPeriodFollowUpWork.workId, input.workId))
        .limit(1);
      if (
        existing?.periodId === input.periodId &&
        existing.learning === input.learning &&
        existing.learningText === learningText
      ) {
        return;
      }
      throw new FocusPeriodConflictError(
        "Work is already linked to another Focus Period learning.",
      );
    },
    async create(accountId, input: CreateFocusPeriodInput) {
      const { workspaceId, today } = await scope(accountId);
      const id = crypto.randomUUID();
      await database.insert(focusPeriod).values({ id, workspaceId, ...input });
      await activate(workspaceId, id, today);
      return present(workspaceId, id);
    },
    async add(accountId, periodId, workId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const works = await worksFor(workspaceId);
      if (!works.some((item) => item.id === workId)) {
        throw new FocusPeriodUnavailableError("Work is unavailable.");
      }
      await database.transaction(async (tx) => {
        await lockWorkAdvisory(tx, [workId]);
        await addMembership(tx, workspaceId, periodId, workId);
      });
    },
    async move(accountId, periodId, workId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const availableWorks = await worksFor(workspaceId);
      if (!availableWorks.some((item) => item.id === workId)) {
        throw new FocusPeriodUnavailableError("Work is unavailable.");
      }
      await database.transaction(async (tx) => {
        const move = await lockMovePeriods(tx, workspaceId, periodId, workId);
        if (!move) {
          return;
        }
        const timestamp = now();
        await endMoveSourceMembership(
          tx,
          move.sourcePeriodId,
          workId,
          timestamp,
        );
        await transferActiveMembership(
          tx,
          move.sourcePeriodId,
          move.targetPeriodId,
          workId,
        );
        await tx.insert(focusPeriodMembership).values({
          id: crypto.randomUUID(),
          joinedAt: timestamp,
          periodId: move.targetPeriodId,
          workId,
        });
      });
    },
    async remove(accountId, periodId, workId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      await database.transaction(async (tx) => {
        const [period] = await tx
          .select()
          .from(focusPeriod)
          .where(
            and(
              eq(focusPeriod.id, periodId),
              eq(focusPeriod.workspaceId, workspaceId),
            ),
          )
          .for("update")
          .limit(1);
        if (!period) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        if (period.status !== "Planned" && period.status !== "Active") {
          throw new FocusPeriodConflictError("Focus Period is no longer open.");
        }
        await tx
          .update(focusPeriodMembership)
          .set({ removedAt: now() })
          .where(
            and(
              eq(focusPeriodMembership.periodId, periodId),
              eq(focusPeriodMembership.workId, workId),
              isNull(focusPeriodMembership.removedAt),
            ),
          );
        await tx
          .delete(focusPeriodActiveWork)
          .where(
            and(
              eq(focusPeriodActiveWork.periodId, periodId),
              eq(focusPeriodActiveWork.workId, workId),
            ),
          );
      });
    },
    async cancel(accountId, periodId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      await database.transaction(async (tx) => {
        const [period] = await tx
          .select()
          .from(focusPeriod)
          .where(
            and(
              eq(focusPeriod.id, periodId),
              eq(focusPeriod.workspaceId, workspaceId),
            ),
          )
          .for("update")
          .limit(1);
        if (!period) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        if (period.status !== "Planned" && period.status !== "Active") {
          throw new FocusPeriodConflictError("Focus Period is no longer open.");
        }
        await tx
          .update(focusPeriod)
          .set({ status: "Canceled" })
          .where(eq(focusPeriod.id, periodId));
        await tx
          .delete(focusPeriodActiveWork)
          .where(eq(focusPeriodActiveWork.periodId, periodId));
      });
    },
    async close(accountId, periodId) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      await database.transaction(async (tx) => {
        const [period] = await tx
          .select()
          .from(focusPeriod)
          .where(
            and(
              eq(focusPeriod.id, periodId),
              eq(focusPeriod.workspaceId, workspaceId),
            ),
          )
          .for("update")
          .limit(1);
        if (!period) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        if (period.status !== "Active") {
          throw new FocusPeriodConflictError(
            "Only an Active Focus Period can close.",
          );
        }
        const memberships = await tx
          .select({
            joinedAt: focusPeriodMembership.joinedAt,
            removedAt: focusPeriodMembership.removedAt,
            workId: focusPeriodMembership.workId,
          })
          .from(focusPeriodMembership)
          .where(eq(focusPeriodMembership.periodId, periodId));
        const ids = memberships
          .filter(({ removedAt }) => removedAt === null)
          .map(({ workId }) => workId);
        const currentMemberIds = new Set(ids);
        const startIds = new Set(
          period.startSnapshot?.map((item) => item.id) ?? [],
        );
        const transientIds = [
          ...new Set(
            memberships
              .filter(
                ({ joinedAt, removedAt, workId }) =>
                  period.startedAt !== null &&
                  joinedAt >= period.startedAt &&
                  removedAt !== null &&
                  !startIds.has(workId) &&
                  !currentMemberIds.has(workId),
              )
              .map(({ workId }) => workId),
          ),
        ];
        const snapshot = await snapshotWorks(tx, workspaceId, ids);
        const transientSnapshot = (
          await snapshotWorks(tx, workspaceId, transientIds)
        ).map((item) => ({ ...item, inCloseScope: false as const }));
        await tx
          .update(focusPeriod)
          .set({
            status: "Closed",
            closedAt: now(),
            closeSnapshot: [...snapshot, ...transientSnapshot],
          })
          .where(eq(focusPeriod.id, periodId));
        await tx
          .delete(focusPeriodActiveWork)
          .where(eq(focusPeriodActiveWork.periodId, periodId));
      });
    },
  };
}
