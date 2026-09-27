import {
  buildDailyFocusCandidates,
  type DailyFocusAccess,
  type DailyFocusCloseState,
  type DailyFocusStatusChange,
  DailyFocusWorkUnavailableError,
  dailyFocusCloseStateSchema,
  dailyFocusDaySchema,
  dailyFocusStatusChangeSchema,
  deriveDailyFocusClose,
} from "@cantiara/api/daily-focus";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

function workSnapshot(
  value: unknown,
  workId: string,
  fallbackReappearDate: string | null = null,
): DailyFocusCloseState | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  const workValue = payload.work ?? payload;
  if (typeof workValue !== "object" || workValue === null) {
    return null;
  }
  const snapshot = workValue as Record<string, unknown>;
  const parsed = dailyFocusCloseStateSchema.safeParse({
    closureResult: snapshot.closureResult ?? null,
    reappearDate:
      snapshot.reappearDate === undefined
        ? fallbackReappearDate
        : snapshot.reappearDate,
    status: snapshot.status,
    workId,
  });
  return parsed.success ? parsed.data : null;
}

function statusChange(
  workId: string,
  previousValue: unknown,
  nextValue: unknown,
): DailyFocusStatusChange | null {
  const previous = workSnapshot(previousValue, workId);
  const next = workSnapshot(nextValue, workId);
  if (!(previous && next) || previous.status === next.status) {
    return null;
  }
  return dailyFocusStatusChangeSchema.parse({
    closureResult: next.closureResult,
    status: next.status,
    workId,
  });
}

