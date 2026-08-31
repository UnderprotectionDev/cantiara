import type { PrismaClient } from "@cantiara/db";

import {
	changeWorkStatus,
	closeWork,
	getWork,
	listWork,
	reopenWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	isClosureResult,
	isNonTerminalWorkStatus,
	isWorkStatus,
	NON_TERMINAL_WORK_STATUSES,
	WORK_STATUS,
	type WorkView,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type CardVisibleField,
	DEFAULT_CARD_VISIBLE_FIELDS,
	DEFAULT_SAVED_VIEW_SORT,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	KANBAN_LIST_LAYOUT,
	type KanbanBoard,
	type KanbanCard,
	type KanbanCloseOutcome,
	type KanbanColumnStatus,
	type KanbanLifecycleEvent,
	type KanbanList,
	type KanbanMoveOutcome,
	type KanbanPresentationOptions,
	type KanbanReopenOutcome,
	type KanbanSortField,
	type KanbanWorkRecord,
	type SavedViewSort,
	type WorkStatusPort,
} from "./kanban-model";

const NON_TERMINAL = new Set<string>(NON_TERMINAL_WORK_STATUSES);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STATUS_EVENT_KINDS = ["status", "closed", "reopened"] as const;

export interface MemoryWorkStatusPort extends WorkStatusPort {
	automations: string[];
	backlogOrder: () => string[];
	githubWrites: Array<{ status: string; workId: string }>;
	kanbanRanks: () => Record<string, number>;
	sessionOrder: () => string[];
}

export function createMemoryWorkStatusPort(
	records: KanbanWorkRecord[]
): MemoryWorkStatusPort {
	const work = new Map(records.map((record) => [record.id, { ...record }]));
	const membershipByWork = new Map<string, string[]>();
	const eventsByWork = new Map<string, KanbanLifecycleEvent[]>();
	const githubWrites: Array<{ status: string; workId: string }> = [];
	const automations: string[] = [];
	const notifications: string[] = [];
	const healthVerdicts: string[] = [];
	const automaticWorkWrites: string[] = [];
	const backlog = records.map((record) => record.id);
	const session = [...backlog].reverse();
	const kanbanRanks: Record<string, number> = {};
	const port: MemoryWorkStatusPort = {
		automaticWorkWrites,
		automations,
		backlogOrder() {
			return [...backlog];
		},
		closeWork(workId, result, reason) {
			const record = work.get(workId);
			if (!record) {
				return { reason: "target-not-found", status: "rejected" };
			}
			if (!(result && isClosureResult(result))) {
				return { reason: "unknown-closure-result", status: "rejected" };
			}
			record.closureResult = result;
			record.status = WORK_STATUS.closed;
			record.revision += 1;
			appendEvent(eventsByWork, workId, {
				closureResult: result,
				kind: "closed",
				reason: reason ?? null,
				status: WORK_STATUS.closed,
			});
			return {
				closureResult: result,
				status: "committed",
				workflowStatus: WORK_STATUS.closed,
				workId,
			};
		},
		fireSilentAutomation(workId) {
			automations.push(workId);
		},
		get(workId) {
			return work.get(workId) ?? null;
		},
		githubWrites,
		healthVerdicts,
		history(workId) {
			return eventsByWork.get(workId) ?? [];
		},
		kanbanRanks() {
			return { ...kanbanRanks };
		},
		list() {
			return [...work.values()];
		},
		memberships(workId) {
			return membershipByWork.get(workId) ?? [];
		},
		mintHealthVerdict(workId) {
			healthVerdicts.push(workId);
		},
		mintNotification(workId) {
			notifications.push(workId);
		},
		mutateWorkAutomatically(workId) {
			automaticWorkWrites.push(workId);
		},
		notifications,
		recordPlanningMembership(workId, surface) {
			const current = membershipByWork.get(workId) ?? [];
			membershipByWork.set(workId, [...current, surface]);
		},
		reopenWork(workId, status, confirmed) {
			const record = work.get(workId);
			if (!record) {
				return { reason: "target-not-found", status: "rejected" };
			}
			if (record.status !== WORK_STATUS.closed) {
				return { reason: "unknown-work-status", status: "rejected" };
			}
			if (!confirmed) {
				return { reason: "reopen-confirm-required", status: "rejected" };
			}
			if (!isNonTerminalWorkStatus(status)) {
				return { reason: "unknown-work-status", status: "rejected" };
			}
			record.closureResult = null;
			record.status = status;
			record.revision += 1;
			appendEvent(eventsByWork, workId, {
				closureResult: null,
				kind: "reopened",
				reason: null,
				status,
			});
			return { status: "committed", workflowStatus: status, workId };
		},
		sessionOrder() {
			return [...session];
		},
		writeGitHubStatus(workId, status) {
			githubWrites.push({ status, workId });
		},
		writeWorkflowStatus(workId, status) {
			const record = work.get(workId);
			if (!record) {
				return { reason: "target-not-found", status: "rejected" };
			}
			if (record.status === WORK_STATUS.closed) {
				return { reason: "reopen-required", status: "rejected" };
			}
			if (status === WORK_STATUS.closed) {
				return { reason: "close-step-required", status: "rejected" };
			}
			if (!NON_TERMINAL.has(status)) {
				return { reason: "unknown-work-status", status: "rejected" };
			}
			record.status = status;
			record.revision += 1;
			return { status: "committed", workflowStatus: status, workId };
		},
	};
	return port;
}

