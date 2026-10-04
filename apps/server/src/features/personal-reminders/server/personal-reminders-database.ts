import type {
  CreatePersonalReminderInput,
  CreateWorkReviewLaterInput,
  PersonalReminder,
  PersonalReminderFireResult,
  PersonalReminderSignal,
  PersonalReminderSourceType,
  PersonalRemindersAccess,
  WorkReviewLater,
  WorkReviewLaterFireResult,
} from "@cantiara/api/personal-reminders";
import {
  personalReminderSchema,
  personalReminderSourceTypeSchema,
  workReviewLaterSchema,
} from "@cantiara/api/personal-reminders";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  personalReminder,
  personalReminderAttentionSignal,
} from "@cantiara/db/schema/personal-reminders";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";

type PersonalReminderRecord = typeof personalReminder.$inferSelect;
type ReminderSourceRef = Pick<
  PersonalReminderRecord,
  "accountId" | "sourceRecordId" | "sourceRecordType"
>;

interface OwnedSource {
  projectArchivedAt: Date | null;
  projectId: string | null;
  recordArchivedAt: Date | null;
  recordLife: string | null;
  recordStatus: string | null;
  recordTrashedAt: Date | null;
  sourceRecordId: string;
}

interface OwnedSourceRow {
  accountId: string;
  projectArchivedAt: Date | null;
  projectId: string | null;
  recordArchivedAt?: Date | null;
  recordLife?: string | null;
  recordStatus?: string | null;
  recordTrashedAt?: Date | null;
  sourceRecordId: string;
}

export class PersonalReminderIdempotencyConflictError extends Error {
  readonly code = "PERSONAL_REMINDER_IDEMPOTENCY_CONFLICT" as const;

  constructor() {
    super("This reminder request key was already used for different input.");
    this.name = "PersonalReminderIdempotencyConflictError";
  }
}

export class PersonalReminderFireAtMustBeFutureError extends Error {
  readonly code = "PERSONAL_REMINDER_FIRE_AT_MUST_BE_FUTURE" as const;

  constructor() {
    super("Reminder must be scheduled for a future time.");
    this.name = "PersonalReminderFireAtMustBeFutureError";
  }
}

export class WorkReviewLaterIdempotencyConflictError extends Error {
  readonly code = "WORK_REVIEW_LATER_IDEMPOTENCY_CONFLICT" as const;

  constructor(options?: ErrorOptions) {
    super(
      "This Review Later request key was already used for different input.",
      options,
    );
    this.name = "WorkReviewLaterIdempotencyConflictError";
  }
}

export class WorkReviewLaterFireAtMustBeFutureError extends Error {
  readonly code = "WORK_REVIEW_LATER_FIRE_AT_MUST_BE_FUTURE" as const;

  constructor(options?: ErrorOptions) {
    super("Review Later must be scheduled for a future time.", options);
    this.name = "WorkReviewLaterFireAtMustBeFutureError";
  }
}

function sourceKey(
  accountId: string,
  sourceRecordType: PersonalReminderSourceType,
  sourceRecordId: string,
) {
  return JSON.stringify([accountId, sourceRecordType, sourceRecordId]);
}

function sourceRecordTypeOf(
  reminder: Pick<PersonalReminderRecord, "sourceRecordType">,
) {
  return personalReminderSourceTypeSchema.parse(reminder.sourceRecordType);
}

function assertNever(sourceRecordType: never): never {
  throw new Error(`Unsupported reminder source type: ${sourceRecordType}`);
}

function toPersonalReminder(record: PersonalReminderRecord): PersonalReminder {
  return personalReminderSchema.parse({
    action: record.action,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    condition: record.condition,
    createdAt: record.createdAt.toISOString(),
    fireAt: record.fireAt.toISOString(),
    fireNote: record.fireNote,
    id: record.id,
    sectionId: record.sectionId,
    sourceProjectId: record.sourceProjectId,
    sourceRecordId: record.sourceRecordId,
    sourceRecordType: record.sourceRecordType,
    status: record.status,
    triggeredAt: record.triggeredAt?.toISOString() ?? null,
  });
}

function toWorkReviewLater(
  record: PersonalReminderRecord | PersonalReminder,
): WorkReviewLater {
  return workReviewLaterSchema.parse(record);
}

