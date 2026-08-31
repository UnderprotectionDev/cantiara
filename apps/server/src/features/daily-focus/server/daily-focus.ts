import { calendarDay, getAccountPreferences } from "@cantiara/auth";
import { Prisma, type PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	CANDIDATE_COUNTERPARTS,
	CANDIDATE_LIMIT,
	CANDIDATE_REASON,
	calendarDaySchema,
	DAILY_FOCUS_COPY,
	DAILY_FOCUS_PLANNING_WRITES,
	type DailyFocusCandidate,
	type DailyFocusView,
	type DailyFocusWork,
	TARGET_DATE_NEAR_DAYS,
} from "./daily-focus-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

function hasDelegate(
	db: MutationDb,
	name: "dailyFocusCandidateRejection" | "dailyFocusMembership"
): boolean {
	const delegate = (db as unknown as Record<string, { findMany?: unknown }>)[
		name
	];
	return typeof delegate?.findMany === "function";
}

export type MembershipOutcome =
	| { status: "committed"; view: DailyFocusView }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

interface MembershipCommand {
	calendarDay?: string;
	idempotencyKey: string;
	workId: string;
}

export interface DailyFocus {
	accept: (input: MembershipCommand) => Promise<MembershipOutcome>;
	add: (input: MembershipCommand) => Promise<MembershipOutcome>;
	reject: (input: MembershipCommand) => Promise<MembershipOutcome>;
	remove: (input: MembershipCommand) => Promise<MembershipOutcome>;
	view: (input?: { calendarDay?: string }) => Promise<DailyFocusView>;
}

export interface CreateDailyFocusInput {
	accountId: string;
	clock?: { now: () => Date };
	prisma: PrismaClient;
	workspaceId: string;
}

export async function accountProfileCalendarDay(
	prisma: MutationDb,
	accountId: string,
	now: Date
): Promise<string> {
	const preferences = await getAccountPreferences(
		prisma as PrismaClient,
		accountId
	);
	return calendarDay(now, preferences);
}

export function createDailyFocus(input: CreateDailyFocusInput): DailyFocus {
	const now = () => {
		if (input.clock) {
			return input.clock.now();
		}
		return new Date();
	};

	async function resolveDay(selected?: string): Promise<string> {
		if (selected) {
			return calendarDaySchema.parse(selected);
		}
		return await accountProfileCalendarDay(
			input.prisma,
			input.accountId,
			now()
		);
	}

	async function view(
		query: { calendarDay?: string } = {}
	): Promise<DailyFocusView> {
		const day = await resolveDay(query.calendarDay);
		return await loadView(
			input.prisma,
			input.accountId,
			input.workspaceId,
			day
		);
	}

	async function mutate(
		operation: "accept" | "add" | "reject" | "remove",
		command: MembershipCommand
	): Promise<MembershipOutcome> {
		const day = await resolveDay(command.calendarDay);
		const payload = {
			accountId: input.accountId,
			calendarDay: day,
			operation,
			workId: command.workId,
		};
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`daily-focus:${input.accountId}:${day}:${command.workId}`
			);
			const existing = await readDurableReceipt(
				tx,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as MembershipOutcome;
			}
			const work = await tx.work.findFirst({
				where: {
					id: command.workId,
					project: { workspaceId: input.workspaceId },
					retiredIntoId: null,
				},
			});
			if (!work) {
				const missing: MembershipOutcome = { status: "not-found" };
				return missing;
			}
			await applyDailyFocusWrite(tx, {
				accountId: input.accountId,
				calendarDay: day,
				operation,
				workId: command.workId,
			});
			const next = await loadView(tx, input.accountId, input.workspaceId, day);
			const outcome: MembershipOutcome = { status: "committed", view: next };
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey: command.idempotencyKey,
				kind: `daily-focus-${operation}`,
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: command.workId,
			});
			return outcome;
		});
	}

	return {
		accept: (command) => mutate("accept", command),
		add: (command) => mutate("add", command),
		reject: (command) => mutate("reject", command),
		remove: (command) => mutate("remove", command),
		view,
	};
}

async function applyDailyFocusWrite(
	tx: MutationDb,
	input: {
		accountId: string;
		calendarDay: string;
		operation: "accept" | "add" | "reject" | "remove";
		workId: string;
	}
) {
	const key = {
		accountId: input.accountId,
		calendarDay: input.calendarDay,
		workId: input.workId,
	};
	if (input.operation === "remove") {
		await tx.dailyFocusMembership.deleteMany({ where: key });
		return;
	}
	if (input.operation === "reject") {
		await rememberCandidateRejection(tx, key);
		return;
	}
	const already = await tx.dailyFocusMembership.findUnique({
		where: { accountId_workId_calendarDay: key },
	});
	if (!already) {
		await tx.dailyFocusMembership.create({
			data: { ...key, id: crypto.randomUUID() },
		});
	}
}

