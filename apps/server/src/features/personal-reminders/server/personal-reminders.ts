import type { Prisma, PrismaClient } from "@cantiara/db";

import { DECISION_LIFE } from "../../decisions/server/decisions-model";
import { extractSection } from "../../documents/server/documents-live";
import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	PERSONAL_REMINDER_ACTION,
	PERSONAL_REMINDER_CONDITION,
	PERSONAL_REMINDER_HISTORY_KIND,
	PERSONAL_REMINDER_LIFE,
	PERSONAL_REMINDER_SOURCE_TYPE,
	PERSONAL_REMINDERS_COPY,
	type PersonalReminderAction,
	type PersonalReminderCondition,
	type PersonalReminderConditionEvaluation,
	type PersonalReminderHistoryEntry,
	type PersonalReminderSignalId,
	type PersonalReminderSignalView,
	type PersonalReminderSourceType,
	type PersonalReminderView,
	personalReminderHistoryEntrySchema,
	personalReminderSignalViewSchema,
	personalRemindersCatalog,
	personalReminderViewSchema,
	signalIdForAction,
	sourceTypeHasStillOpenLife,
} from "./personal-reminders-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

interface ReminderRow {
	accountId: string;
	createdByAction: string;
	documentSectionId: string | null;
	fireAt: Date | string;
	id: string;
	life: string;
	sourceId: string;
	sourceType: string;
	stillOpenCondition: string;
}

