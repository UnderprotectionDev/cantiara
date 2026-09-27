import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import {
  type DailyFocusAccess,
  DailyFocusWorkUnavailableError,
  dailyFocusDaySchema,
} from "@cantiara/api/daily-focus";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

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

export function createDatabaseDailyFocus(database: Database): DailyFocusAccess {
  async function ownedWorkspace(accountId: string) {
    const [record] = await database
      .select({ id: workspace.id, timeZone: accountPreferences.timeZone })
      .from(workspace)
      .leftJoin(
        accountPreferences,
        eq(workspace.ownerAccountId, accountPreferences.accountId),
      )
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    return record ?? null;
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

  return {
    async list(accountId, focusDate) {
      const owned = await ownedWorkspace(accountId);
      if (!owned) {
        return { available: [], events: [], focusDate, members: [] };
      }
      const workspaceId = owned.id;
      const timeZone = owned.timeZone ?? DEFAULT_ACCOUNT_PREFERENCES.timeZone;
      const [works, memberships, history] = await Promise.all([
        database
          .select({
            id: work.id,
            key: work.key,
            projectId: project.id,
            projectName: project.name,
            status: work.status,
            title: work.title,
          })
          .from(work)
          .innerJoin(project, eq(work.projectId, project.id))
          .where(
            and(
              eq(project.workspaceId, workspaceId),
              isNull(work.archivedAt),
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
              sql`(${mutationHistory.occurredAt} AT TIME ZONE 'UTC') >= (${focusDate}::date::timestamp AT TIME ZONE ${timeZone})`,
              sql`(${mutationHistory.occurredAt} AT TIME ZONE 'UTC') < ((${focusDate}::date + 1)::timestamp AT TIME ZONE ${timeZone})`,
            ),
          )
          .orderBy(asc(mutationHistory.occurredAt), asc(mutationHistory.id)),
      ]);
      const selectedIds = new Set(memberships.map(({ workId }) => workId));
      return dailyFocusDaySchema.parse({
        available: works.filter(({ id }) => !selectedIds.has(id)),
        events: history.flatMap((event) => {
          const kind = workLifecycleEventKind(
            event.previousValue,
            event.nextValue,
          );
          return kind
            ? [
                {
                  id: event.id,
                  kind,
                  occurredAt: event.occurredAt.toISOString(),
                  projectId: event.projectId,
                  projectName: event.projectName,
                  workId: event.workId,
                  workKey: event.workKey,
                  workTitle: event.workTitle,
                },
              ]
            : [];
        }),
        focusDate,
        members: works.filter(({ id }) => selectedIds.has(id)),
      });
    },
    async add(accountId, focusDate, workId) {
      const workspaceId = (await ownedWorkspace(accountId))?.id;
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
      const workspaceId = (await ownedWorkspace(accountId))?.id;
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
}
