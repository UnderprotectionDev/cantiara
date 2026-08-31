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
	DEFAULT_SAVED_VIEW_SORT,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	type KanbanBoard,
	type KanbanBoardPresentation,
	type KanbanCard,
	type KanbanMoveOutcome,
	type KanbanSortField,
	type KanbanWorkRecord,
	type SavedViewSort,
	type WorkStatusPort,
} from "./kanban-model";

const NON_TERMINAL = new Set<string>(NON_TERMINAL_WORK_STATUSES);

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
	const githubWrites: Array<{ status: string; workId: string }> = [];
	const automations: string[] = [];
	const backlog = records.map((record) => record.id);
	const session = [...backlog].reverse();
	const kanbanRanks: Record<string, number> = {};
	const port: MemoryWorkStatusPort = {
		automations,
		backlogOrder() {
			return [...backlog];
		},
		fireSilentAutomation(workId) {
			automations.push(workId);
		},
		get(workId) {
			return work.get(workId) ?? null;
		},
		githubWrites,
		kanbanRanks() {
			return { ...kanbanRanks };
		},
		list() {
			return [...work.values()];
		},
		memberships(workId) {
			return membershipByWork.get(workId) ?? [];
		},
		recordPlanningMembership(workId, surface) {
			const current = membershipByWork.get(workId) ?? [];
			membershipByWork.set(workId, [...current, surface]);
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

export function presentKanbanBoard(
	records: readonly KanbanWorkRecord[],
	presentation: KanbanBoardPresentation = {}
): KanbanBoard {
	const {
		asOf,
		sort = DEFAULT_SAVED_VIEW_SORT,
		visibleFields = DEFAULT_CARD_VISIBLE_FIELDS,
	} = presentation;
	const active = records.filter((record) => record.archived !== true);
	return {
		columns: KANBAN_COLUMNS.map((status) => ({
			cards: sortRecords(
				active.filter((record) => record.status === status),
				sort
			).map((record) => toCard(record, visibleFields, asOf)),
			status,
		})),
		copy: KANBAN_COPY,
		sort,
		visibleFields,
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
	return presentKanbanBoard(work.map(workViewToKanbanRecord), {
		asOf: calendarDay(new Date()),
	});
}

function calendarDay(date: Date): string {
	return date.toISOString().slice(0, 10);
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

function toCard(
	record: KanbanWorkRecord,
	visibleFields: readonly CardVisibleField[],
	asOf?: string
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
	return {
		background: isBackground(record, asOf),
		id: record.id,
		key: record.key,
		revision: record.revision,
		status: record.status,
		summary: visibleFields.flatMap((field) => {
			const value = values[field];
			if (!value) {
				return [];
			}
			return [{ field, value }];
		}),
		title: record.title,
		type: record.type,
		workId: record.id,
	};
}

function isBackground(record: KanbanWorkRecord, asOf?: string): boolean {
	if (!(asOf && record.reappearDate)) {
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

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}