async function rememberCandidateRejection(
	tx: MutationDb,
	key: { accountId: string; calendarDay: string; workId: string }
) {
	if (hasDelegate(tx, "dailyFocusCandidateRejection")) {
		const already = await tx.dailyFocusCandidateRejection.findUnique({
			where: { accountId_workId_calendarDay: key },
		});
		if (!already) {
			await tx.dailyFocusCandidateRejection.create({
				data: { ...key, id: crypto.randomUUID() },
			});
		}
		return;
	}
	await tx.$executeRaw`
		INSERT INTO "daily_focus_candidate_rejection"
			(id, "accountId", "workId", "calendarDay", "createdAt", "updatedAt")
		VALUES (
			${crypto.randomUUID()},
			${key.accountId},
			${key.workId},
			${key.calendarDay},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		ON CONFLICT ("accountId", "workId", "calendarDay") DO NOTHING
	`;
}

async function listRejectedWorkIds(
	db: MutationDb,
	accountId: string,
	day: string
): Promise<Set<string>> {
	if (hasDelegate(db, "dailyFocusCandidateRejection")) {
		const rejected = await db.dailyFocusCandidateRejection.findMany({
			select: { workId: true },
			where: { accountId, calendarDay: day },
		});
		return new Set(rejected.map((row) => row.workId));
	}
	const rows = await db.$queryRaw<Array<{ workId: string }>>`
		SELECT "workId" FROM "daily_focus_candidate_rejection"
		WHERE "accountId" = ${accountId} AND "calendarDay" = ${day}
	`;
	return new Set(rows.map((row) => row.workId));
}

async function loadView(
	db: MutationDb,
	accountId: string,
	workspaceId: string,
	day: string
): Promise<DailyFocusView> {
	const rows = await db.dailyFocusMembership.findMany({
		include: {
			work: {
				include: { project: true },
			},
		},
		orderBy: { createdAt: "asc" },
		where: { accountId, calendarDay: day },
	});
	const members = rows
		.filter(
			(row) =>
				row.work.project.workspaceId === workspaceId &&
				row.work.retiredIntoId === null
		)
		.map((row) => toWork(row.work));
	const memberIds = new Set(members.map((row) => row.id));
	const eligibleRows = await db.work.findMany({
		include: { project: true },
		orderBy: [{ projectId: "asc" }, { number: "asc" }],
		where: {
			archived: false,
			project: { workspaceId },
			retiredIntoId: null,
		},
	});
	const rejectedIds = await listRejectedWorkIds(db, accountId, day);
	const datedRows = await withWorkPlanningDates(db, eligibleRows);
	const horizon = addCalendarDays(day, TARGET_DATE_NEAR_DAYS);
	const candidates = datedRows
		.filter(
			(row) =>
				!(
					memberIds.has(row.id) ||
					rejectedIds.has(row.id) ||
					row.status === WORK_STATUS.closed ||
					row.trashedAt
				)
		)
		.flatMap((row) => {
			const reason = candidateReason(row, day, horizon);
			if (!reason) {
				return [];
			}
			return [{ ...toWork(row), reason }];
		})
		.sort(compareCandidates)
		.slice(0, CANDIDATE_LIMIT);
	return {
		calendarDay: day,
		candidateCounterparts: CANDIDATE_COUNTERPARTS,
		candidates,
		copy: DAILY_FOCUS_COPY,
		eligibleWork: eligibleRows
			.filter((row) => !memberIds.has(row.id))
			.map((row) => toWork(row)),
		members,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
	};
}

async function withWorkPlanningDates<
	T extends {
		id: string;
		reappearDate?: string | null;
		targetDate?: string | null;
	},
>(db: MutationDb, rows: T[]): Promise<T[]> {
	if (rows.every((row) => "targetDate" in row && "reappearDate" in row)) {
		return rows;
	}
	if (rows.length === 0) {
		return rows;
	}
	const dates = await db.$queryRaw<
		Array<{
			id: string;
			reappearDate: string | null;
			targetDate: string | null;
		}>
	>`
		SELECT id, "reappearDate", "targetDate"
		FROM work
		WHERE id IN (${Prisma.join(
			rows.map((row) => Prisma.sql`${row.id}`),
			", "
		)})
	`;
	const byId = new Map(dates.map((row) => [row.id, row]));
	return rows.map((row) => {
		const found = byId.get(row.id);
		if (!found) {
			return row;
		}
		return { ...row, ...found };
	});
}

function candidateReason(
	row: { reappearDate?: string | null; targetDate?: string | null },
	day: string,
	horizon: string
): DailyFocusCandidate["reason"] | null {
	if (row.reappearDate && row.reappearDate <= day) {
		return CANDIDATE_REASON.reappearDate;
	}
	if (row.targetDate && row.targetDate >= day && row.targetDate <= horizon) {
		return CANDIDATE_REASON.targetDate;
	}
	return null;
}

function compareCandidates(
	left: DailyFocusCandidate,
	right: DailyFocusCandidate
): number {
	if (left.reason !== right.reason) {
		return left.reason === CANDIDATE_REASON.reappearDate ? -1 : 1;
	}
	return left.key.localeCompare(right.key);
}

function addCalendarDays(day: string, days: number): string {
	const [year, month, date] = day.split("-").map(Number);
	const next = new Date(
		Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days)
	);
	return next.toISOString().slice(0, 10);
}

function toWork(row: {
	id: string;
	key: string;
	project: { id: string; name: string };
	projectId: string;
	title: string;
}): DailyFocusWork {
	return {
		id: row.id,
		key: row.key,
		projectId: row.projectId,
		projectName: row.project.name,
		title: row.title,
	};
}
