import type { PrismaClient } from "@cantiara/db";

import {
	changeWorkStatus,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	isWorkStatus,
	NON_TERMINAL_WORK_STATUSES,
	WORK_STATUS,
	type WorkView,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type CardVisibleField,
	DEFAULT_CARD_VISIBLE_FIELDS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	type KanbanBoard,
	type KanbanCard,
	type KanbanColumnStatus,
	type KanbanMoveOutcome,
	type KanbanPresentationOptions,
	type KanbanWorkRecord,
	type WorkStatusPort,
} from "./kanban-model";

const NON_TERMINAL = new Set<string>(NON_TERMINAL_WORK_STATUSES);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STATUS_EVENT_KINDS = ["status", "closed", "reopened"] as const;

export interface MemoryWorkStatusPort extends WorkStatusPort {
	automations: string[];
	githubWrites: Array<{ status: string; workId: string }>;
}

export function createMemoryWorkStatusPort(
	records: KanbanWorkRecord[]
): MemoryWorkStatusPort {
	const work = new Map(records.map((record) => [record.id, { ...record }]));
	const membershipByWork = new Map<string, string[]>();
	const githubWrites: Array<{ status: string; workId: string }> = [];
	const automations: string[] = [];
	const notifications: string[] = [];
	const healthVerdicts: string[] = [];
	const automaticWorkWrites: string[] = [];
	const port: MemoryWorkStatusPort = {
		automaticWorkWrites,
		automations,
		fireSilentAutomation(workId) {
			automations.push(workId);
		},
		get(workId) {
			return work.get(workId) ?? null;
		},
		githubWrites,
		healthVerdicts,
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
			const cards = active
				.filter((record) => record.status === status)
				.map((record) => toCard(record, presentation));
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
	focusThreshold: number | null;
	now: Date;
	softWipLimits: Partial<Record<KanbanColumnStatus, number>>;
} {
	return {
		collapsedStatuses: options.collapsedStatuses ?? [],
		focusThreshold: positiveLimit(options.focusThreshold ?? null),
		now: options.now ?? new Date(),
		softWipLimits: options.softWipLimits ?? {},
		visibleFields: options.visibleFields ?? DEFAULT_CARD_VISIBLE_FIELDS,
	};
}

function toCard(
	record: KanbanWorkRecord,
	presentation: {
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
