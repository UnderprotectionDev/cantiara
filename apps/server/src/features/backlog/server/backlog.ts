import { Prisma, type PrismaClient } from "@cantiara/db";

import {
	isPriorityRank,
	PRIORITY_RANKS,
} from "../../priority/server/priority-model";
import { getProject } from "../../project-shell/server/project-shell";
import {
	applyPlanningMembership,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import type { WorkView } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	BACKLOG_COPY,
	BACKLOG_DATE_WRITES,
	BACKLOG_SORT,
	BACKLOG_WRITES,
	type BacklogDateOutcome,
	type BacklogNotificationOutcome,
	type BacklogOrderOutcome,
	type BacklogPlanningOutcome,
	type BacklogSort,
	PLANNING_SURFACE,
	type PlaceOnPlanningSurfaceCommand,
	PREPARED_MEMBERSHIP,
	type PreparedBacklogView,
	placeOnPlanningSurfaceCommandSchema,
	REAPPEAR_DATE_SIGNAL_ID,
	REAPPEAR_DATE_SIGNAL_SECTION,
	REAPPEAR_SIGNAL_WRITES,
	type ReappearDateSignalView,
	reorderManualOrderCommandSchema,
	saveBacklogPresentationCommandSchema,
	setReappearDateCommandSchema,
	setReappearNotificationCommandSchema,
	type TakeUpFromBacklogCommand,
	takeUpFromBacklogCommandSchema,
} from "./backlog-model";

type BacklogDb = PrismaClient | Prisma.TransactionClient;

interface BacklogClock {
	now: () => Date;
}

const PRIORITY_WEIGHT = new Map(
	PRIORITY_RANKS.map((rank, index) => [rank, index])
);

export async function listPreparedBacklog(
	prisma: BacklogDb,
	projectId: string,
	query: { clock?: BacklogClock; sort?: BacklogSort } = {}
): Promise<PreparedBacklogView> {
	const items = await preparedItems(prisma, projectId);
	const savedSort = await savedPresentationSort(prisma, projectId);
	const sort = query.sort ?? savedSort;
	const kind = query.sort === undefined ? "saved" : "temporary";
	const manualOrder = await orderedManualWorkIds(
		prisma,
		projectId,
		items.map((item) => item.id)
	);
	const presented = await presentItems(
		prisma,
		projectId,
		items,
		sort,
		manualOrder
	);
	const asOf = calendarDay(query.clock);
	const deferredIds = new Set(
		items.filter((item) => isDeferred(item, asOf)).map((item) => item.id)
	);
	const optedIn = await readReappearDateNotification(prisma, projectId);
	return toView(
		presented.filter((item) => !deferredIds.has(item.id)),
		orderByIds(items, manualOrder).filter((item) => deferredIds.has(item.id)),
		manualOrder,
		{ kind, sort },
		optedIn,
		reappearDateSignals(items, optedIn, asOf, manualOrder)
	);
}

export async function orderedManualWorkIds(
	prisma: BacklogDb,
	projectId: string,
	preparedIds: readonly string[]
): Promise<string[]> {
	const ranks = await listManualOrderRows(prisma, projectId, preparedIds);
	const prepared = new Set(preparedIds);
	const ordered: string[] = [];
	const seen = new Set<string>();
	for (const rank of ranks) {
		if (prepared.has(rank.workId) && !seen.has(rank.workId)) {
			ordered.push(rank.workId);
			seen.add(rank.workId);
		}
	}
	for (const id of preparedIds) {
		if (!seen.has(id)) {
			ordered.push(id);
		}
	}
	return ordered;
}

