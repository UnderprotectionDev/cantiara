import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import {
  buildDailyFocusCandidates,
  type DailyFocusAccess,
  type DailyFocusCloseState,
  type DailyFocusEvent,
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
import { decision } from "@cantiara/db/schema/decision";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
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

interface WorkLifecycleState {
  closureResult: string | null;
  status: string;
}

function workLifecycleState(value: unknown): WorkLifecycleState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const workValue = (value as { work?: unknown }).work;
  if (
    typeof workValue !== "object" ||
    workValue === null ||
    Array.isArray(workValue)
  ) {
    return null;
  }
  const snapshot = workValue as {
    closureResult?: unknown;
    status?: unknown;
  };
  if (typeof snapshot.status !== "string") {
    return null;
  }
  return {
    closureResult:
      typeof snapshot.closureResult === "string"
        ? snapshot.closureResult
        : null,
    status: snapshot.status,
  };
}

function workLifecycleEventKind(previousValue: unknown, nextValue: unknown) {
  const previous = workLifecycleState(previousValue);
  const next = workLifecycleState(nextValue);
  if (!(previous && next)) {
    return null;
  }
  if (
    next.status === "Closed" &&
    next.closureResult === "Completed" &&
    (previous.status !== "Closed" || previous.closureResult !== "Completed")
  ) {
    return "Completed" as const;
  }
  if (
    next.status === "Closed" &&
    next.closureResult === "Abandoned" &&
    (previous.status !== "Closed" || previous.closureResult !== "Abandoned")
  ) {
    return "Abandoned" as const;
  }
  if (previous.status === "Closed" && next.status !== "Closed") {
    return "Reopened" as const;
  }
  return null;
}

function lifecycleStatus(value: unknown, key: string, field: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = (value as Record<string, unknown>)[key];
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return null;
  }
  const status = (record as Record<string, unknown>)[field];
  return typeof status === "string" ? status : null;
}

function profileDayFilter(
  occurredAt: unknown,
  focusDate: string,
  timeZone: string,
) {
  return sql`(${occurredAt} AT TIME ZONE 'UTC') >= (${focusDate}::date::timestamp AT TIME ZONE ${timeZone})
    AND (${occurredAt} AT TIME ZONE 'UTC') < ((${focusDate}::date + 1)::timestamp AT TIME ZONE ${timeZone})`;
}

