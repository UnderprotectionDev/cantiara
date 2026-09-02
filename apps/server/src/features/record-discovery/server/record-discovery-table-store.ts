import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	createWorkInTransaction,
	updateWorkTitle,
} from "../../work-lifecycle/server/work-lifecycle";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import {
	applyInlineCell,
	applyTablePaste,
	openTypeTable,
	type PastePreviewRow,
	previewTablePaste,
	queryTypeTable,
	type TableRecord,
	type TableSortField,
} from "./record-discovery-table";

function toTableRecord(row: {
	id: string;
	key: string;
	projectId: string;
	revision: number;
	status: string;
	title: string;
}): TableRecord {
	return {
		id: row.id,
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: row.projectId,
		recordKey: row.key,
		revision: row.revision,
		sessionTests: [],
		status: row.status,
		title: row.title,
	};
}

export async function loadTypeTable(
	prisma: PrismaClient,
	input: {
		filterText: string;
		kind: string;
		sortDirection: "asc" | "desc";
		sortField: TableSortField;
		workspaceId: string;
	}
) {
	const opened = openTypeTable(input.kind);
	if (opened.status !== "ok") {
		return { opened, view: null };
	}
	const records =
		input.kind === RECORD_DISCOVERY_COPY.work
			? await loadWorkRows(prisma, input.workspaceId)
			: [];
	return {
		opened,
		view: queryTypeTable(records, {
			filterText: input.filterText,
			kind: input.kind,
			sortDirection: input.sortDirection,
			sortField: input.sortField,
		}),
	};
}

export async function applyTypeTableCell(
	prisma: PrismaClient,
	input: {
		actorId: string;
		baseRevision: number;
		field: string;
		idempotencyKey: string;
		kind: string;
		recordId: string;
		value: string;
		workspaceId: string;
	}
) {
	if (input.kind !== RECORD_DISCOVERY_COPY.work) {
		if (openTypeTable(input.kind).status !== "ok") {
			return {
				reason: "table-not-allowed" as const,
				status: "refused" as const,
			};
		}
		return {
			reason: "field-not-writable" as const,
			status: "refused" as const,
		};
	}
	const row = await prisma.work.findFirst({
		where: {
			id: input.recordId,
			project: { workspaceId: input.workspaceId },
			trashedAt: null,
		},
	});
	if (!row) {
		return { reason: "table-not-allowed" as const, status: "refused" as const };
	}
	const decided = applyInlineCell({
		field: input.field,
		kind: input.kind,
		row: toTableRecord(row),
		value: input.value,
	});
	if (decided.status !== "ok") {
		return decided;
	}
	const outcome = await updateWorkTitle(prisma, {
		actorId: input.actorId,
		baseRevision: input.baseRevision,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		title: decided.row.title,
		workId: row.id,
	});
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return {
			row: toTableRecord({
				id: outcome.work.id,
				key: outcome.work.key,
				projectId: outcome.work.projectId,
				revision: outcome.work.revision,
				status: outcome.work.status,
				title: outcome.work.title,
			}),
			status: "ok" as const,
		};
	}
	return { reason: "field-not-writable" as const, status: "refused" as const };
}

export async function persistTablePaste(
	prisma: PrismaClient,
	input: {
		actorId: string;
		excludedIndexes: readonly number[];
		headers: readonly string[];
		idempotencyKey: string;
		kind: string;
		mapping: { key: number | null; title: number };
		projectId: string | null;
		rows: readonly (readonly string[])[];
		workspaceId: string;
	}
) {
	const existing =
		input.kind === RECORD_DISCOVERY_COPY.work
			? await loadWorkRows(prisma, input.workspaceId)
			: [];
	const preview = previewTablePaste({
		existing,
		headers: input.headers,
		kind: input.kind,
		mapping: input.mapping,
		projectId: input.projectId,
		rows: input.rows,
	});
	if (input.kind !== RECORD_DISCOVERY_COPY.work) {
		return {
			decided: {
				reason: "table-not-allowed" as const,
				records: existing,
				status: "rejected" as const,
			},
			preview,
		};
	}
	const decided = applyTablePaste({
		excludedIndexes: input.excludedIndexes,
		existing,
		preview,
	});
	if (decided.status !== "ok") {
		return { decided, preview };
	}
	const excluded = new Set(input.excludedIndexes);
	const included = preview.rows.filter((row) => !excluded.has(row.index));
	try {
		await prisma.$transaction((tx) =>
			writeIncludedPasteRows(tx, included, input)
		);
	} catch {
		return {
			decided: {
				reason: "partial-refused" as const,
				records: existing,
				status: "rejected" as const,
			},
			preview,
		};
	}
	return { decided: { ...decided, status: "ok" as const }, preview };
}

async function loadWorkRows(prisma: PrismaClient, workspaceId: string) {
	const rows = await prisma.work.findMany({
		select: {
			id: true,
			key: true,
			projectId: true,
			revision: true,
			status: true,
			title: true,
		},
		where: {
			project: { workspaceId },
			trashedAt: null,
		},
	});
	return rows.map(toTableRecord);
}

async function writeIncludedPasteRows(
	tx: Prisma.TransactionClient,
	included: readonly PastePreviewRow[],
	input: {
		actorId: string;
		idempotencyKey: string;
		projectId: string | null;
	}
) {
	for (const row of included) {
		if (row.action === "update" && row.recordId) {
			// biome-ignore lint/performance/noAwaitInLoops: paste rows share one transaction and must apply in order or abort together.
			const current = await tx.work.findUnique({
				where: { id: row.recordId },
			});
			if (!current || current.revision !== row.revision) {
				throw new Error("paste-aborted");
			}
			if (current.title !== row.title) {
				await tx.work.update({
					data: {
						revision: current.revision + 1,
						title: row.title,
					},
					where: { id: current.id },
				});
			}
		}
		if (row.action === "create" && input.projectId) {
			const outcome = await createWorkInTransaction(tx, {
				actorId: input.actorId,
				idempotencyKey: `${input.idempotencyKey}:${row.index}`,
				origin: "human",
				payload: {
					projectId: input.projectId,
					title: row.title,
				},
			});
			if (outcome.status !== "committed" && outcome.status !== "replayed") {
				throw new Error("paste-aborted");
			}
		}
	}
}