export async function reorderManualOrder(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogOrderOutcome> {
	const parsed = reorderManualOrderCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const prepared = await preparedItems(prisma, parsed.data.projectId);
	const preparedIds = new Set(prepared.map((item) => item.id));
	const unique = new Set(parsed.data.workIds);
	if (
		unique.size !== parsed.data.workIds.length ||
		parsed.data.workIds.some((workId) => !preparedIds.has(workId))
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const previous = await orderedManualWorkIds(
		prisma,
		parsed.data.projectId,
		prepared.map((item) => item.id)
	);
	const nextIds = mergeManualOrder(
		previous,
		parsed.data.workIds,
		prepared.map((item) => item.id)
	);
	await prisma.$transaction(async (tx) => {
		await replaceManualOrderRows(tx, parsed.data.projectId, nextIds);
	});
	const backlog = await listPreparedBacklog(prisma, parsed.data.projectId, {
		sort: BACKLOG_SORT.manualOrder,
	});
	return { backlog, status: "committed", writes: BACKLOG_WRITES };
}

export async function setReappearDate(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogDateOutcome> {
	const parsed = setReappearDateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const prepared = await preparedItems(prisma, parsed.data.projectId);
	const work = prepared.find((item) => item.id === parsed.data.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeReappearDate(prisma, work.id, parsed.data.reappearDate);
	const backlog = await listPreparedBacklog(prisma, parsed.data.projectId);
	return { backlog, status: "committed", writes: BACKLOG_DATE_WRITES };
}

export async function setReappearNotification(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogNotificationOutcome> {
	const parsed = setReappearNotificationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = await prisma.project.findUnique({
		select: { id: true },
		where: { id: parsed.data.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeReappearDateNotification(
		prisma,
		parsed.data.projectId,
		parsed.data.optedIn
	);
	const backlog = await listPreparedBacklog(prisma, parsed.data.projectId);
	return { backlog, status: "committed", writes: REAPPEAR_SIGNAL_WRITES };
}

export async function saveBacklogPresentation(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogOrderOutcome> {
	const parsed = saveBacklogPresentationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = await prisma.project.findUnique({
		select: { id: true },
		where: { id: parsed.data.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await upsertPresentationSort(prisma, parsed.data.projectId, parsed.data.sort);
	const backlog = await listPreparedBacklog(prisma, parsed.data.projectId);
	return { backlog, status: "committed", writes: BACKLOG_WRITES };
}

export async function takeUpFromBacklog(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogPlanningOutcome> {
	const parsed = takeUpFromBacklogCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await applyPreparedPlanningMove(prisma, {
		surface: parsed.data.onto ?? PLANNING_SURFACE.dailyFocus,
		workId: parsed.data.workId,
	});
}

export async function placeOnPlanningSurface(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogPlanningOutcome> {
	const parsed = placeOnPlanningSurfaceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await applyPreparedPlanningMove(prisma, parsed.data);
}

export async function projectStagesForWork(
	prisma: PrismaClient,
	workId: string
) {
	const work = await getWork(prisma, workId);
	if (!work) {
		return null;
	}
	const project = await getProject(prisma, work.projectId);
	if (!project) {
		return null;
	}
	return project.stages.map((stage) => ({
		id: stage.id,
		name: stage.name,
		state: stage.state,
	}));
}

async function applyPreparedPlanningMove(
	prisma: PrismaClient,
	command: PlaceOnPlanningSurfaceCommand | TakeUpFromBacklogCommand
): Promise<BacklogPlanningOutcome> {
	const work = await getWork(prisma, command.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const prepared = await listPreparedBacklog(prisma, work.projectId);
	if (
		![...prepared.items, ...prepared.deferred].some(
			(item) => item.id === work.id
		)
	) {
		return { reason: "not-in-prepared-set", status: "rejected" };
	}
	const surface =
		"surface" in command
			? command.surface
			: (command.onto ?? PLANNING_SURFACE.dailyFocus);
	const outcome = await applyPlanningMembership(prisma, {
		surface,
		workId: command.workId,
	});
	if (outcome.status !== "committed") {
		return {
			reason:
				outcome.reason === "close-step-required"
					? "close-step-required"
					: "target-not-found",
			status: "rejected",
		};
	}
	return {
		membership: { surface },
		status: "committed",
		work: outcome.work,
	};
}

async function preparedItems(
	prisma: BacklogDb,
	projectId: string
): Promise<WorkView[]> {
	const [works, trashed] = await Promise.all([
		listWork(prisma as PrismaClient, projectId, { archived: false }),
		prisma.work.findMany({
			select: { id: true },
			where: { projectId, trashedAt: { not: null } },
		}),
	]);
	const trashedIds = new Set(trashed.map((row) => row.id));
	return works.filter((work) => !(work.archived || trashedIds.has(work.id)));
}

async function savedPresentationSort(
	prisma: BacklogDb,
	projectId: string
): Promise<BacklogSort> {
	const row = await readPresentationSort(prisma, projectId);
	if (row && isBacklogSort(row)) {
		return row;
	}
	return BACKLOG_SORT.manualOrder;
}

async function presentItems(
	prisma: BacklogDb,
	projectId: string,
	items: WorkView[],
	sort: BacklogSort,
	manualOrder: readonly string[]
): Promise<WorkView[]> {
	if (sort === BACKLOG_SORT.manualOrder) {
		return orderByIds(items, manualOrder);
	}
	if (sort === BACKLOG_SORT.field) {
		return [...items].sort((left, right) =>
			left.title.localeCompare(right.title)
		);
	}
	if (sort === BACKLOG_SORT.date) {
		const rows = await prisma.work.findMany({
			select: { createdAt: true, id: true },
			where: { id: { in: items.map((item) => item.id) } },
		});
		const createdAt = new Map(
			rows.map((row) => [row.id, row.createdAt.getTime()])
		);
		return [...items].sort((left, right) => {
			const delta =
				(createdAt.get(left.id) ?? 0) - (createdAt.get(right.id) ?? 0);
			if (delta !== 0) {
				return delta;
			}
			return left.number - right.number;
		});
	}
	const values = await prisma.projectPriorityCriterionValue.findMany({
		select: { rank: true, workId: true },
		where: {
			criterion: {
				enabled: true,
				projectId,
				trashedAt: null,
			},
			workId: { in: items.map((item) => item.id) },
		},
	});
	const best = new Map<string, number>();
	for (const { rank, workId } of values) {
		const weight =
			rank && isPriorityRank(rank)
				? (PRIORITY_WEIGHT.get(rank) ?? PRIORITY_RANKS.length)
				: PRIORITY_RANKS.length;
		const current = best.get(workId) ?? PRIORITY_RANKS.length;
		if (weight < current) {
			best.set(workId, weight);
		}
	}
	return [...items].sort((left, right) => {
		const delta =
			(best.get(left.id) ?? PRIORITY_RANKS.length) -
			(best.get(right.id) ?? PRIORITY_RANKS.length);
		if (delta !== 0) {
			return delta;
		}
		return left.number - right.number;
	});
}

function orderByIds(items: WorkView[], ids: readonly string[]): WorkView[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	return ids.flatMap((id) => {
		const item = byId.get(id);
		return item ? [item] : [];
	});
}

function mergeManualOrder(
	previous: readonly string[],
	requested: readonly string[],
	preparedIds: readonly string[]
): string[] {
	const requestedSet = new Set(requested);
	let nextRequested = 0;
	const merged = previous.map((id) => {
		if (!requestedSet.has(id)) {
			return id;
		}
		const replacement = requested[nextRequested];
		nextRequested += 1;
		return replacement ?? id;
	});
	while (nextRequested < requested.length) {
		const extra = requested[nextRequested];
		if (extra) {
			merged.push(extra);
		}
		nextRequested += 1;
	}
	const seen = new Set(merged);
	for (const id of preparedIds) {
		if (!seen.has(id)) {
			merged.push(id);
			seen.add(id);
		}
	}
	return merged;
}

function calendarDay(clock?: BacklogClock): string {
	const now = clock ? clock.now() : new Date();
	return now.toISOString().slice(0, 10);
}

function isDeferred(item: WorkView, asOf: string): boolean {
	return Boolean(item.reappearDate && item.reappearDate > asOf);
}

function reappearDateSignals(
	items: readonly WorkView[],
	optedIn: boolean,
	asOf: string,
	manualOrder: readonly string[]
): ReappearDateSignalView[] {
	if (!optedIn) {
		return [];
	}
	const arrived = new Set(
		items
			.filter((item) => item.reappearDate && item.reappearDate <= asOf)
			.map((item) => item.id)
	);
	return manualOrder.flatMap((workId) => {
		if (!arrived.has(workId)) {
			return [];
		}
		return [
			{
				section: REAPPEAR_DATE_SIGNAL_SECTION,
				signalId: REAPPEAR_DATE_SIGNAL_ID,
				source: { id: workId, kind: "Work" as const },
				workId,
			},
		];
	});
}

function toView(
	items: WorkView[],
	deferred: WorkView[],
	manualOrder: string[],
	presentation: PreparedBacklogView["presentation"],
	optedIn: boolean,
	signals: ReappearDateSignalView[]
): PreparedBacklogView {
	return {
		copy: {
			backlog: BACKLOG_COPY.backlog,
			deferred: BACKLOG_COPY.deferred,
			manualOrder: BACKLOG_COPY.manualOrder,
			notifyOnReappearDate: BACKLOG_COPY.notifyOnReappearDate,
			reappearDate: BACKLOG_COPY.reappearDate,
		},
		deferred,
		items,
		manualOrder,
		membership: PREPARED_MEMBERSHIP,
		presentation,
		reappearNotification: { optedIn },
		signals,
		writes: BACKLOG_WRITES,
	};
}

function isBacklogSort(value: string): value is BacklogSort {
	return (
		value === BACKLOG_SORT.manualOrder ||
		value === BACKLOG_SORT.priority ||
		value === BACKLOG_SORT.date ||
		value === BACKLOG_SORT.field
	);
}

async function writeReappearDate(
	prisma: BacklogDb,
	workId: string,
	reappearDate: string | null
): Promise<void> {
	try {
		await prisma.work.update({
			data: { reappearDate },
			where: { id: workId },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("reappearDate")) {
			throw error;
		}
		await prisma.$executeRaw`
			UPDATE "work"
			SET "reappearDate" = ${reappearDate}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE id = ${workId}
		`;
	}
}

async function readReappearDateNotification(
	prisma: BacklogDb,
	projectId: string
): Promise<boolean> {
	try {
		const row = await prisma.project.findUnique({
			select: { reappearDateNotification: true },
			where: { id: projectId },
		});
		return row?.reappearDateNotification ?? false;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("reappearDateNotification")) {
			throw error;
		}
		const rows = await prisma.$queryRaw<
			Array<{ reappearDateNotification: boolean }>
		>`
			SELECT "reappearDateNotification"
			FROM "project"
			WHERE id = ${projectId}
			LIMIT 1
		`;
		return rows[0]?.reappearDateNotification ?? false;
	}
}

async function writeReappearDateNotification(
	prisma: BacklogDb,
	projectId: string,
	optedIn: boolean
): Promise<void> {
	try {
		await prisma.project.update({
			data: { reappearDateNotification: optedIn },
			where: { id: projectId },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("reappearDateNotification")) {
			throw error;
		}
		await prisma.$executeRaw`
			UPDATE "project"
			SET "reappearDateNotification" = ${optedIn}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE id = ${projectId}
		`;
	}
}

function hasDelegate(
	db: BacklogDb,
	name: "projectBacklogManualOrderItem" | "projectBacklogPresentation"
): boolean {
	const delegate = (db as unknown as Record<string, { findUnique?: unknown }>)[
		name
	];
	return typeof delegate?.findUnique === "function";
}

async function listManualOrderRows(
	prisma: BacklogDb,
	projectId: string,
	preparedIds: readonly string[]
): Promise<Array<{ sortOrder: number; workId: string }>> {
	if (preparedIds.length === 0) {
		return [];
	}
	if (hasDelegate(prisma, "projectBacklogManualOrderItem")) {
		return await prisma.projectBacklogManualOrderItem.findMany({
			orderBy: { sortOrder: "asc" },
			select: { sortOrder: true, workId: true },
			where: { projectId, workId: { in: [...preparedIds] } },
		});
	}
	return await prisma.$queryRaw<Array<{ sortOrder: number; workId: string }>>`
		SELECT "sortOrder", "workId"
		FROM "project_backlog_manual_order_item"
		WHERE "projectId" = ${projectId}
			AND "workId" IN (${Prisma.join([...preparedIds])})
		ORDER BY "sortOrder" ASC
	`;
}

async function replaceManualOrderRows(
	tx: BacklogDb,
	projectId: string,
	workIds: readonly string[]
): Promise<void> {
	if (hasDelegate(tx, "projectBacklogManualOrderItem")) {
		await tx.projectBacklogManualOrderItem.deleteMany({
			where: { projectId },
		});
		if (workIds.length === 0) {
			return;
		}
		await tx.projectBacklogManualOrderItem.createMany({
			data: workIds.map((workId, sortOrder) => ({
				id: crypto.randomUUID(),
				projectId,
				sortOrder,
				workId,
			})),
		});
		return;
	}
	await tx.$executeRaw`
		DELETE FROM "project_backlog_manual_order_item"
		WHERE "projectId" = ${projectId}
	`;
	if (workIds.length === 0) {
		return;
	}
	await tx.$executeRaw`
		INSERT INTO "project_backlog_manual_order_item"
			(id, "projectId", "workId", "sortOrder", "createdAt", "updatedAt")
		VALUES ${Prisma.join(
			workIds.map(
				(workId, sortOrder) =>
					Prisma.sql`(
						${crypto.randomUUID()},
						${projectId},
						${workId},
						${sortOrder},
						CURRENT_TIMESTAMP,
						CURRENT_TIMESTAMP
					)`
			)
		)}
	`;
}

async function readPresentationSort(
	prisma: BacklogDb,
	projectId: string
): Promise<string | null> {
	if (hasDelegate(prisma, "projectBacklogPresentation")) {
		const row = await prisma.projectBacklogPresentation.findUnique({
			select: { sort: true },
			where: { projectId },
		});
		return row?.sort ?? null;
	}
	const rows = await prisma.$queryRaw<Array<{ sort: string }>>`
		SELECT sort FROM "project_backlog_presentation"
		WHERE "projectId" = ${projectId}
		LIMIT 1
	`;
	return rows[0]?.sort ?? null;
}

async function upsertPresentationSort(
	prisma: BacklogDb,
	projectId: string,
	sort: BacklogSort
): Promise<void> {
	if (hasDelegate(prisma, "projectBacklogPresentation")) {
		await prisma.projectBacklogPresentation.upsert({
			create: {
				id: crypto.randomUUID(),
				projectId,
				sort,
			},
			update: { sort },
			where: { projectId },
		});
		return;
	}
	await prisma.$executeRaw`
		INSERT INTO "project_backlog_presentation"
			(id, "projectId", sort, "createdAt", "updatedAt")
		VALUES (
			${crypto.randomUUID()},
			${projectId},
			${sort},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		ON CONFLICT ("projectId") DO UPDATE
		SET sort = EXCLUDED.sort, "updatedAt" = CURRENT_TIMESTAMP
	`;
}