async function loadDailyFocusEvents(
  database: Database,
  workspaceId: string,
  focusDate: string,
  timeZone: string,
) {
  const [history, decisions, milestones, releases, incidents] =
    await Promise.all([
      database
        .select({
          id: mutationHistory.id,
          nextValue: mutationHistory.nextValue,
          occurredAt: mutationHistory.occurredAt,
          previousValue: mutationHistory.previousValue,
          projectId: project.id,
          projectName: project.name,
          workId: work.id,
          workKey: work.key,
          workTitle: work.title,
        })
        .from(mutationHistory)
        .innerJoin(work, eq(mutationHistory.targetId, work.id))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            isNull(work.trashedAt),
            profileDayFilter(mutationHistory.occurredAt, focusDate, timeZone),
          ),
        )
        .orderBy(asc(mutationHistory.occurredAt), asc(mutationHistory.id)),
      database
        .select({
          createdAt: decision.createdAt,
          id: decision.id,
          projectId: project.id,
          projectName: project.name,
          title: decision.title,
        })
        .from(decision)
        .innerJoin(project, eq(decision.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            profileDayFilter(decision.createdAt, focusDate, timeZone),
          ),
        ),
      database
        .select({
          id: mutationHistory.id,
          nextValue: mutationHistory.nextValue,
          occurredAt: mutationHistory.occurredAt,
          previousValue: mutationHistory.previousValue,
          projectId: project.id,
          projectName: project.name,
          sourceId: projectMilestone.id,
          sourceTitle: projectMilestone.title,
        })
        .from(mutationHistory)
        .innerJoin(
          projectMilestone,
          eq(mutationHistory.targetId, projectMilestone.id),
        )
        .innerJoin(project, eq(projectMilestone.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            profileDayFilter(mutationHistory.occurredAt, focusDate, timeZone),
          ),
        ),
      database
        .select({
          id: mutationHistory.id,
          nextValue: mutationHistory.nextValue,
          occurredAt: mutationHistory.occurredAt,
          previousValue: mutationHistory.previousValue,
          projectId: project.id,
          projectName: project.name,
          sourceId: projectRelease.id,
          sourceTitle: projectRelease.name,
        })
        .from(mutationHistory)
        .innerJoin(
          projectRelease,
          eq(mutationHistory.targetId, projectRelease.id),
        )
        .innerJoin(project, eq(projectRelease.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            profileDayFilter(mutationHistory.occurredAt, focusDate, timeZone),
          ),
        ),
      database
        .select({
          id: mutationHistory.id,
          nextValue: mutationHistory.nextValue,
          occurredAt: mutationHistory.occurredAt,
          previousValue: mutationHistory.previousValue,
          projectId: project.id,
          projectName: project.name,
          sourceId: productionIncident.id,
          sourceTitle: productionIncident.title,
        })
        .from(mutationHistory)
        .innerJoin(
          productionIncident,
          eq(mutationHistory.targetId, productionIncident.id),
        )
        .innerJoin(project, eq(productionIncident.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            profileDayFilter(mutationHistory.occurredAt, focusDate, timeZone),
          ),
        ),
    ]);

  const events: DailyFocusEvent[] = [
    ...history.flatMap((event) => {
      const kind = workLifecycleEventKind(event.previousValue, event.nextValue);
      return kind
        ? [
            {
              id: event.id,
              kind,
              occurredAt: event.occurredAt.toISOString(),
              projectId: event.projectId,
              projectName: event.projectName,
              sourceId: event.workId,
              sourceKey: event.workKey,
              sourceTitle: event.workTitle,
              sourceType: "Work" as const,
            },
          ]
        : [];
    }),
    ...decisions.map((record) => ({
      id: record.id,
      kind: "Recorded" as const,
      occurredAt: record.createdAt.toISOString(),
      projectId: record.projectId,
      projectName: record.projectName,
      sourceId: record.id,
      sourceKey: null,
      sourceTitle: record.title,
      sourceType: "Decision" as const,
    })),
    ...milestones.flatMap((event) =>
      lifecycleStatus(event.nextValue, "milestone", "status") === "Reached" &&
      lifecycleStatus(event.previousValue, "milestone", "status") !== "Reached"
        ? [
            {
              id: event.id,
              kind: "Reached" as const,
              occurredAt: event.occurredAt.toISOString(),
              projectId: event.projectId,
              projectName: event.projectName,
              sourceId: event.sourceId,
              sourceKey: null,
              sourceTitle: event.sourceTitle,
              sourceType: "Milestone" as const,
            },
          ]
        : [],
    ),
    ...releases.flatMap((event) =>
      lifecycleStatus(event.nextValue, "projectRelease", "status") ===
        "Published" &&
      lifecycleStatus(event.previousValue, "projectRelease", "status") !==
        "Published"
        ? [
            {
              id: event.id,
              kind: "Published" as const,
              occurredAt: event.occurredAt.toISOString(),
              projectId: event.projectId,
              projectName: event.projectName,
              sourceId: event.sourceId,
              sourceKey: null,
              sourceTitle: event.sourceTitle,
              sourceType: "Project Release" as const,
            },
          ]
        : [],
    ),
    ...incidents.flatMap((event) =>
      lifecycleStatus(event.nextValue, "productionIncident", "status") ===
        "Resolved" &&
      lifecycleStatus(event.previousValue, "productionIncident", "status") !==
        "Resolved"
        ? [
            {
              id: event.id,
              kind: "Resolved" as const,
              occurredAt: event.occurredAt.toISOString(),
              projectId: event.projectId,
              projectName: event.projectName,
              sourceId: event.sourceId,
              sourceKey: null,
              sourceTitle: event.sourceTitle,
              sourceType: "Production Incident" as const,
            },
          ]
        : [],
    ),
  ];
  return events.sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
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
        day: {
          available: [],
          candidates: [],
          events: [],
          focusDate,
          members: [],
        },
      };
    }
    const [preferences] = await database
      .select({ timeZone: accountPreferences.timeZone })
      .from(accountPreferences)
      .where(eq(accountPreferences.accountId, accountId))
      .limit(1);
    const timeZone =
      preferences?.timeZone ?? DEFAULT_ACCOUNT_PREFERENCES.timeZone;
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
    const events = includeArchived
      ? []
      : await loadDailyFocusEvents(database, workspaceId, focusDate, timeZone);
    return {
      closeMembers,
      day: dailyFocusDaySchema.parse({
        available: visibleWorks.filter(({ id }) => !selectedIds.has(id)),
        candidates: includeArchived
          ? []
          : buildDailyFocusCandidates(availableCandidates, focusDate),
        events,
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