function rememberRows(
  result: Map<string, OwnedSource>,
  sourceRecordType: PersonalReminderSourceType,
  rows: readonly OwnedSourceRow[],
) {
  for (const row of rows) {
    result.set(sourceKey(row.accountId, sourceRecordType, row.sourceRecordId), {
      projectArchivedAt: row.projectArchivedAt,
      projectId: row.projectId,
      recordArchivedAt: row.recordArchivedAt ?? null,
      recordLife: row.recordLife ?? null,
      recordStatus: row.recordStatus ?? null,
      recordTrashedAt: row.recordTrashedAt ?? null,
      sourceRecordId: row.sourceRecordId,
    });
  }
}

async function findOwnedSources(
  executor: Pick<Database, "select">,
  sources: readonly ReminderSourceRef[],
) {
  const result = new Map<string, OwnedSource>();
  const groups = new Map<PersonalReminderSourceType, ReminderSourceRef[]>();
  for (const source of sources) {
    const sourceRecordType = sourceRecordTypeOf(source);
    const group = groups.get(sourceRecordType) ?? [];
    group.push({ ...source, sourceRecordType });
    groups.set(sourceRecordType, group);
  }

  await Promise.all(
    [...groups].map(async ([sourceRecordType, group]) => {
      const sourceIds = [
        ...new Set(group.map((source) => source.sourceRecordId)),
      ];
      const accountIds = [...new Set(group.map((source) => source.accountId))];

      switch (sourceRecordType) {
        case "Project": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: project.id,
              recordArchivedAt: project.archivedAt,
              recordStatus: project.status,
              sourceRecordId: project.id,
            })
            .from(project)
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(project.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Document": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: document.projectId,
              recordArchivedAt: document.archivedAt,
              sourceRecordId: document.id,
            })
            .from(document)
            .leftJoin(project, eq(project.id, document.projectId))
            .innerJoin(
              workspace,
              or(
                eq(workspace.id, document.workspaceId),
                eq(workspace.id, project.workspaceId),
              ),
            )
            .where(
              and(
                inArray(document.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Work": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: work.projectId,
              recordArchivedAt: work.archivedAt,
              recordStatus: work.status,
              recordTrashedAt: work.trashedAt,
              sourceRecordId: work.id,
            })
            .from(work)
            .innerJoin(project, eq(project.id, work.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(work.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Decision": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: decision.projectId,
              recordLife: decision.life,
              sourceRecordId: decision.id,
            })
            .from(decision)
            .innerJoin(project, eq(project.id, decision.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(decision.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Risk": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: risk.projectId,
              recordLife: risk.life,
              sourceRecordId: risk.id,
            })
            .from(risk)
            .innerJoin(project, eq(project.id, risk.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(risk.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Milestone": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: projectMilestone.projectId,
              recordStatus: projectMilestone.status,
              sourceRecordId: projectMilestone.id,
            })
            .from(projectMilestone)
            .innerJoin(project, eq(project.id, projectMilestone.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(projectMilestone.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Project Release": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: projectRelease.projectId,
              recordStatus: projectRelease.status,
              sourceRecordId: projectRelease.id,
            })
            .from(projectRelease)
            .innerJoin(project, eq(project.id, projectRelease.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(projectRelease.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        case "Production Incident": {
          const rows = await executor
            .select({
              accountId: workspace.ownerAccountId,
              projectArchivedAt: project.archivedAt,
              projectId: productionIncident.projectId,
              recordStatus: productionIncident.status,
              sourceRecordId: productionIncident.id,
            })
            .from(productionIncident)
            .innerJoin(project, eq(project.id, productionIncident.projectId))
            .innerJoin(workspace, eq(workspace.id, project.workspaceId))
            .where(
              and(
                inArray(productionIncident.id, sourceIds),
                inArray(workspace.ownerAccountId, accountIds),
              ),
            );
          rememberRows(result, sourceRecordType, rows);
          break;
        }
        default:
          assertNever(sourceRecordType);
      }
    }),
  );
  return result;
}

async function findOwnedSource(
  executor: Pick<Database, "select">,
  accountId: string,
  sourceRecordType: PersonalReminderSourceType,
  sourceRecordId: string,
) {
  const sources = await findOwnedSources(executor, [
    { accountId, sourceRecordId, sourceRecordType },
  ]);
  return sources.get(sourceKey(accountId, sourceRecordType, sourceRecordId));
}

function projectIsStillOpen(status: string | null) {
  if (status === "Active" || status === "Pending") {
    return true;
  }
  return status === "Completed" || status === "Abandoned" ? false : null;
}

function workIsStillOpen(source: OwnedSource) {
  if (source.recordArchivedAt || source.recordTrashedAt) {
    return false;
  }
  if (!source.recordStatus) {
    return null;
  }
  return source.recordStatus !== "Closed";
}

function riskIsStillOpen(life: string | null) {
  return life ? life !== "Resolved" && life !== "Accepted" : null;
}

function milestoneIsStillOpen(status: string | null) {
  return status ? status !== "Reached" && status !== "Abandoned" : null;
}

function incidentIsStillOpen(status: string | null) {
  return status ? status !== "Resolved" : null;
}

function sourceStillOpen(
  sourceRecordType: PersonalReminderSourceType,
  source: OwnedSource | undefined,
) {
  if (!source) {
    return null;
  }
  switch (sourceRecordType) {
    case "Project":
      return projectIsStillOpen(source.recordStatus);
    case "Work":
      return workIsStillOpen(source);
    case "Risk":
      return riskIsStillOpen(source.recordLife);
    case "Milestone":
      return milestoneIsStillOpen(source.recordStatus);
    case "Production Incident":
      return incidentIsStillOpen(source.recordStatus);
    case "Document":
    case "Decision":
    case "Project Release":
      return null;
    default:
      return assertNever(sourceRecordType);
  }
}

function unavailableConditionNote(
  sourceRecordType: PersonalReminderSourceType,
) {
  if (sourceRecordType === "Work") {
    return "Work is unavailable; the condition could not be evaluated.";
  }
  return `${sourceRecordType} is unavailable; the condition could not be evaluated.`;
}

function decideReminderFire(
  reminder: PersonalReminderRecord,
  source: OwnedSource | undefined,
) {
  const sourceRecordType = sourceRecordTypeOf(reminder);
  if (source?.projectArchivedAt) {
    return {
      emitSignal: false,
      fireNote: "Project is archived; no signal was emitted.",
    };
  }
  if (reminder.condition !== "Only if still open") {
    return { emitSignal: true, fireNote: null };
  }
  if (!source) {
    return {
      emitSignal: true,
      fireNote: unavailableConditionNote(sourceRecordType),
    };
  }
  const stillOpen = sourceStillOpen(sourceRecordType, source);
  if (stillOpen === null) {
    return {
      emitSignal: true,
      fireNote: unavailableConditionNote(sourceRecordType),
    };
  }
  if (stillOpen) {
    return { emitSignal: true, fireNote: null };
  }
  if (sourceRecordType === "Work") {
    return {
      emitSignal: false,
      fireNote:
        source.recordStatus === "Closed"
          ? "Work was Closed; no signal was emitted."
          : "Work is archived or in Trash; no signal was emitted.",
    };
  }
  const life = source.recordLife ?? source.recordStatus;
  return {
    emitSignal: false,
    fireNote: `${sourceRecordType} was ${life}; no signal was emitted.`,
  };
}

function reminderSourcePath(reminder: PersonalReminderRecord) {
  const sourceRecordType = sourceRecordTypeOf(reminder);
  const sourceId = encodeURIComponent(reminder.sourceRecordId);
  if (sourceRecordType === "Project") {
    return `/projects/${sourceId}`;
  }
  const projectPath = reminder.sourceProjectId
    ? `/projects/${encodeURIComponent(reminder.sourceProjectId)}`
    : "/personal-wiki";
  switch (sourceRecordType) {
    case "Document":
      return `${projectPath}#document-${sourceId}`;
    case "Work":
      return `${projectPath}#work-${sourceId}`;
    case "Decision":
      return `${projectPath}#source-decision-${sourceId}`;
    case "Risk":
      return `${projectPath}#source-risk-${sourceId}`;
    case "Milestone":
      return `${projectPath}#source-milestone-${sourceId}`;
    case "Project Release":
      return `${projectPath}#source-project-release-${sourceId}`;
    case "Production Incident":
      return `${projectPath}#source-production-incident-${sourceId}`;
    default:
      return assertNever(sourceRecordType);
  }
}

async function persistReminderFire(
  executor: Pick<Database, "insert" | "update">,
  reminder: PersonalReminderRecord,
  at: Date,
  decisionForFire: ReturnType<typeof decideReminderFire>,
): Promise<PersonalReminderSignal | null> {
  const [updated] = await executor
    .update(personalReminder)
    .set({
      fireNote: decisionForFire.fireNote,
      status: "Triggered",
      triggeredAt: at,
    })
    .where(
      and(
        eq(personalReminder.id, reminder.id),
        eq(personalReminder.status, "Planned"),
      ),
    )
    .returning({ id: personalReminder.id });
  if (!(updated && decisionForFire.emitSignal)) {
    return null;
  }

  const signalType =
    reminder.action === "Review Later" ? "review-later" : "personal-reminder";
  const sourceRecordType = sourceRecordTypeOf(reminder);
  const signal: PersonalReminderSignal = {
    evaluationNote: decisionForFire.fireNote,
    occurredAt: at.toISOString(),
    signalId: `${signalType}:${reminder.id}`,
    signalType,
    sourcePath: reminderSourcePath(reminder),
    sourceProjectId: reminder.sourceProjectId,
    sourceRecordId: reminder.sourceRecordId,
    sourceRecordType,
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
  cancelWorkReviewLater: (
    accountId: string,
    reminderId: string,
  ) => Promise<WorkReviewLater | null>;
  createWorkReviewLater: (
    accountId: string,
    input: CreateWorkReviewLaterInput,
  ) => Promise<WorkReviewLater | null>;
  fireDuePersonalReminders: (now?: Date) => Promise<PersonalReminderFireResult>;
  fireDueWorkReviewLater: (now?: Date) => Promise<WorkReviewLaterFireResult>;
  listWorkReviewLater: (
    accountId: string,
    workId: string,
  ) => Promise<WorkReviewLater[] | null>;
} {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function create(
    accountId: string,
    input: CreatePersonalReminderInput,
  ): Promise<PersonalReminder | null> {
    const fireAt = new Date(input.fireAt);
    if (fireAt.valueOf() <= now().valueOf()) {
      throw new PersonalReminderFireAtMustBeFutureError();
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
          throw new PersonalReminderIdempotencyConflictError();
        }
        return toPersonalReminder(existing);
      }

      const source = await findOwnedSource(
        transaction,
        accountId,
        input.sourceRecordType,
        input.sourceRecordId,
      );
      if (!source || source.projectArchivedAt) {
        return null;
      }

      const [created] = await transaction
        .insert(personalReminder)
        .values({
          accountId,
          action: input.action,
          clientIdempotencyKey: input.clientIdempotencyKey,
          condition: input.condition ?? "In any case",
          fireAt,
          id: `reminder-${newId()}`,
          sourceProjectId: source.projectId,
          sourceRecordId: source.sourceRecordId,
          sourceRecordType: input.sourceRecordType,
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        return toPersonalReminder(created);
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
        throw new PersonalReminderIdempotencyConflictError();
      }
      return toPersonalReminder(raced);
    });
  }

  async function list(
    accountId: string,
    input: {
      sourceRecordId: string;
      sourceRecordType: PersonalReminderSourceType;
    },
  ): Promise<PersonalReminder[] | null> {
    const source = await findOwnedSource(
      database,
      accountId,
      input.sourceRecordType,
      input.sourceRecordId,
    );
    if (!source) {
      return null;
    }
    const records = await database
      .select()
      .from(personalReminder)
      .where(
        and(
          eq(personalReminder.accountId, accountId),
          eq(personalReminder.sourceRecordId, input.sourceRecordId),
          eq(personalReminder.sourceRecordType, input.sourceRecordType),
        ),
      )
      .orderBy(desc(personalReminder.createdAt), asc(personalReminder.fireAt));
    return records.map(toPersonalReminder);
  }

  async function cancel(
    accountId: string,
    reminderId: string,
    expected?: {
      action?: "Remind me" | "Review Later";
      sourceRecordType?: PersonalReminderSourceType;
    },
  ): Promise<PersonalReminder | null> {
    return await database.transaction(async (transaction) => {
      const plannedFilters = [
        eq(personalReminder.accountId, accountId),
        eq(personalReminder.id, reminderId),
        eq(personalReminder.status, "Planned"),
      ];
      if (expected?.action) {
        plannedFilters.push(eq(personalReminder.action, expected.action));
      }
      if (expected?.sourceRecordType) {
        plannedFilters.push(
          eq(personalReminder.sourceRecordType, expected.sourceRecordType),
        );
      }
      const [cancelled] = await transaction
        .update(personalReminder)
        .set({ cancelledAt: now(), status: "Cancelled" })
        .where(and(...plannedFilters))
        .returning();
      if (cancelled) {
        return toPersonalReminder(cancelled);
      }

      const cancelledFilters = [
        eq(personalReminder.accountId, accountId),
        eq(personalReminder.id, reminderId),
        eq(personalReminder.status, "Cancelled"),
      ];
      if (expected?.action) {
        cancelledFilters.push(eq(personalReminder.action, expected.action));
      }
      if (expected?.sourceRecordType) {
        cancelledFilters.push(
          eq(personalReminder.sourceRecordType, expected.sourceRecordType),
        );
      }
      const [existing] = await transaction
        .select()
        .from(personalReminder)
        .where(and(...cancelledFilters))
        .limit(1);
      return existing ? toPersonalReminder(existing) : null;
    });
  }

  async function fireDuePersonalReminders(at = now()) {
    return await database.transaction(async (transaction) => {
      const due = await transaction
        .select()
        .from(personalReminder)
        .where(
          and(
            eq(personalReminder.status, "Planned"),
            lte(personalReminder.fireAt, at),
          ),
        )
        .orderBy(asc(personalReminder.fireAt))
        .limit(100)
        .for("update");
      const sources = await findOwnedSources(transaction, due);
      const signals = await Promise.all(
        due.map((reminder) => {
          const source = sources.get(
            sourceKey(
              reminder.accountId,
              sourceRecordTypeOf(reminder),
              reminder.sourceRecordId,
            ),
          );
          return persistReminderFire(
            transaction,
            reminder,
            at,
            decideReminderFire(reminder, source),
          );
        }),
      );
      return {
        processedCount: due.length,
        signals: signals.filter(
          (signal): signal is PersonalReminderSignal => signal !== null,
        ),
      };
    });
  }

  async function createWorkReviewLater(
    accountId: string,
    input: CreateWorkReviewLaterInput,
  ) {
    try {
      const reminder = await create(accountId, {
        action: "Review Later",
        clientIdempotencyKey: input.clientIdempotencyKey,
        condition: input.condition,
        fireAt: input.fireAt,
        sourceRecordId: input.workId,
        sourceRecordType: "Work",
      });
      return reminder ? toWorkReviewLater(reminder) : null;
    } catch (error) {
      if (
        error instanceof PersonalReminderFireAtMustBeFutureError ||
        (error instanceof Error &&
          "code" in error &&
          error.code === "PERSONAL_REMINDER_FIRE_AT_MUST_BE_FUTURE")
      ) {
        // biome-ignore lint/style/useErrorCause: The wrapper constructor forwards the cause to Error.
        throw new WorkReviewLaterFireAtMustBeFutureError({ cause: error });
      }
      if (
        error instanceof PersonalReminderIdempotencyConflictError ||
        (error instanceof Error &&
          "code" in error &&
          error.code === "PERSONAL_REMINDER_IDEMPOTENCY_CONFLICT")
      ) {
        // biome-ignore lint/style/useErrorCause: The wrapper constructor forwards the cause to Error.
        throw new WorkReviewLaterIdempotencyConflictError({ cause: error });
      }
      throw error;
    }
  }

  async function listWorkReviewLater(accountId: string, workId: string) {
    const reminders = await list(accountId, {
      sourceRecordId: workId,
      sourceRecordType: "Work",
    });
    return (
      reminders
        ?.filter((reminder) => reminder.action === "Review Later")
        .map(toWorkReviewLater) ?? null
    );
  }

  async function cancelWorkReviewLater(accountId: string, reminderId: string) {
    const reminder = await cancel(accountId, reminderId, {
      action: "Review Later",
      sourceRecordType: "Work",
    });
    return reminder ? toWorkReviewLater(reminder) : null;
  }

  return {
    cancel,
    cancelWorkReviewLater,
    create,
    createWorkReviewLater,
    fireDuePersonalReminders,
    fireDueWorkReviewLater: fireDuePersonalReminders,
    list,
    listWorkReviewLater,
  };
}

function matchesCreateRequest(
  record: PersonalReminderRecord,
  input: CreatePersonalReminderInput,
) {
  return (
    record.action === input.action &&
    record.sourceRecordType === input.sourceRecordType &&
    record.sourceRecordId === input.sourceRecordId &&
    record.condition === (input.condition ?? "In any case") &&
    record.fireAt.valueOf() === new Date(input.fireAt).valueOf()
  );
}