export type PersonalReminderOutcome =
	| { reminder: PersonalReminderView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

export type PersonalReminderReassessOutcome =
	| PersonalReminderOutcome
	| { status: "skipped" };

export type PersonalReminderConditionOutcome =
	| (PersonalReminderConditionEvaluation & { status: "evaluated" })
	| { status: "not-found" };

export type PersonalReminderOpenTarget =
	| {
			kind: "record";
			sourceId: string;
			sourceType: PersonalReminderSourceType;
	  }
	| {
			documentId: string;
			heading: string;
			kind: "document-section";
			sectionId: string;
	  }
	| {
			documentId: string;
			explanation: typeof PERSONAL_REMINDERS_COPY.missingSection;
			kind: "missing-section";
			sectionId: string;
	  }
	| {
			kind: "broken-reference";
			reason: typeof PERSONAL_REMINDERS_COPY.permanentlyDeleted;
			sourceId: string;
			sourceType: PersonalReminderSourceType;
	  };

interface CreateCommand {
	createdByAction: PersonalReminderAction;
	documentSectionId?: string | null;
	fireAt: string;
	idempotencyKey: string;
	sourceId: string;
	sourceType: PersonalReminderSourceType;
	stillOpenCondition?: PersonalReminderCondition;
}

interface CancelCommand {
	idempotencyKey: string;
	reminderId: string;
}

interface SourceQuery {
	sourceId: string;
	sourceType: PersonalReminderSourceType;
}

interface ReassessImpactCommand {
	fireAt: string | null;
	idempotencyKey: string;
	projectReleaseId: string;
}

interface DismissCommand {
	idempotencyKey: string;
	reminderId: string;
}

interface RescheduleCommand {
	fireAt: string;
	idempotencyKey: string;
	reminderId: string;
}

export interface PersonalReminderScheduler {
	cancel: (reminderId: string) => Promise<void>;
	dueIds: (now: Date) => Promise<string[]>;
	schedule: (reminderId: string, fireAt: Date) => Promise<void>;
}

export interface PersonalReminders {
	cancel: (input: CancelCommand) => Promise<PersonalReminderOutcome>;
	catalog: () => ReturnType<typeof personalRemindersCatalog>;
	create: (input: CreateCommand) => Promise<PersonalReminderOutcome>;
	createFromReassessImpact: (
		input: ReassessImpactCommand
	) => Promise<PersonalReminderReassessOutcome>;
	dismiss: (input: DismissCommand) => Promise<PersonalReminderOutcome>;
	evaluateCondition: (
		reminderId: string
	) => Promise<PersonalReminderConditionOutcome>;
	fireDue: () => Promise<void>;
	get: (reminderId: string) => Promise<PersonalReminderView | null>;
	history: (reminderId: string) => Promise<PersonalReminderHistoryEntry[]>;
	list: () => Promise<PersonalReminderView[]>;
	listDue: () => Promise<PersonalReminderView[]>;
	listForSource: (query: SourceQuery) => Promise<PersonalReminderView[]>;
	listSignals: () => Promise<PersonalReminderSignalView[]>;
	openTarget: (
		reminderId: string
	) => Promise<PersonalReminderOpenTarget | null>;
	reschedule: (input: RescheduleCommand) => Promise<PersonalReminderOutcome>;
}

export interface CreatePersonalRemindersInput {
	accountId: string;
	clock?: { now: () => Date };
	prisma: PrismaClient;
	scheduler?: PersonalReminderScheduler;
	workspaceId: string;
}

function parseFireAt(value: string): Date | null {
	if (value.trim().length === 0) {
		return null;
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed;
}

function viewOpenTarget(
	row: ReminderRow,
	body: string | null,
	sourceFound: boolean
): PersonalReminderView["openTarget"] {
	if (!sourceFound) {
		return {
			kind: "broken-reference",
			reason: PERSONAL_REMINDERS_COPY.permanentlyDeleted,
		};
	}
	if (
		row.sourceType !== PERSONAL_REMINDER_SOURCE_TYPE.document ||
		row.documentSectionId === null
	) {
		return { kind: "record" };
	}
	if (body === null) {
		return {
			explanation: PERSONAL_REMINDERS_COPY.missingSection,
			kind: "missing-section",
			sectionId: row.documentSectionId,
		};
	}
	const section = extractSection(body, row.documentSectionId);
	if (!section) {
		return {
			explanation: PERSONAL_REMINDERS_COPY.missingSection,
			kind: "missing-section",
			sectionId: row.documentSectionId,
		};
	}
	return {
		heading: section.heading,
		kind: "document-section",
		sectionId: row.documentSectionId,
	};
}

function toView(
	row: ReminderRow,
	body: string | null,
	sourceFound: boolean
): PersonalReminderView {
	const fireAt = row.fireAt instanceof Date ? row.fireAt : new Date(row.fireAt);
	return personalReminderViewSchema.parse({
		accountId: row.accountId,
		createdByAction: row.createdByAction,
		documentSectionId: row.documentSectionId,
		fireAt: fireAt.toISOString(),
		id: row.id,
		life: row.life,
		openTarget: viewOpenTarget(row, body, sourceFound),
		sourceId: row.sourceId,
		sourceType: row.sourceType,
		stillOpenCondition: row.stillOpenCondition,
	});
}

async function documentBodies(
	db: MutationDb,
	workspaceId: string,
	rows: ReminderRow[]
): Promise<Map<string, string>> {
	const ids = [
		...new Set(
			rows
				.filter(
					(row) => row.sourceType === PERSONAL_REMINDER_SOURCE_TYPE.document
				)
				.map((row) => row.sourceId)
		),
	];
	if (ids.length === 0) {
		return new Map();
	}
	const documents = await db.document.findMany({
		select: { body: true, id: true },
		where: { id: { in: ids }, workspaceId },
	});
	return new Map(documents.map((document) => [document.id, document.body]));
}

async function sourceFoundMap(
	db: MutationDb,
	workspaceId: string,
	rows: ReminderRow[]
): Promise<Map<string, boolean>> {
	const entries = await Promise.all(
		rows.map(async (row) => {
			const found = await sourceExists(
				db,
				workspaceId,
				row.sourceType as PersonalReminderSourceType,
				row.sourceId
			);
			return [row.id, found] as const;
		})
	);
	return new Map(entries);
}

async function viewsFor(
	db: MutationDb,
	workspaceId: string,
	rows: ReminderRow[]
): Promise<PersonalReminderView[]> {
	const bodies = await documentBodies(db, workspaceId, rows);
	const found = await sourceFoundMap(db, workspaceId, rows);
	return rows.map((row) =>
		toView(row, bodies.get(row.sourceId) ?? null, found.get(row.id) === true)
	);
}

async function listReminderRows(
	db: MutationDb,
	where: {
		accountId: string;
		sourceId?: string;
		sourceType?: PersonalReminderSourceType;
	}
): Promise<ReminderRow[]> {
	if (where.sourceId !== undefined && where.sourceType !== undefined) {
		return await db.$queryRaw<ReminderRow[]>`
			SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
			FROM "personal_reminder"
			WHERE "accountId" = ${where.accountId}
				AND "sourceId" = ${where.sourceId}
				AND "sourceType" = ${where.sourceType}
			ORDER BY "fireAt" ASC
		`;
	}
	return await db.$queryRaw<ReminderRow[]>`
		SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
		FROM "personal_reminder"
		WHERE "accountId" = ${where.accountId}
		ORDER BY "fireAt" ASC
	`;
}

async function getReminderRow(
	db: MutationDb,
	accountId: string,
	reminderId: string
): Promise<ReminderRow | null> {
	const rows = await db.$queryRaw<ReminderRow[]>`
		SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
		FROM "personal_reminder"
		WHERE "accountId" = ${accountId} AND id = ${reminderId}
		LIMIT 1
	`;
	const [row] = rows;
	return row ?? null;
}

async function insertReminderRow(
	db: MutationDb,
	row: {
		accountId: string;
		createdByAction: PersonalReminderAction;
		documentSectionId: string | null;
		fireAt: Date;
		id: string;
		sourceId: string;
		sourceType: PersonalReminderSourceType;
		stillOpenCondition: PersonalReminderCondition;
	}
): Promise<ReminderRow> {
	const inserted = await db.$queryRaw<ReminderRow[]>`
		INSERT INTO "personal_reminder" (
			id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life, "createdAt", "updatedAt"
		)
		VALUES (
			${row.id},
			${row.accountId},
			${row.fireAt},
			${row.sourceType},
			${row.sourceId},
			${row.createdByAction},
			${row.documentSectionId},
			${row.stillOpenCondition},
			${PERSONAL_REMINDER_LIFE.planned},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
	`;
	const [created] = inserted;
	if (!created) {
		throw new Error("personal reminder insert returned no row");
	}
	return created;
}

async function cancelReminderRow(
	db: MutationDb,
	accountId: string,
	reminderId: string
): Promise<ReminderRow | null> {
	const updated = await db.$queryRaw<ReminderRow[]>`
		UPDATE "personal_reminder"
		SET life = ${PERSONAL_REMINDER_LIFE.cancelled}, "updatedAt" = CURRENT_TIMESTAMP
		WHERE "accountId" = ${accountId} AND id = ${reminderId}
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
	`;
	const [row] = updated;
	return row ?? null;
}

interface HistoryRow {
	at: Date | string;
	kind: string;
	reason: string | null;
	signalId: string | null;
	sourceLife: string | null;
}

interface SignalRow {
	dismissedAt: Date | string | null;
	reason: string | null;
	reminderId: string;
	signalId: string;
	sourceId: string;
	sourceType: string;
}

async function setReminderLife(
	db: MutationDb,
	accountId: string,
	reminderId: string,
	life: string
): Promise<ReminderRow | null> {
	const updated = await db.$queryRaw<ReminderRow[]>`
		UPDATE "personal_reminder"
		SET life = ${life}, "updatedAt" = CURRENT_TIMESTAMP
		WHERE "accountId" = ${accountId} AND id = ${reminderId}
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
	`;
	const [row] = updated;
	return row ?? null;
}

async function setReminderFireAt(
	db: MutationDb,
	accountId: string,
	reminderId: string,
	fireAt: Date,
	life: string
): Promise<ReminderRow | null> {
	const updated = await db.$queryRaw<ReminderRow[]>`
		UPDATE "personal_reminder"
		SET "fireAt" = ${fireAt}, life = ${life}, "updatedAt" = CURRENT_TIMESTAMP
		WHERE "accountId" = ${accountId} AND id = ${reminderId}
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", "documentSectionId", "stillOpenCondition", life
	`;
	const [row] = updated;
	return row ?? null;
}

async function insertHistoryRow(
	db: MutationDb,
	row: {
		at: Date;
		kind: string;
		reason: string | null;
		reminderId: string;
		signalId: string | null;
		sourceLife: string | null;
	}
): Promise<void> {
	await db.$executeRaw`
		INSERT INTO "personal_reminder_history" (
			id, "reminderId", at, kind, "sourceLife", reason, "signalId", "createdAt"
		)
		VALUES (
			${crypto.randomUUID()},
			${row.reminderId},
			${row.at},
			${row.kind},
			${row.sourceLife},
			${row.reason},
			${row.signalId},
			CURRENT_TIMESTAMP
		)
	`;
}

async function listHistoryRows(
	db: MutationDb,
	reminderId: string
): Promise<HistoryRow[]> {
	return await db.$queryRaw<HistoryRow[]>`
		SELECT at, kind, "sourceLife", reason, "signalId"
		FROM "personal_reminder_history"
		WHERE "reminderId" = ${reminderId}
		ORDER BY at ASC
	`;
}

async function insertSignalRow(
	db: MutationDb,
	row: {
		reason: string | null;
		reminderId: string;
		signalId: PersonalReminderSignalId;
	}
): Promise<void> {
	await db.$executeRaw`
		INSERT INTO "personal_reminder_signal" (
			id, "reminderId", "signalId", reason, "dismissedAt", "createdAt", "updatedAt"
		)
		VALUES (
			${crypto.randomUUID()},
			${row.reminderId},
			${row.signalId},
			${row.reason},
			NULL,
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
	`;
}

async function listOpenSignalRows(
	db: MutationDb,
	accountId: string
): Promise<SignalRow[]> {
	return await db.$queryRaw<SignalRow[]>`
		SELECT
			s."dismissedAt",
			s.reason,
			s."reminderId",
			s."signalId",
			r."sourceId",
			r."sourceType"
		FROM "personal_reminder_signal" s
		INNER JOIN "personal_reminder" r ON r.id = s."reminderId"
		WHERE r."accountId" = ${accountId} AND s."dismissedAt" IS NULL
		ORDER BY s."createdAt" ASC
	`;
}

async function dismissOpenSignals(
	db: MutationDb,
	reminderId: string,
	at: Date
): Promise<void> {
	await db.$executeRaw`
		UPDATE "personal_reminder_signal"
		SET "dismissedAt" = ${at}, "updatedAt" = CURRENT_TIMESTAMP
		WHERE "reminderId" = ${reminderId} AND "dismissedAt" IS NULL
	`;
}

async function projectIsArchived(
	db: MutationDb,
	workspaceId: string,
	sourceType: PersonalReminderSourceType,
	sourceId: string
): Promise<boolean> {
	const projectId = await sourceProjectId(
		db,
		workspaceId,
		sourceType,
		sourceId
	);
	if (!projectId) {
		return false;
	}
	const rows = await db.$queryRaw<{ archivedAt: Date | string | null }[]>`
		SELECT "archivedAt"
		FROM "project"
		WHERE id = ${projectId} AND "workspaceId" = ${workspaceId}
		LIMIT 1
	`;
	const [project] = rows;
	return project?.archivedAt !== undefined && project.archivedAt !== null;
}

async function sourceProjectId(
	db: MutationDb,
	workspaceId: string,
	sourceType: PersonalReminderSourceType,
	sourceId: string
): Promise<string | null> {
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.project) {
		return sourceId;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.work) {
		const work = await db.work.findFirst({
			select: { projectId: true },
			where: { id: sourceId, project: { workspaceId } },
		});
		return work?.projectId ?? null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.document) {
		const document = await db.document.findFirst({
			select: { projectId: true },
			where: { id: sourceId, workspaceId },
		});
		return document?.projectId ?? null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.milestone) {
		const milestone = await db.milestone.findFirst({
			select: { projectId: true },
			where: { id: sourceId, project: { workspaceId } },
		});
		return milestone?.projectId ?? null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.decision) {
		const decision = await db.decision.findFirst({
			select: { projectId: true },
			where: { id: sourceId, project: { workspaceId } },
		});
		return decision?.projectId ?? null;
	}
	return null;
}

async function sourceExists(
	db: MutationDb,
	workspaceId: string,
	sourceType: PersonalReminderSourceType,
	sourceId: string
): Promise<boolean> {
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.project) {
		const project = await db.project.findFirst({
			where: { id: sourceId, workspaceId },
		});
		return project !== null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.work) {
		const work = await db.work.findFirst({
			where: { id: sourceId, project: { workspaceId } },
		});
		return work !== null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.document) {
		const document = await db.document.findFirst({
			where: { id: sourceId, workspaceId },
		});
		return document !== null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.milestone) {
		const milestone = await db.milestone.findFirst({
			where: { id: sourceId, project: { workspaceId } },
		});
		return milestone !== null;
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.decision) {
		const decision = await db.decision.findFirst({
			where: { id: sourceId, project: { workspaceId } },
		});
		return decision !== null;
	}
	return false;
}

