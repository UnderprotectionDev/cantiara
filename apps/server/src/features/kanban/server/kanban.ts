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
	KANBAN_COLUMNS,
	KANBAN_COPY,
	type KanbanBoard,
	type KanbanCard,
	type KanbanCloseOutcome,
	type KanbanLifecycleEvent,
	type KanbanMoveOutcome,
	type KanbanReopenOutcome,
	type KanbanWorkRecord,
	type WorkStatusPort,
} from "./kanban-model";

const NON_TERMINAL = new Set<string>(NON_TERMINAL_WORK_STATUSES);

export interface MemoryWorkStatusPort extends WorkStatusPort {
	automations: string[];
	githubWrites: Array<{ status: string; workId: string }>;
}

export function createMemoryWorkStatusPort(
	records: KanbanWorkRecord[]
): MemoryWorkStatusPort {
	const work = new Map(records.map((record) => [record.id, { ...record }]));
	const membershipByWork = new Map<string, string[]>();
	const eventsByWork = new Map<string, KanbanLifecycleEvent[]>();
	const githubWrites: Array<{ status: string; workId: string }> = [];
	const automations: string[] = [];
	const port: MemoryWorkStatusPort = {
		automations,
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
		history(workId) {
			return eventsByWork.get(workId) ?? [];
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
	visibleFields: readonly CardVisibleField[] = DEFAULT_CARD_VISIBLE_FIELDS
): KanbanBoard {
	const active = records.filter((record) => record.archived !== true);
	return {
		columns: KANBAN_COLUMNS.map((status) => ({
			cards: active
				.filter((record) => record.status === status)
				.map((record) => toCard(record, visibleFields)),
			status,
		})),
		copy: KANBAN_COPY,
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
	return presentKanbanBoard(work.map(workViewToKanbanRecord));
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
	visibleFields: readonly CardVisibleField[]
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
		closureResult: record.closureResult ?? null,
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

function checklistLabel(record: KanbanWorkRecord): string | null {
	if (record.checklistTotal === undefined || record.checklistTotal === 0) {
		return null;
	}
	return `${record.checklistCompleted ?? 0}/${record.checklistTotal}`;
}