function appendEvent(
	eventsByWork: Map<string, KanbanLifecycleEvent[]>,
	workId: string,
	event: KanbanLifecycleEvent
) {
	const current = eventsByWork.get(workId) ?? [];
	eventsByWork.set(workId, [...current, event]);
}

export function presentKanbanBoard(
	records: readonly KanbanWorkRecord[],
	options: KanbanPresentationOptions = {}
): KanbanBoard {
	const presentation = normalizePresentation(options);
	const active = records.filter((record) => record.archived !== true);
	const collapsed = new Set(presentation.collapsedStatuses);
	const inProgressCount = active.filter(
		(record) => record.status === WORK_STATUS.inProgress
	).length;
	const focusExceeded =
		typeof presentation.focusThreshold === "number" &&
		inProgressCount > presentation.focusThreshold;
	return {
		columns: KANBAN_COLUMNS.map((status) => {
			const cards = sortRecords(
				active.filter((record) => record.status === status),
				presentation.sort
			).map((record) => toCard(record, presentation));
			const limit = presentation.softWipLimits[status] ?? null;
			const count = cards.length;
			const exceeded = typeof limit === "number" && count > limit;
			return {
				cards,
				collapsed: collapsed.has(status),
				count,
				openBlockerCount: cards.filter((card) => card.openBlocker).length,
				softWip: {
					count,
					exceeded,
					limit,
					mark: exceeded ? KANBAN_COPY.overLimit : null,
				},
				status,
			};
		}),
		copy: KANBAN_COPY,
		focus: {
			count: inProgressCount,
			exceeded: focusExceeded,
			mark: focusExceeded ? KANBAN_COPY.overLimit : null,
			threshold: presentation.focusThreshold,
		},
		inProgressCount,
		sort: presentation.sort,
		visibleFields: presentation.visibleFields,
	};
}

export function collapseKanbanColumn(
	board: KanbanBoard,
	status: KanbanColumnStatus
): KanbanBoard {
	return {
		...board,
		columns: board.columns.map((column) =>
			column.status === status ? { ...column, collapsed: true } : column
		),
	};
}

export function presentKanbanList(
	records: readonly KanbanWorkRecord[],
	options: KanbanPresentationOptions = {}
): KanbanList {
	const board = presentKanbanBoard(records, options);
	return {
		copy: KANBAN_COPY,
		layout: KANBAN_LIST_LAYOUT,
		rows: board.columns.flatMap((column) => column.cards),
		visibleFields: board.visibleFields,
	};
}

export function scanKanbanList(
	port: WorkStatusPort,
	input: { field: CardVisibleField }
): KanbanList {
	const list = presentKanbanList(port.list());
	return {
		...list,
		rows: [...list.rows].sort((left, right) =>
			listFieldValue(left, input.field).localeCompare(
				listFieldValue(right, input.field)
			)
		),
	};
}