async function loadDocumentBody(
	db: MutationDb,
	workspaceId: string,
	documentId: string
): Promise<string | null> {
	const document = await db.document.findFirst({
		select: { body: true },
		where: { id: documentId, workspaceId },
	});
	return document?.body ?? null;
}

async function readSourceLife(
	db: MutationDb,
	workspaceId: string,
	sourceType: PersonalReminderSourceType,
	sourceId: string
): Promise<PersonalReminderConditionEvaluation["sourceLife"]> {
	if (!sourceTypeHasStillOpenLife(sourceType)) {
		return "not-applicable";
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.work) {
		const work = await db.work.findFirst({
			select: { status: true },
			where: { id: sourceId, project: { workspaceId } },
		});
		if (!work) {
			return "unevaluable";
		}
		return work.status === WORK_STATUS.closed ? "resolved" : "open";
	}
	if (sourceType === PERSONAL_REMINDER_SOURCE_TYPE.decision) {
		const decision = await db.decision.findFirst({
			select: { life: true },
			where: { id: sourceId, project: { workspaceId } },
		});
		if (!decision) {
			return "unevaluable";
		}
		return decision.life === DECISION_LIFE.valid ? "open" : "resolved";
	}
	const milestone = await db.milestone.findFirst({
		select: { status: true },
		where: { id: sourceId, project: { workspaceId } },
	});
	if (!milestone) {
		return "unevaluable";
	}
	return milestone.status === "Planned" ? "open" : "resolved";
}