export function createDatabaseDailyFocus(database: Database): DailyFocusAccess {
  async function ownedWorkspaceId(accountId: string) {
    const [record] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    return record?.id ?? null;
  }

  async function ownedWork(workspaceId: string, workId: string) {
    const [record] = await database
      .select({ archivedAt: work.archivedAt, id: work.id })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(
        and(
          eq(work.id, workId),
          eq(project.workspaceId, workspaceId),
          isNull(work.trashedAt),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async function loadDay(
    accountId: string,
    focusDate: string,
    includeArchived = false,
  ) {
    const workspaceId = await ownedWorkspaceId(accountId);
    if (!workspaceId) {
      return {
        closeMembers: [],
        day: { available: [], candidates: [], focusDate, members: [] },
      };
    }
    const [works, memberships] = await Promise.all([
      database
        .select({
          id: work.id,
          key: work.key,
          projectId: project.id,
          projectName: project.name,
          reappearDate: work.reappearDate,
          status: work.status,
          targetDate: work.targetDate,
          title: work.title,
        })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            ...(includeArchived ? [] : [isNull(work.archivedAt)]),
            isNull(work.trashedAt),
          ),
        )
        .orderBy(asc(project.name), asc(work.number)),
      database
        .select({ workId: dailyFocusMembership.workId })
        .from(dailyFocusMembership)
        .where(
          and(
            eq(dailyFocusMembership.workspaceId, workspaceId),
            eq(dailyFocusMembership.focusDate, focusDate),
          ),
        ),
    ]);
    const selectedIds = new Set(memberships.map(({ workId }) => workId));
    const availableCandidates = works.filter(({ id }) => !selectedIds.has(id));
    const closeMembers = works
      .filter(({ id }) => selectedIds.has(id))
      .map(({ targetDate: _targetDate, ...member }) => member);
    const visibleWorks = works.map(
      ({
        reappearDate: _reappearDate,
        targetDate: _targetDate,
        ...visibleWork
      }) => visibleWork,
    );
    return {
      closeMembers,
      day: dailyFocusDaySchema.parse({
        available: visibleWorks.filter(({ id }) => !selectedIds.has(id)),
        candidates: includeArchived
          ? []
          : buildDailyFocusCandidates(availableCandidates, focusDate),
        focusDate,
        members: visibleWorks.filter(({ id }) => selectedIds.has(id)),
      }),
    };
  }

  const access: DailyFocusAccess = {
    list: async (accountId, focusDate) =>
      (await loadDay(accountId, focusDate)).day,
    async readClose(accountId, focusDate) {
      const { closeMembers } = await loadDay(accountId, focusDate, true);
      if (closeMembers.length === 0) {
        return deriveDailyFocusClose({
          endOfDayStates: [],
          focusDate,
          members: [],
          statusChanges: [],
        });
      }

      const [preferences] = await database
        .select({ timeZone: accountPreferences.timeZone })
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId))
        .limit(1);
      const timeZone = preferences?.timeZone ?? "Europe/Istanbul";
      const workIds = closeMembers.map(({ id }) => id);
      const occurredAt = sql`${mutationHistory.occurredAt} AT TIME ZONE 'UTC'`;
      const dayStart = sql`${focusDate}::date::timestamp AT TIME ZONE ${timeZone}`;
      const nextDayStart = sql`(${focusDate}::date + 1)::timestamp AT TIME ZONE ${timeZone}`;
      const [endOfDayHistory, dayHistory] = await Promise.all([
        database
          .select({
            nextValue: mutationHistory.nextValue,
            targetId: mutationHistory.targetId,
          })
          .from(mutationHistory)
          .where(
            and(
              inArray(mutationHistory.targetId, workIds),
              lt(occurredAt, nextDayStart),
            ),
          )
          .orderBy(
            asc(mutationHistory.targetId),
            desc(mutationHistory.revision),
          ),
        database
          .select({
            nextValue: mutationHistory.nextValue,
            previousValue: mutationHistory.previousValue,
            targetId: mutationHistory.targetId,
          })
          .from(mutationHistory)
          .where(
            and(
              inArray(mutationHistory.targetId, workIds),
              gte(occurredAt, dayStart),
              lt(occurredAt, nextDayStart),
            ),
          )
          .orderBy(
            asc(mutationHistory.targetId),
            asc(mutationHistory.revision),
          ),
      ]);

      const endOfDayStates: DailyFocusCloseState[] = [];
      const seenWorkIds = new Set<string>();
      const membersById = new Map(
        closeMembers.map((member) => [member.id, member]),
      );
      for (const record of endOfDayHistory) {
        if (seenWorkIds.has(record.targetId)) {
          continue;
        }
        const snapshot = workSnapshot(
          record.nextValue,
          record.targetId,
          membersById.get(record.targetId)?.reappearDate ?? null,
        );
        if (snapshot) {
          seenWorkIds.add(record.targetId);
          endOfDayStates.push(snapshot);
        }
      }

      const statusChanges: DailyFocusStatusChange[] = [];
      for (const record of dayHistory) {
        const change = statusChange(
          record.targetId,
          record.previousValue,
          record.nextValue,
        );
        if (change) {
          statusChanges.push(change);
        }
      }

      return deriveDailyFocusClose({
        endOfDayStates,
        focusDate,
        members: closeMembers,
        statusChanges,
      });
    },
    async add(accountId, focusDate, workId) {
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!workspaceId) {
        throw new DailyFocusWorkUnavailableError();
      }
      const record = await ownedWork(workspaceId, workId);
      if (!record || record.archivedAt !== null) {
        throw new DailyFocusWorkUnavailableError();
      }
      await database
        .insert(dailyFocusMembership)
        .values({
          id: crypto.randomUUID(),
          focusDate,
          workId,
          workspaceId,
        })
        .onConflictDoNothing({
          target: [
            dailyFocusMembership.workspaceId,
            dailyFocusMembership.workId,
            dailyFocusMembership.focusDate,
          ],
        });
    },
    async remove(accountId, focusDate, workId) {
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!(workspaceId && (await ownedWork(workspaceId, workId)))) {
        throw new DailyFocusWorkUnavailableError();
      }
      await database
        .delete(dailyFocusMembership)
        .where(
          and(
            eq(dailyFocusMembership.workspaceId, workspaceId),
            eq(dailyFocusMembership.focusDate, focusDate),
            eq(dailyFocusMembership.workId, workId),
          ),
        );
    },
  };
  return access;
}
