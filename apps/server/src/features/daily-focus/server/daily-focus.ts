import { calendarDay, getAccountPreferences } from "@cantiara/auth";
import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	calendarDaySchema,
	DAILY_FOCUS_COPY,
	DAILY_FOCUS_PLANNING_WRITES,
	type DailyFocusView,
	type DailyFocusWork,
} from "./daily-focus-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

export type MembershipOutcome =
	| { status: "committed"; view: DailyFocusView }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

export interface DailyFocus {
	add: (input: {
		calendarDay?: string;
		idempotencyKey: string;
		workId: string;
	}) => Promise<MembershipOutcome>;
	remove: (input: {
		calendarDay?: string;
		idempotencyKey: string;
		workId: string;
	}) => Promise<MembershipOutcome>;
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
		operation: "add" | "remove",
		command: {
			calendarDay?: string;
			idempotencyKey: string;
			workId: string;
		}
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
			if (operation === "add") {
				const already = await tx.dailyFocusMembership.findUnique({
					where: {
						accountId_workId_calendarDay: {
							accountId: input.accountId,
							calendarDay: day,
							workId: command.workId,
						},
					},
				});
				if (!already) {
					await tx.dailyFocusMembership.create({
						data: {
							accountId: input.accountId,
							calendarDay: day,
							id: crypto.randomUUID(),
							workId: command.workId,
						},
					});
				}
			} else {
				await tx.dailyFocusMembership.deleteMany({
					where: {
						accountId: input.accountId,
						calendarDay: day,
						workId: command.workId,
					},
				});
			}
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
		add: (command) => mutate("add", command),
		remove: (command) => mutate("remove", command),
		view,
	};
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
	return {
		calendarDay: day,
		copy: DAILY_FOCUS_COPY,
		eligibleWork: eligibleRows
			.filter((row) => !memberIds.has(row.id))
			.map((row) => toWork(row)),
		members,
		planningWrites: DAILY_FOCUS_PLANNING_WRITES,
	};
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