function evaluationFor(
	condition: PersonalReminderCondition,
	sourceLife: PersonalReminderConditionEvaluation["sourceLife"]
): PersonalReminderConditionEvaluation {
	if (condition === PERSONAL_REMINDER_CONDITION.inAnyCase) {
		return {
			condition,
			holds: true,
			reason: null,
			sourceLife,
		};
	}
	if (sourceLife === "open") {
		return {
			condition,
			holds: true,
			reason: null,
			sourceLife,
		};
	}
	if (sourceLife === "resolved") {
		return {
			condition,
			holds: false,
			reason: PERSONAL_REMINDERS_COPY.sourceNoLongerOpen,
			sourceLife,
		};
	}
	return {
		condition,
		holds: false,
		reason: PERSONAL_REMINDERS_COPY.couldNotEvaluate,
		sourceLife,
	};
}

function toConsumerOpenTarget(
	view: PersonalReminderView
): PersonalReminderOpenTarget {
	if (view.openTarget.kind === "document-section") {
		return {
			documentId: view.sourceId,
			heading: view.openTarget.heading,
			kind: "document-section",
			sectionId: view.openTarget.sectionId,
		};
	}
	if (view.openTarget.kind === "missing-section") {
		return {
			documentId: view.sourceId,
			explanation: view.openTarget.explanation,
			kind: "missing-section",
			sectionId: view.openTarget.sectionId,
		};
	}
	if (view.openTarget.kind === "broken-reference") {
		return {
			kind: "broken-reference",
			reason: view.openTarget.reason,
			sourceId: view.sourceId,
			sourceType: view.sourceType,
		};
	}
	return {
		kind: "record",
		sourceId: view.sourceId,
		sourceType: view.sourceType,
	};
}

