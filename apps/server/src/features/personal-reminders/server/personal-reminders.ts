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
	PERSONAL_REMINDER_LIFE,
	PERSONAL_REMINDER_SOURCE_TYPE,
	PERSONAL_REMINDERS_COPY,
	type PersonalReminderAction,
	type PersonalReminderCondition,
	type PersonalReminderConditionEvaluation,
	type PersonalReminderSourceType,
	type PersonalReminderView,
	personalRemindersCatalog,
	personalReminderViewSchema,
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

export interface PersonalReminders {
	cancel: (input: CancelCommand) => Promise<PersonalReminderOutcome>;
	catalog: () => ReturnType<typeof personalRemindersCatalog>;
	create: (input: CreateCommand) => Promise<PersonalReminderOutcome>;
	createFromReassessImpact: (
		input: ReassessImpactCommand
	) => Promise<PersonalReminderReassessOutcome>;
	evaluateCondition: (
		reminderId: string
	) => Promise<PersonalReminderConditionOutcome>;
	get: (reminderId: string) => Promise<PersonalReminderView | null>;
	list: () => Promise<PersonalReminderView[]>;
	listForSource: (query: SourceQuery) => Promise<PersonalReminderView[]>;
	openTarget: (
		reminderId: string
	) => Promise<PersonalReminderOpenTarget | null>;
}

export interface CreatePersonalRemindersInput {
	accountId: string;
	prisma: PrismaClient;
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
	body: string | null
): PersonalReminderView["openTarget"] {
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

function toView(row: ReminderRow, body: string | null): PersonalReminderView {
	const fireAt = row.fireAt instanceof Date ? row.fireAt : new Date(row.fireAt);
	return personalReminderViewSchema.parse({
		accountId: row.accountId,
		createdByAction: row.createdByAction,
		documentSectionId: row.documentSectionId,
		fireAt: fireAt.toISOString(),
		id: row.id,
		life: row.life,
		openTarget: viewOpenTarget(row, body),
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

async function viewsFor(
	db: MutationDb,
	workspaceId: string,
	rows: ReminderRow[]
): Promise<PersonalReminderView[]> {
	const bodies = await documentBodies(db, workspaceId, rows);
	return rows.map((row) => toView(row, bodies.get(row.sourceId) ?? null));
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
	return {
		kind: "record",
		sourceId: view.sourceId,
		sourceType: view.sourceType,
	};
}

export function createPersonalReminders(
	input: CreatePersonalRemindersInput
): PersonalReminders {
	async function list(): Promise<PersonalReminderView[]> {
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
		});
		return viewsFor(input.prisma, input.workspaceId, rows);
	}

	async function listForSource(
		query: SourceQuery
	): Promise<PersonalReminderView[]> {
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
			sourceId: query.sourceId,
			sourceType: query.sourceType,
		});
		return viewsFor(input.prisma, input.workspaceId, rows);
	}

	async function get(reminderId: string): Promise<PersonalReminderView | null> {
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

	return {
		cancel,
		catalog: personalRemindersCatalog,
		create,
		createFromReassessImpact,
		evaluateCondition,
		get,
		list,
		listForSource,
		openTarget,
	};
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
