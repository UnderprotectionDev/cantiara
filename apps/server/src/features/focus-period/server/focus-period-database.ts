import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { accountLocalDate } from "@cantiara/api/backlog";
import {
  type CreateFocusPeriodInput,
  type FocusPeriodAccess,
  FocusPeriodConflictError,
  type FocusPeriodRecord,
  FocusPeriodUnavailableError,
} from "@cantiara/api/focus-period";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import {
  focusPeriod,
  focusPeriodActiveWork,
  focusPeriodMembership,
} from "@cantiara/db/schema/focus-period";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";

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

  function worksFor(workspaceId: string) {
    return database
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
          isNull(work.trashedAt),
          isNull(work.archivedAt),
        ),
      )
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
      const snapshot = ids.length
        ? await tx
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
              and(eq(project.workspaceId, workspaceId), inArray(work.id, ids)),
            )
            .orderBy(asc(project.name), asc(work.number))
        : [];
      if (ids.length) {
        const claimed = await tx
          .insert(focusPeriodActiveWork)
          .values(ids.map((workId) => ({ workId, periodId })))
          .onConflictDoNothing()
          .returning({ workId: focusPeriodActiveWork.workId });
        if (claimed.length !== ids.length) {
          throw new FocusPeriodConflictError(
            "Work is already in an Active Focus Period.",
          );
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
    const works = await worksFor(workspaceId);
    const selected = new Set(ids);
    return {
      id: period.id,
      purpose: period.purpose,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status as FocusPeriodRecord["status"],
      members: works.filter((item) => selected.has(item.id)),
      available: works.filter((item) => !selected.has(item.id)),
      startSnapshot: period.startSnapshot ?? null,
      closeSnapshot: period.closeSnapshot ?? null,
      closedAt: period.closedAt?.toISOString() ?? null,
    };
  }

  return {
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
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${workId}))`,
        );
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
        const existing = await tx
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
        const overlapping = await tx
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
              eq(focusPeriod.workspaceId, workspaceId),
              ne(focusPeriod.id, periodId),
              inArray(focusPeriod.status, ["Planned", "Active"]),
              lte(focusPeriod.startDate, period.endDate),
              gte(focusPeriod.endDate, period.startDate),
            ),
          )
          .limit(1);
        if (overlapping.length) {
          throw new FocusPeriodConflictError(
            "Work is already in an Active Focus Period.",
          );
        }
        if (period.status === "Active") {
          const claimed = await tx
            .insert(focusPeriodActiveWork)
            .values({ periodId, workId })
            .onConflictDoNothing()
            .returning({ workId: focusPeriodActiveWork.workId });
          if (!claimed.length) {
            throw new FocusPeriodConflictError(
              "Work is already in an Active Focus Period.",
            );
          }
        }
        await tx
          .insert(focusPeriodMembership)
          .values({ id: crypto.randomUUID(), periodId, workId });
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
          .select({ workId: focusPeriodMembership.workId })
          .from(focusPeriodMembership)
          .where(
            and(
              eq(focusPeriodMembership.periodId, periodId),
              isNull(focusPeriodMembership.removedAt),
            ),
          );
        const ids = memberships.map(({ workId }) => workId);
        const snapshot = ids.length
          ? await tx
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
                  inArray(work.id, ids),
                ),
              )
              .orderBy(asc(project.name), asc(work.number))
          : [];
        await tx
          .update(focusPeriod)
          .set({ status: "Closed", closedAt: now(), closeSnapshot: snapshot })
          .where(eq(focusPeriod.id, periodId));
        await tx
          .delete(focusPeriodActiveWork)
          .where(eq(focusPeriodActiveWork.periodId, periodId));
      });
    },
  };
}