async function recordArchiveStop(
	db: MutationDb,
	reminderId: string,
	instant: Date
): Promise<void> {
	const prior = await listHistoryRows(db, reminderId);
	const alreadyStopped = prior.some(
		(entry) => entry.kind === PERSONAL_REMINDER_HISTORY_KIND.archiveStopped
	);
	if (alreadyStopped) {
		return;
	}
	await insertHistoryRow(db, {
		at: instant,
		kind: PERSONAL_REMINDER_HISTORY_KIND.archiveStopped,
		reason: PERSONAL_REMINDERS_COPY.archivedProject,
		reminderId,
		signalId: null,
		sourceLife: null,
	});
}

async function triggerDueReminder(
	db: MutationDb,
	accountId: string,
	row: ReminderRow,
	evaluation: PersonalReminderConditionEvaluation,
	instant: Date
): Promise<void> {
	const unevaluable =
		!evaluation.holds &&
		evaluation.reason === PERSONAL_REMINDERS_COPY.couldNotEvaluate;
	const signalId = signalIdForAction(
		row.createdByAction as PersonalReminderAction
	);
	await setReminderLife(
		db,
		accountId,
		row.id,
		PERSONAL_REMINDER_LIFE.triggered
	);
	await insertSignalRow(db, {
		reason: unevaluable ? PERSONAL_REMINDERS_COPY.couldNotEvaluate : null,
		reminderId: row.id,
		signalId,
	});
	await insertHistoryRow(db, {
		at: instant,
		kind: unevaluable
			? PERSONAL_REMINDER_HISTORY_KIND.unevaluable
			: PERSONAL_REMINDER_HISTORY_KIND.fired,
		reason: unevaluable ? PERSONAL_REMINDERS_COPY.couldNotEvaluate : null,
		reminderId: row.id,
		signalId,
		sourceLife: evaluation.sourceLife,
	});
}

