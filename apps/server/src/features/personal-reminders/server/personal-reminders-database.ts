import type {
  CreateWorkReviewLaterInput,
  PersonalRemindersAccess,
  WorkReviewLater,
  WorkReviewLaterFireResult,
  WorkReviewLaterSignal,
} from "@cantiara/api/personal-reminders";
import { workReviewLaterSchema } from "@cantiara/api/personal-reminders";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  personalReminder,
  personalReminderAttentionSignal,
} from "@cantiara/db/schema/personal-reminders";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";

type PersonalReminderRecord = typeof personalReminder.$inferSelect;

export class WorkReviewLaterIdempotencyConflictError extends Error {
  readonly code = "WORK_REVIEW_LATER_IDEMPOTENCY_CONFLICT" as const;

  constructor() {
    super(
      "This Review Later request key was already used for different input.",
    );
    this.name = "WorkReviewLaterIdempotencyConflictError";
  }
}

export class WorkReviewLaterFireAtMustBeFutureError extends Error {
  readonly code = "WORK_REVIEW_LATER_FIRE_AT_MUST_BE_FUTURE" as const;

  constructor() {
    super("Review Later must be scheduled for a future time.");
    this.name = "WorkReviewLaterFireAtMustBeFutureError";
  }
}

function toWorkReviewLater(record: PersonalReminderRecord): WorkReviewLater {
  return workReviewLaterSchema.parse({
    action: record.action,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    condition: record.condition,
    createdAt: record.createdAt.toISOString(),
    fireAt: record.fireAt.toISOString(),
    fireNote: record.fireNote,
    id: record.id,
    sourceProjectId: record.sourceProjectId,
    sourceRecordId: record.sourceRecordId,
    sourceRecordType: record.sourceRecordType,
    status: record.status,
    triggeredAt: record.triggeredAt?.toISOString() ?? null,
  });
}

