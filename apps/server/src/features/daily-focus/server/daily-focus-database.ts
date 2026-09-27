import {
  type DailyFocusAccess,
  DailyFocusWorkUnavailableError,
  dailyFocusDaySchema,
} from "@cantiara/api/daily-focus";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull } from "drizzle-orm";

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
      .select({ id: work.id })
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
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!workspaceId) {
        return { available: [], focusDate, members: [] };
      }
      const [works, memberships] = await Promise.all([
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
            and(eq(project.workspaceId, workspaceId), isNull(work.trashedAt)),
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
      return dailyFocusDaySchema.parse({
        available: works.filter(({ id }) => !selectedIds.has(id)),
        focusDate,
        members: works.filter(({ id }) => selectedIds.has(id)),
      });
    },
    async add(accountId, focusDate, workId) {
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!(workspaceId && (await ownedWork(workspaceId, workId)))) {
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
}
