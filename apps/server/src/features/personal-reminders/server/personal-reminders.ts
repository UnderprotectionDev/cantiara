import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	PERSONAL_REMINDER_LIFE,
	PERSONAL_REMINDER_SOURCE_TYPE,
	PERSONAL_REMINDERS_COPY,
	type PersonalReminderAction,
	type PersonalReminderSourceType,
	type PersonalReminderView,
	personalRemindersCatalog,
	personalReminderViewSchema,
} from "./personal-reminders-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

interface ReminderRow {
	accountId: string;
	createdByAction: string;
	fireAt: Date | string;
	id: string;
	life: string;
	sourceId: string;
	sourceType: string;
}

export type PersonalReminderOutcome =
	| { reminder: PersonalReminderView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

interface CreateCommand {
	createdByAction: PersonalReminderAction;
	fireAt: string;
	idempotencyKey: string;
	sourceId: string;
	sourceType: PersonalReminderSourceType;
}

interface CancelCommand {
	idempotencyKey: string;
	reminderId: string;
}

interface SourceQuery {
	sourceId: string;
	sourceType: PersonalReminderSourceType;
}

export interface PersonalReminders {
	cancel: (input: CancelCommand) => Promise<PersonalReminderOutcome>;
	catalog: () => ReturnType<typeof personalRemindersCatalog>;
	create: (input: CreateCommand) => Promise<PersonalReminderOutcome>;
	get: (reminderId: string) => Promise<PersonalReminderView | null>;
	list: () => Promise<PersonalReminderView[]>;
	listForSource: (query: SourceQuery) => Promise<PersonalReminderView[]>;
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

function toView(row: ReminderRow): PersonalReminderView {
	const fireAt = row.fireAt instanceof Date ? row.fireAt : new Date(row.fireAt);
	return personalReminderViewSchema.parse({
		accountId: row.accountId,
		createdByAction: row.createdByAction,
		fireAt: fireAt.toISOString(),
		id: row.id,
		life: row.life,
		sourceId: row.sourceId,
		sourceType: row.sourceType,
	});
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
			SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life
			FROM "personal_reminder"
			WHERE "accountId" = ${where.accountId}
				AND "sourceId" = ${where.sourceId}
				AND "sourceType" = ${where.sourceType}
			ORDER BY "fireAt" ASC
		`;
	}
	return await db.$queryRaw<ReminderRow[]>`
		SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life
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
		SELECT id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life
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
		fireAt: Date;
		id: string;
		sourceId: string;
		sourceType: PersonalReminderSourceType;
	}
): Promise<ReminderRow> {
	const inserted = await db.$queryRaw<ReminderRow[]>`
		INSERT INTO "personal_reminder" (
			id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life, "createdAt", "updatedAt"
		)
		VALUES (
			${row.id},
			${row.accountId},
			${row.fireAt},
			${row.sourceType},
			${row.sourceId},
			${row.createdByAction},
			${PERSONAL_REMINDER_LIFE.planned},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life
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
		RETURNING id, "accountId", "fireAt", "sourceType", "sourceId", "createdByAction", life
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
	return false;
}

export function createPersonalReminders(
	input: CreatePersonalRemindersInput
): PersonalReminders {
	async function list(): Promise<PersonalReminderView[]> {
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
		});
		return rows.map(toView);
	}

	async function listForSource(
		query: SourceQuery
	): Promise<PersonalReminderView[]> {
		const rows = await listReminderRows(input.prisma, {
			accountId: input.accountId,
			sourceId: query.sourceId,
			sourceType: query.sourceType,
		});
		return rows.map(toView);
	}

	async function get(reminderId: string): Promise<PersonalReminderView | null> {
		const row = await getReminderRow(input.prisma, input.accountId, reminderId);
		if (!row) {
			return null;
		}
		return toView(row);
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
		const payload = {
			accountId: input.accountId,
			createdByAction: command.createdByAction,
			fireAt: fireAt.toISOString(),
			sourceId,
			sourceType: command.sourceType,
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
			const created = await insertReminderRow(tx, {
				accountId: input.accountId,
				createdByAction: command.createdByAction,
				fireAt,
				id: crypto.randomUUID(),
				sourceId,
				sourceType: command.sourceType,
			});
			const outcome: PersonalReminderOutcome = {
				reminder: toView(created),
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
			const outcome: PersonalReminderOutcome = {
				reminder: toView(updated),
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

	return {
		cancel,
		catalog: personalRemindersCatalog,
		create,
		get,
		list,
		listForSource,
	};
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