async function findOwnedWork(
  executor: Pick<Database, "select">,
  accountId: string,
  workId: string,
  lock = false,
) {
  const query = executor
    .select({
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      workId: work.id,
    })
    .from(work)
    .innerJoin(project, eq(project.id, work.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(and(eq(work.id, workId), eq(workspace.ownerAccountId, accountId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

function matchesCreateRequest(
  record: PersonalReminderRecord,
  input: CreateWorkReviewLaterInput,
) {
  return (
    record.action === "Review Later" &&
    record.sourceRecordType === "Work" &&
    record.sourceRecordId === input.workId &&
    record.condition === (input.condition ?? "In any case") &&
    record.fireAt.valueOf() === new Date(input.fireAt).valueOf()
  );
}

interface WorkLifeAtFire {
  projectArchivedAt: Date | null;
  status: string | null;
  workArchivedAt: Date | null;
  workId: string | null;
  workTrashedAt: Date | null;
}

interface WorkLifeLookup {
  byProject: Map<string, WorkLifeAtFire>;
  byWork: Map<string, WorkLifeAtFire>;
}

function projectLifeKey(accountId: string, projectId: string) {
  return `${accountId}:${projectId}`;
}

function workLifeKey(accountId: string, projectId: string, workId: string) {
  return `${projectLifeKey(accountId, projectId)}:${workId}`;
}

async function findWorkLivesAtFire(
  executor: Pick<Database, "select">,
  reminders: readonly PersonalReminderRecord[],
): Promise<WorkLifeLookup> {
  const projectIds = [
    ...new Set(
      reminders.flatMap((reminder) =>
        reminder.sourceProjectId ? [reminder.sourceProjectId] : [],
      ),
    ),
  ];
  const workIds = [
    ...new Set(reminders.map((reminder) => reminder.sourceRecordId)),
  ];
  const accountIds = [
    ...new Set(reminders.map((reminder) => reminder.accountId)),
  ];
  if (projectIds.length === 0) {
    return { byProject: new Map(), byWork: new Map() };
  }

  const rows = await executor
    .select({
      accountId: workspace.ownerAccountId,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      status: work.status,
      workArchivedAt: work.archivedAt,
      workId: work.id,
      workTrashedAt: work.trashedAt,
    })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .leftJoin(
      work,
      and(eq(work.projectId, project.id), inArray(work.id, workIds)),
    )
    .where(
      and(
        inArray(project.id, projectIds),
        inArray(workspace.ownerAccountId, accountIds),
      ),
    );
  const byProject = new Map<string, WorkLifeAtFire>();
  const byWork = new Map<string, WorkLifeAtFire>();
  for (const row of rows) {
    const life = {
      projectArchivedAt: row.projectArchivedAt,
      status: row.status,
      workArchivedAt: row.workArchivedAt,
      workId: row.workId,
      workTrashedAt: row.workTrashedAt,
    };
    byProject.set(projectLifeKey(row.accountId, row.projectId), life);
    if (row.workId) {
      byWork.set(workLifeKey(row.accountId, row.projectId, row.workId), life);
    }
  }
  return { byProject, byWork };
}

function workLifeForReminder(
  reminder: PersonalReminderRecord,
  lookup: WorkLifeLookup,
) {
  if (!reminder.sourceProjectId) {
    return;
  }
  return (
    lookup.byWork.get(
      workLifeKey(
        reminder.accountId,
        reminder.sourceProjectId,
        reminder.sourceRecordId,
      ),
    ) ??
    lookup.byProject.get(
      projectLifeKey(reminder.accountId, reminder.sourceProjectId),
    )
  );
}

function decideReviewLaterFire(
  reminder: PersonalReminderRecord,
  source: WorkLifeAtFire | undefined,
) {
  if (source?.projectArchivedAt) {
    return {
      emitSignal: false,
      fireNote: "Project is archived; no signal was emitted.",
    };
  }
  if (reminder.condition !== "Only if still open") {
    return { emitSignal: true, fireNote: null };
  }
  if (!source || source.status === null) {
    return {
      emitSignal: true,
      fireNote: "Work is unavailable; the condition could not be evaluated.",
    };
  }
  const workIsOpen =
    source.status !== "Closed" &&
    source.workArchivedAt === null &&
    source.workTrashedAt === null;
  if (workIsOpen) {
    return { emitSignal: true, fireNote: null };
  }
  return {
    emitSignal: false,
    fireNote:
      source.status === "Closed"
        ? "Work was Closed; no signal was emitted."
        : "Work is archived or in Trash; no signal was emitted.",
  };
}

async function persistReviewLaterFire(
  executor: Pick<Database, "insert" | "update">,
  reminder: PersonalReminderRecord,
  at: Date,
  decision: ReturnType<typeof decideReviewLaterFire>,
): Promise<WorkReviewLaterSignal | null> {
  await executor
    .update(personalReminder)
    .set({ fireNote: decision.fireNote, status: "Triggered", triggeredAt: at })
    .where(
      and(
        eq(personalReminder.id, reminder.id),
        eq(personalReminder.status, "Planned"),
      ),
    );
  if (!decision.emitSignal) {
    return null;
  }

  const signal: WorkReviewLaterSignal = {
    evaluationNote: decision.fireNote,
    occurredAt: at.toISOString(),
    signalId: `review-later:${reminder.id}`,
    signalType: "review-later",
    sourcePath: reminder.sourceProjectId
      ? `/projects/${encodeURIComponent(reminder.sourceProjectId)}#work-${encodeURIComponent(reminder.sourceRecordId)}`
      : "/",
    sourceProjectId: reminder.sourceProjectId,
    sourceRecordId: reminder.sourceRecordId,
    sourceRecordType: "Work",
  };
  const [inserted] = await executor
    .insert(personalReminderAttentionSignal)
    .values({
      ...signal,
      occurredAt: at,
      ownerAccountId: reminder.accountId,
      personalReminderId: reminder.id,
    })
    .onConflictDoNothing()
    .returning({ signalId: personalReminderAttentionSignal.signalId });
  return inserted ? signal : null;
}

export async function cancelPlannedReviewLaterForWork(
  executor: Pick<Database, "update">,
  input: { accountId: string; workId: string },
) {
  await executor
    .update(personalReminder)
    .set({ cancelledAt: new Date(), status: "Cancelled" })
    .where(
      and(
        eq(personalReminder.accountId, input.accountId),
        eq(personalReminder.action, "Review Later"),
        eq(personalReminder.sourceRecordId, input.workId),
        eq(personalReminder.sourceRecordType, "Work"),
        eq(personalReminder.status, "Planned"),
      ),
    );
}

export function createDatabasePersonalReminders(
  database: Database,
  options: { newId?: () => string; now?: () => Date } = {},
): PersonalRemindersAccess & {
  fireDueWorkReviewLater: (now?: Date) => Promise<WorkReviewLaterFireResult>;
} {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function createWorkReviewLater(
    accountId: string,
    input: CreateWorkReviewLaterInput,
  ) {
    const fireAt = new Date(input.fireAt);
    if (fireAt.valueOf() <= now().valueOf()) {
      throw new WorkReviewLaterFireAtMustBeFutureError();
    }

    return await database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(personalReminder)
        .where(
          and(
            eq(personalReminder.accountId, accountId),
            eq(
              personalReminder.clientIdempotencyKey,
              input.clientIdempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (existing) {
        if (!matchesCreateRequest(existing, input)) {
          throw new WorkReviewLaterIdempotencyConflictError();
        }
        return toWorkReviewLater(existing);
      }

      const source = await findOwnedWork(
        transaction,
        accountId,
        input.workId,
        true,
      );
      if (!source || source.projectArchivedAt) {
        return null;
      }

      const [created] = await transaction
        .insert(personalReminder)
        .values({
          accountId,
          action: "Review Later",
          clientIdempotencyKey: input.clientIdempotencyKey,
          condition: input.condition ?? "In any case",
          fireAt,
          id: `reminder-${newId()}`,
          sourceProjectId: source.projectId,
          sourceRecordId: source.workId,
          sourceRecordType: "Work",
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        return toWorkReviewLater(created);
      }

      const [raced] = await transaction
        .select()
        .from(personalReminder)
        .where(
          and(
            eq(personalReminder.accountId, accountId),
            eq(
              personalReminder.clientIdempotencyKey,
              input.clientIdempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (!(raced && matchesCreateRequest(raced, input))) {
        throw new WorkReviewLaterIdempotencyConflictError();
      }
      return toWorkReviewLater(raced);
    });
  }

  async function listWorkReviewLater(accountId: string, workId: string) {
    const source = await findOwnedWork(database, accountId, workId);
    if (!source) {
      return null;
    }
    const records = await database
      .select()
      .from(personalReminder)
      .where(
        and(
          eq(personalReminder.accountId, accountId),
          eq(personalReminder.action, "Review Later"),
          eq(personalReminder.sourceRecordId, workId),
          eq(personalReminder.sourceRecordType, "Work"),
        ),
      )
      .orderBy(desc(personalReminder.createdAt), asc(personalReminder.fireAt));
    return records.map(toWorkReviewLater);
  }

  async function cancelWorkReviewLater(accountId: string, reminderId: string) {
    return await database.transaction(async (transaction) => {
      const [cancelled] = await transaction
        .update(personalReminder)
        .set({ cancelledAt: now(), status: "Cancelled" })
        .where(
          and(
            eq(personalReminder.accountId, accountId),
            eq(personalReminder.action, "Review Later"),
            eq(personalReminder.id, reminderId),
            eq(personalReminder.sourceRecordType, "Work"),
            eq(personalReminder.status, "Planned"),
          ),
        )
        .returning();
      if (cancelled) {
        return toWorkReviewLater(cancelled);
      }

      const [existing] = await transaction
        .select()
        .from(personalReminder)
        .where(
          and(
            eq(personalReminder.accountId, accountId),
            eq(personalReminder.action, "Review Later"),
            eq(personalReminder.id, reminderId),
            eq(personalReminder.sourceRecordType, "Work"),
            eq(personalReminder.status, "Cancelled"),
          ),
        )
        .limit(1);
      return existing ? toWorkReviewLater(existing) : null;
    });
  }

  async function fireDueWorkReviewLater(at = now()) {
    return await database.transaction(async (transaction) => {
      const due = await transaction
        .select()
        .from(personalReminder)
        .where(
          and(
            eq(personalReminder.action, "Review Later"),
            eq(personalReminder.sourceRecordType, "Work"),
            eq(personalReminder.status, "Planned"),
            lte(personalReminder.fireAt, at),
          ),
        )
        .orderBy(asc(personalReminder.fireAt))
        .limit(100)
        .for("update");
      const lookup = await findWorkLivesAtFire(transaction, due);
      const signals = await Promise.all(
        due.map((reminder) =>
          persistReviewLaterFire(
            transaction,
            reminder,
            at,
            decideReviewLaterFire(
              reminder,
              workLifeForReminder(reminder, lookup),
            ),
          ),
        ),
      );
      return {
        processedCount: due.length,
        signals: signals.filter(
          (signal): signal is WorkReviewLaterSignal => signal !== null,
        ),
      };
    });
  }

  return {
    cancelWorkReviewLater,
    createWorkReviewLater,
    fireDueWorkReviewLater,
    listWorkReviewLater,
  };
}