export function moveKanbanCard(
	port: WorkStatusPort,
	input: { targetStatus: string; workId: string }
): KanbanMoveOutcome {
	if (!isWorkStatus(input.targetStatus)) {
		return { reason: "unknown-work-status", status: "rejected" };
	}
	const current = port.get(input.workId);
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return port.writeWorkflowStatus(input.workId, input.targetStatus);
}

export function closeKanbanCard(
	port: WorkStatusPort,
	input: { reason?: string; result?: string; workId: string }
): KanbanCloseOutcome {
	if (!port.get(input.workId)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return port.closeWork(input.workId, input.result, input.reason);
}

export function reopenKanbanCard(
	port: WorkStatusPort,
	input: { confirmed: boolean; targetStatus: string; workId: string }
): KanbanReopenOutcome {
	if (!port.get(input.workId)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return port.reopenWork(input.workId, input.targetStatus, input.confirmed);
}

export function applyKanbanPlanningMembership(
	port: WorkStatusPort,
	input: { desiredStatus?: string; surface: string; workId: string }
):
	| { membership: { surface: string }; status: "committed"; workId: string }
	| { reason: "close-step-required"; status: "rejected" }
	| { reason: "target-not-found"; status: "rejected" } {
	if (input.desiredStatus === WORK_STATUS.closed) {
		return { reason: "close-step-required", status: "rejected" };
	}
	if (!port.get(input.workId)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	port.recordPlanningMembership(input.workId, input.surface);
	return {
		membership: { surface: input.surface },
		status: "committed",
		workId: input.workId,
	};
}

export function workViewToKanbanRecord(work: WorkView): KanbanWorkRecord {
	const checklist = work.lightChecklist ?? [];
	return {
		archived: work.archived,
		checklistCompleted: checklist.filter((item) => item.completed).length,
		checklistTotal: checklist.length,
		closureResult: work.closureResult,
		id: work.id,
		key: work.key,
		revision: work.revision,
		status: work.status,
		title: work.title,
		type: work.type,
	};
}

export async function loadKanbanBoard(
	prisma: PrismaClient,
	projectId: string
): Promise<KanbanBoard> {
	const work = await listWork(prisma, projectId, { archived: false });
	const ids = work.map((item) => item.id);
	const [created, events, project, blockers] = await Promise.all([
		ids.length === 0
			? Promise.resolve([])
			: prisma.work.findMany({
					select: { createdAt: true, id: true },
					where: { id: { in: ids } },
				}),
		ids.length === 0
			? Promise.resolve([])
			: prisma.workLifecycleEvent.findMany({
					orderBy: { createdAt: "desc" },
					select: { createdAt: true, workId: true },
					where: { kind: { in: [...STATUS_EVENT_KINDS] }, workId: { in: ids } },
				}),
		prisma.project.findUnique({
			select: {
				focusThreshold: true,
				workStatuses: { select: { semantic: true, softWipLimit: true } },
			},
			where: { id: projectId },
		}),
		ids.length === 0
			? Promise.resolve([])
			: prisma.typedRelation.findMany({
					select: { toId: true },
					where: {
						blockerState: "Active",
						toId: { in: ids },
						toKind: "Work",
						type: "Blocks",
					},
				}),
	]);
	const enteredAt = new Map<string, Date>();
	for (const event of events) {
		if (!enteredAt.has(event.workId)) {
			enteredAt.set(event.workId, event.createdAt);
		}
	}
	const createdAt = new Map(created.map((row) => [row.id, row.createdAt]));
	const blockedIds = new Set(blockers.map((row) => row.toId));
	const softWipLimits: Partial<Record<KanbanColumnStatus, number>> = {};
	for (const status of project?.workStatuses ?? []) {
		if (
			isWorkStatus(status.semantic) &&
			typeof status.softWipLimit === "number" &&
			status.softWipLimit > 0
		) {
			softWipLimits[status.semantic] = status.softWipLimit;
		}
	}
	return presentKanbanBoard(
		work.map((item) => ({
			...workViewToKanbanRecord(item),
			blocker: blockedIds.has(item.id) ? "Active" : null,
			statusEnteredAt: (
				enteredAt.get(item.id) ?? createdAt.get(item.id)
			)?.toISOString(),
		})),
		{
			asOf: calendarDay(new Date()),
			focusThreshold: project?.focusThreshold ?? null,
			now: new Date(),
			softWipLimits,
		}
	);
}

export async function saveKanbanLimits(
	prisma: PrismaClient,
	command: {
		focusThreshold: number | null;
		projectId: string;
		softWipLimits: ReadonlyArray<{
			limit: number | null;
			status: string;
		}>;
	}
): Promise<KanbanBoard> {
	await prisma.project.update({
		data: { focusThreshold: positiveLimit(command.focusThreshold) },
		where: { id: command.projectId },
	});
	await Promise.all(
		command.softWipLimits.flatMap((item) => {
			if (!isWorkStatus(item.status)) {
				return [];
			}
			return [
				prisma.projectWorkStatus.updateMany({
					data: { softWipLimit: positiveLimit(item.limit) },
					where: { projectId: command.projectId, semantic: item.status },
				}),
			];
		})
	);
	return await loadKanbanBoard(prisma, command.projectId);
}

export async function moveKanbanCardForProject(
	prisma: PrismaClient,
	command: {
		actorId: string;
		baseRevision: number;
		idempotencyKey: string;
		targetStatus: string;
		workId: string;
	}
): Promise<KanbanMoveOutcome> {
	if (!isWorkStatus(command.targetStatus)) {
		return { reason: "unknown-work-status", status: "rejected" };
	}
	const current = await getWork(prisma, command.workId);
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (command.targetStatus === WORK_STATUS.closed) {
		return { reason: "close-step-required", status: "rejected" };
	}
	const outcome = await changeWorkStatus(prisma, {
		actorId: command.actorId,
		baseRevision: command.baseRevision,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		status: command.targetStatus,
		workId: command.workId,
	});
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return {
			status: "committed",
			workflowStatus: outcome.work.status,
			workId: outcome.work.id,
		};
	}
	if (
		outcome.status === "rejected" &&
		(outcome.reason === "close-step-required" ||
			outcome.reason === "reopen-required" ||
			outcome.reason === "target-not-found" ||
			outcome.reason === "unknown-work-status")
	) {
		return { reason: outcome.reason, status: "rejected" };
	}
	return { reason: "target-not-found", status: "rejected" };
}

function normalizePresentation(options: KanbanPresentationOptions): Required<
	Pick<KanbanPresentationOptions, "collapsedStatuses" | "visibleFields">
> & {
	asOf: string;
	focusThreshold: number | null;
	now: Date;
	softWipLimits: Partial<Record<KanbanColumnStatus, number>>;
	sort: SavedViewSort;
} {
	const now = options.now ?? new Date();
	return {
		asOf: options.asOf ?? calendarDay(now),
		collapsedStatuses: options.collapsedStatuses ?? [],
		focusThreshold: positiveLimit(options.focusThreshold ?? null),
		now,
		softWipLimits: options.softWipLimits ?? {},
		sort: options.sort ?? DEFAULT_SAVED_VIEW_SORT,
		visibleFields: options.visibleFields ?? DEFAULT_CARD_VISIBLE_FIELDS,
	};
}

export async function closeKanbanCardForProject(
	prisma: PrismaClient,
	command: {
		actorId: string;
		baseRevision: number;
		idempotencyKey: string;
		reason?: string;
		result?: string;
		workId: string;
	}
): Promise<KanbanCloseOutcome> {
	const current = await getWork(prisma, command.workId);
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const outcome = await closeWork(prisma, {
		actorId: command.actorId,
		baseRevision: command.baseRevision,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		reason: command.reason,
		result: command.result,
		workId: command.workId,
	});
	if (outcome.status === "committed" || outcome.status === "replayed") {
		const result = outcome.work.closureResult;
		if (!(result && isClosureResult(result))) {
			return { reason: "unknown-closure-result", status: "rejected" };
		}
		return {
			closureResult: result,
			status: "committed",
			workflowStatus: WORK_STATUS.closed,
			workId: outcome.work.id,
		};
	}
	if (
		outcome.status === "rejected" &&
		(outcome.reason === "unknown-closure-result" ||
			outcome.reason === "target-not-found")
	) {
		return { reason: outcome.reason, status: "rejected" };
	}
	return { reason: "target-not-found", status: "rejected" };
}

export async function reopenKanbanCardForProject(
	prisma: PrismaClient,
	command: {
		actorId: string;
		baseRevision: number;
		confirmed: boolean;
		idempotencyKey: string;
		targetStatus: string;
		workId: string;
	}
): Promise<KanbanReopenOutcome> {
	const current = await getWork(prisma, command.workId);
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const outcome = await reopenWork(prisma, {
		actorId: command.actorId,
		baseRevision: command.baseRevision,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		reopenConfirmed: command.confirmed,
		status: command.targetStatus,
		workId: command.workId,
	});
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return {
			status: "committed",
			workflowStatus: outcome.work.status,
			workId: outcome.work.id,
		};
	}
	if (
		outcome.status === "rejected" &&
		(outcome.reason === "reopen-confirm-required" ||
			outcome.reason === "unknown-work-status" ||
			outcome.reason === "target-not-found")
	) {
		return { reason: outcome.reason, status: "rejected" };
	}
	return { reason: "target-not-found", status: "rejected" };
}

function toCard(
	record: KanbanWorkRecord,
	presentation: {
		asOf: string;
		now: Date;
		visibleFields: readonly CardVisibleField[];
	}
): KanbanCard {
	const values: Record<CardVisibleField, string | null> = {
		Blocker: record.blocker ?? null,
		Checklist: checklistLabel(record),
		Key: record.key,
		"Planned start": record.plannedStart ?? null,
		Priority: record.priority ?? null,
		"Reappear date": record.reappearDate ?? null,
		Risk: record.risk ?? null,
		Status: record.closureResult
			? `${record.status} · ${record.closureResult}`
			: record.status,
		"Target date": record.targetDate ?? null,
		Type: record.type,
	};
	const active = record.status !== WORK_STATUS.closed;
	return {
		background: isBackground(record, presentation.asOf),
		closureResult: record.closureResult ?? null,
		id: record.id,
		key: record.key,
		openBlocker: record.blocker === "Active",
		revision: record.revision,
		status: record.status,
		summary: presentation.visibleFields.flatMap((field) => {
			const value = values[field];
			if (!value) {
				return [];
			}
			return [{ field, value }];
		}),
		timeInCurrentStatus:
			active && record.statusEnteredAt
				? formatTimeInCurrentStatus(record.statusEnteredAt, presentation.now)
				: null,
		title: record.title,
		type: record.type,
		workId: record.id,
	};
}

function listFieldValue(row: KanbanCard, field: CardVisibleField): string {
	if (field === "Key") {
		return row.key;
	}
	return row.summary.find((entry) => entry.field === field)?.value ?? "";
}

function calendarDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function isBackground(record: KanbanWorkRecord, asOf: string): boolean {
	if (!record.reappearDate) {
		return false;
	}
	return record.reappearDate > asOf;
}

function sortRecords(
	records: readonly KanbanWorkRecord[],
	sort: SavedViewSort
): KanbanWorkRecord[] {
	const factor = sort.direction === "desc" ? -1 : 1;
	return [...records].sort((left, right) => {
		const compared =
			sortValue(left, sort.field).localeCompare(sortValue(right, sort.field)) *
			factor;
		if (compared !== 0) {
			return compared;
		}
		return left.key.localeCompare(right.key);
	});
}

function sortValue(record: KanbanWorkRecord, field: KanbanSortField): string {
	const values: Record<KanbanSortField, string> = {
		Key: record.key,
		"Planned start": record.plannedStart ?? "",
		Priority: record.priority ?? "",
		"Reappear date": record.reappearDate ?? "",
		Status: record.status,
		"Target date": record.targetDate ?? "",
		Title: record.title,
		Type: record.type,
	};
	return values[field];
}

function formatTimeInCurrentStatus(enteredAt: string, now: Date): string {
	const elapsed = Math.max(0, now.getTime() - Date.parse(enteredAt));
	if (elapsed < HOUR_MS) {
		return `${Math.floor(elapsed / MINUTE_MS)}m`;
	}
	if (elapsed < DAY_MS) {
		return `${Math.floor(elapsed / HOUR_MS)}h`;
	}
	return `${Math.floor(elapsed / DAY_MS)}d`;
}

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}

function positiveLimit(value: number | null): number | null {
	if (typeof value !== "number" || value <= 0) {
		return null;
	}
	return value;
}