async function hasTerminalFireHistory(
	db: MutationDb,
	reminderId: string
): Promise<boolean> {
	const prior = await listHistoryRows(db, reminderId);
	return prior.some(
		(entry) =>
			entry.kind === PERSONAL_REMINDER_HISTORY_KIND.suppressed ||
			entry.kind === PERSONAL_REMINDER_HISTORY_KIND.fired ||
			entry.kind === PERSONAL_REMINDER_HISTORY_KIND.unevaluable
	);
}

export function createPersonalReminders(
	input: CreatePersonalRemindersInput
): PersonalReminders {
	const now = () => {
		if (input.clock) {
			return input.clock.now();
		}
		return new Date();
	};
	const scheduler: PersonalReminderScheduler = input.scheduler ?? {
		cancel: () => Promise.resolve(),
		dueIds: async (instant) => {
			const rows = await input.prisma.$queryRaw<{ id: string }[]>`
				SELECT id
				FROM "personal_reminder"
				WHERE "accountId" = ${input.accountId}
					AND life = ${PERSONAL_REMINDER_LIFE.planned}
					AND "fireAt" <= ${instant}
					AND id NOT IN (
						SELECT "reminderId"
						FROM "personal_reminder_history"
						WHERE kind IN (
							${PERSONAL_REMINDER_HISTORY_KIND.suppressed},
							${PERSONAL_REMINDER_HISTORY_KIND.fired},
							${PERSONAL_REMINDER_HISTORY_KIND.unevaluable}
						)
					)
			`;
			return rows.map((row) => row.id);
		},
		schedule: () => Promise.resolve(),
	};

	async function list(): Promise<PersonalReminderView[]> {
		await fireDue();
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
		});
		return viewsFor(input.prisma, input.workspaceId, rows);
	}

	async function listForSource(
		query: SourceQuery
	): Promise<PersonalReminderView[]> {
		await fireDue();
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
			sourceId: query.sourceId,
			sourceType: query.sourceType,
		});
		return viewsFor(input.prisma, input.workspaceId, rows);
	}

	async function get(reminderId: string): Promise<PersonalReminderView | null> {
		await fireDue();
		const row = await getReminderRow(input.prisma, input.accountId, reminderId);
		if (!row) {
			return null;
		}
		const [view] = await viewsFor(input.prisma, input.workspaceId, [row]);
		return view ?? null;
	}

	async function create(
		command: CreateCommand
	): Promise<PersonalReminderOutcome> {
		const sourceId = command.sourceId.trim();
		if (sourceId.length === 0) {
			return {
				reason: PERSONAL_REMINDERS_COPY.sourceRequired,
				status: "invalid",
			};
		}
		const fireAt = parseFireAt(command.fireAt);
		if (!fireAt) {
			return {
				reason: PERSONAL_REMINDERS_COPY.timeRequired,
				status: "invalid",
			};
		}
		if (!personalRemindersCatalog().sourceTypes.includes(command.sourceType)) {
			return {
				reason: PERSONAL_REMINDERS_COPY.unsupportedSource,
				status: "invalid",
			};
		}
		const stillOpenCondition =
			command.stillOpenCondition ?? PERSONAL_REMINDER_CONDITION.inAnyCase;
		if (
			stillOpenCondition === PERSONAL_REMINDER_CONDITION.onlyIfStillOpen &&
			!sourceTypeHasStillOpenLife(command.sourceType)
		) {
			return {
				reason: PERSONAL_REMINDERS_COPY.stillOpenNeedsDefinedLife,
				status: "invalid",
			};
		}
		const requestedSection = command.documentSectionId?.trim() ?? "";
		const documentSectionId =
			requestedSection.length > 0 ? requestedSection : null;
		if (
			documentSectionId !== null &&
			command.sourceType !== PERSONAL_REMINDER_SOURCE_TYPE.document
		) {
			return {
				reason: PERSONAL_REMINDERS_COPY.sectionNeedsDocument,
				status: "invalid",
			};
		}
		const payload = {
			accountId: input.accountId,
			createdByAction: command.createdByAction,
			documentSectionId,
			fireAt: fireAt.toISOString(),
			sourceId,
			sourceType: command.sourceType,
			stillOpenCondition,
		};
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(tx, `personal-reminder:${input.accountId}:create`);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as PersonalReminderOutcome;
			}
			const found = await sourceExists(
				tx,
				input.workspaceId,
				command.sourceType,
				sourceId
			);
			if (!found) {
				return { status: "not-found" };
			}
			if (documentSectionId !== null) {
				const body = await loadDocumentBody(tx, input.workspaceId, sourceId);
				if (body === null || extractSection(body, documentSectionId) === null) {
					return {
						reason: PERSONAL_REMINDERS_COPY.sectionNotFound,
						status: "invalid",
					};
				}
			}
			const created = await insertReminderRow(tx, {
				accountId: input.accountId,
				createdByAction: command.createdByAction,
				documentSectionId,
				fireAt,
				id: crypto.randomUUID(),
				sourceId,
				sourceType: command.sourceType,
				stillOpenCondition,
			});
			const [reminder] = await viewsFor(tx, input.workspaceId, [created]);
			if (!reminder) {
				throw new Error("personal reminder view missing after insert");
			}
			const outcome: PersonalReminderOutcome = {
				reminder,
				status: "committed",
			};
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "personal-reminder.create",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: created.id,
			});
			await scheduler.schedule(created.id, fireAt);
			return outcome;
		});
	}

	async function cancel(
		command: CancelCommand
	): Promise<PersonalReminderOutcome> {
		const payload = { reminderId: command.reminderId };
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`personal-reminder:${input.accountId}:${command.reminderId}`
			);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as PersonalReminderOutcome;
			}
			const updated = await cancelReminderRow(
				tx,
				input.accountId,
				command.reminderId
			);
			if (!updated) {
				return { status: "not-found" };
			}
			const [reminder] = await viewsFor(tx, input.workspaceId, [updated]);
			if (!reminder) {
				throw new Error("personal reminder view missing after cancel");
			}
			const outcome: PersonalReminderOutcome = {
				reminder,
				status: "committed",
			};
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "personal-reminder.cancel",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: updated.id,
			});
			await scheduler.cancel(updated.id);
			return outcome;
		});
	}

	async function createFromReassessImpact(
		command: ReassessImpactCommand
	): Promise<PersonalReminderReassessOutcome> {
		if (command.fireAt === null || command.fireAt.trim().length === 0) {
			return { status: "skipped" };
		}
		return await create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: command.fireAt,
			idempotencyKey: command.idempotencyKey,
			sourceId: command.projectReleaseId,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.projectRelease,
		});
	}

	async function evaluateCondition(
		reminderId: string
	): Promise<PersonalReminderConditionOutcome> {
		const row = await getReminderRow(input.prisma, input.accountId, reminderId);
		if (!row) {
			return { status: "not-found" };
		}
		const sourceLife = await readSourceLife(
			input.prisma,
			input.workspaceId,
			row.sourceType as PersonalReminderSourceType,
			row.sourceId
		);
		return {
			...evaluationFor(
				row.stillOpenCondition as PersonalReminderCondition,
				sourceLife
			),
			status: "evaluated",
		};
	}

	async function openTarget(
		reminderId: string
	): Promise<PersonalReminderOpenTarget | null> {
		const view = await get(reminderId);
		if (!view) {
			return null;
		}
		return toConsumerOpenTarget(view);
	}

	async function fireOne(reminderId: string, instant: Date): Promise<void> {
		await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`personal-reminder:${input.accountId}:${reminderId}:fire`
			);
			const row = await getReminderRow(tx, input.accountId, reminderId);
			if (!row || row.life !== PERSONAL_REMINDER_LIFE.planned) {
				return;
			}
			if (await hasTerminalFireHistory(tx, reminderId)) {
				return;
			}
			const sourceType = row.sourceType as PersonalReminderSourceType;
			if (
				await projectIsArchived(tx, input.workspaceId, sourceType, row.sourceId)
			) {
				await recordArchiveStop(tx, reminderId, instant);
				return;
			}
			const sourceLife = await readSourceLife(
				tx,
				input.workspaceId,
				sourceType,
				row.sourceId
			);
			const evaluation = evaluationFor(
				row.stillOpenCondition as PersonalReminderCondition,
				sourceLife
			);
			if (!evaluation.holds && evaluation.sourceLife === "resolved") {
				await insertHistoryRow(tx, {
					at: instant,
					kind: PERSONAL_REMINDER_HISTORY_KIND.suppressed,
					reason: evaluation.reason,
					reminderId,
					signalId: null,
					sourceLife: evaluation.sourceLife,
				});
				await scheduler.cancel(reminderId);
				return;
			}
			await triggerDueReminder(tx, input.accountId, row, evaluation, instant);
			await scheduler.cancel(reminderId);
		});
	}

	async function fireDue(): Promise<void> {
		const instant = now();
		const dueIds = await scheduler.dueIds(instant);
		await Promise.all(dueIds.map((reminderId) => fireOne(reminderId, instant)));
	}

	async function listSignals(): Promise<PersonalReminderSignalView[]> {
		await fireDue();
		const rows = await listOpenSignalRows(input.prisma, input.accountId);
		return rows.map((row) =>
			personalReminderSignalViewSchema.parse({
				dismissed: row.dismissedAt !== undefined && row.dismissedAt !== null,
				reason: row.reason,
				reminderId: row.reminderId,
				signalId: row.signalId,
				sourceId: row.sourceId,
				sourceType: row.sourceType,
			})
		);
	}

	async function history(
		reminderId: string
	): Promise<PersonalReminderHistoryEntry[]> {
		const row = await getReminderRow(input.prisma, input.accountId, reminderId);
		if (!row) {
			return [];
		}
		const rows = await listHistoryRows(input.prisma, reminderId);
		return rows.map((entry) => {
			const at = entry.at instanceof Date ? entry.at : new Date(entry.at);
			return personalReminderHistoryEntrySchema.parse({
				at: at.toISOString(),
				kind: entry.kind,
				reason: entry.reason,
				signalId: entry.signalId,
				sourceLife: entry.sourceLife,
			});
		});
	}

	async function listDue(): Promise<PersonalReminderView[]> {
		const listed = await list();
		const open = await listSignals();
		const openIds = new Set(open.map((signal) => signal.reminderId));
		return listed.filter(
			(row) =>
				row.life === PERSONAL_REMINDER_LIFE.triggered &&
				row.createdByAction === PERSONAL_REMINDER_ACTION.reviewLater &&
				openIds.has(row.id)
		);
	}

	async function dismiss(
		command: DismissCommand
	): Promise<PersonalReminderOutcome> {
		const payload = { reminderId: command.reminderId };
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		const instant = now();
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`personal-reminder:${input.accountId}:${command.reminderId}`
			);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as PersonalReminderOutcome;
			}
			const row = await getReminderRow(tx, input.accountId, command.reminderId);
			if (!row) {
				return { status: "not-found" };
			}
			await dismissOpenSignals(tx, command.reminderId, instant);
			await insertHistoryRow(tx, {
				at: instant,
				kind: PERSONAL_REMINDER_HISTORY_KIND.dismissed,
				reason: null,
				reminderId: command.reminderId,
				signalId: null,
				sourceLife: null,
			});
			const [reminder] = await viewsFor(tx, input.workspaceId, [row]);
			if (!reminder) {
				throw new Error("personal reminder view missing after dismiss");
			}
			const outcome: PersonalReminderOutcome = {
				reminder,
				status: "committed",
			};
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "personal-reminder.dismiss",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: row.id,
			});
			return outcome;
		});
	}

	async function reschedule(
		command: RescheduleCommand
	): Promise<PersonalReminderOutcome> {
		const fireAt = parseFireAt(command.fireAt);
		if (!fireAt) {
			return {
				reason: PERSONAL_REMINDERS_COPY.timeRequired,
				status: "invalid",
			};
		}
		const payload = {
			fireAt: fireAt.toISOString(),
			reminderId: command.reminderId,
		};
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		const instant = now();
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`personal-reminder:${input.accountId}:${command.reminderId}`
			);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as PersonalReminderOutcome;
			}
			const updated = await setReminderFireAt(
				tx,
				input.accountId,
				command.reminderId,
				fireAt,
				PERSONAL_REMINDER_LIFE.planned
			);
			if (!updated) {
				return { status: "not-found" };
			}
			await dismissOpenSignals(tx, command.reminderId, instant);
			await insertHistoryRow(tx, {
				at: instant,
				kind: PERSONAL_REMINDER_HISTORY_KIND.rescheduled,
				reason: null,
				reminderId: command.reminderId,
				signalId: null,
				sourceLife: null,
			});
			const [reminder] = await viewsFor(tx, input.workspaceId, [updated]);
			if (!reminder) {
				throw new Error("personal reminder view missing after reschedule");
			}
			const outcome: PersonalReminderOutcome = {
				reminder,
				status: "committed",
			};
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "personal-reminder.reschedule",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: updated.id,
			});
			await scheduler.schedule(updated.id, fireAt);
			return outcome;
		});
	}

	return {
		cancel,
		catalog: personalRemindersCatalog,
		create,
		createFromReassessImpact,
		dismiss,
		evaluateCondition,
		fireDue,
		get,
		history,
		list,
		listDue,
		listForSource,
		listSignals,
		openTarget,
		reschedule,
	};
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
