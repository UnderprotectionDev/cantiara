import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { accountLocalDate } from "@cantiara/api/backlog";
import {
  type CreateFocusPeriodInput,
  type FocusPeriodAccess,
  FocusPeriodConflictError,
  type FocusPeriodDecisionInput,
  type FocusPeriodRecord,
  FocusPeriodUnavailableError,
} from "@cantiara/api/focus-period";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import {
  focusPeriod,
  focusPeriodActiveWork,
  focusPeriodLeftoverDecision,
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

  function worksFor(workspaceId: string, includeInactive = false) {
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
    const works = await worksFor(workspaceId, true);
    const availableWorks = await worksFor(workspaceId);
    const decisions = await database
      .select({
        workId: focusPeriodLeftoverDecision.workId,
        destination: focusPeriodLeftoverDecision.destination,
        targetPeriodId: focusPeriodLeftoverDecision.targetPeriodId,
      })
      .from(focusPeriodLeftoverDecision)
      .where(eq(focusPeriodLeftoverDecision.periodId, periodId))
      .orderBy(asc(focusPeriodLeftoverDecision.workId));
    const selected = new Set(ids);
    return {
      id: period.id,
      purpose: period.purpose,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status as FocusPeriodRecord["status"],
      members: works.filter((item) => selected.has(item.id)),
      leftoverDecisions: decisions as FocusPeriodRecord["leftoverDecisions"],
      available: availableWorks.filter((item) => !selected.has(item.id)),
      startSnapshot: period.startSnapshot ?? null,
      closeSnapshot: period.closeSnapshot ?? null,
      closedAt: period.closedAt?.toISOString() ?? null,
    };
  }

  async function decisionTargetId(
    workspaceId: string,
    source: typeof focusPeriod.$inferSelect,
    input: FocusPeriodDecisionInput,
  ): Promise<string | null> {
    if (input.destination === "Next period") {
      const [next] = await database
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
      const target = await ownedPeriod(workspaceId, input.targetPeriodId);
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
    workspaceId: string,
    input: FocusPeriodDecisionInput,
    workId: string,
  ) {
    const existing = await database
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
    const [current] = await database
      .select({ status: work.status, closureResult: work.closureResult })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
      .limit(1);
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

  return {
    async decide(accountId, input: FocusPeriodDecisionInput) {
      const { workspaceId, today } = await scope(accountId);
      await sync(workspaceId, today);
      const source = await ownedPeriod(workspaceId, input.periodId);
      if (source.status !== "Closed" || !source.closeSnapshot) {
        throw new FocusPeriodConflictError("Close the Focus Period first.");
      }
      const openAtClose = new Set(
        source.closeSnapshot
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
      const targetPeriodId = await decisionTargetId(workspaceId, source, input);
      for (const workId of input.workIds) {
        // biome-ignore lint/performance/noAwaitInLoops: Decisions are recorded sequentially so each Work is validated before its destination changes.
        await validateDecisionWork(workspaceId, input, workId);
        if (targetPeriodId) {
          await this.add(accountId, targetPeriodId, workId);
        }
        await database.insert(focusPeriodLeftoverDecision).values({
          periodId: input.periodId,
          workId,
          destination: input.destination,
          targetPeriodId,
        });
      }
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
