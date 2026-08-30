import type { PrismaClient } from "@cantiara/db";

import { isRecord } from "../../mutation-core/server/mutation-shared";
import { previewClose } from "../../work-lifecycle/server/work-lifecycle";
import {
	type ClosePreview,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	BULK_EDITING_COPY,
	previewBulkEditInputSchema,
	previewBulkFieldChangeSchema,
} from "./bulk-editing-model";

const FORBIDDEN_CHANGE_KEYS = ["createField", "importRecords", "newField"];

export interface BulkFieldDiff {
	from: string | null;
	id: "status" | "title" | "closureResult";
	to: string;
}

export interface BulkEditPreviewRecord {
	fields: BulkFieldDiff[];
	key: string;
	title: string;
	workId: string;
}

export type PreviewBulkEditOutcome =
	| {
			closePreview: ClosePreview | { reason: "target-not-found" };
			preview: {
				copy: typeof BULK_EDITING_COPY;
				records: BulkEditPreviewRecord[];
			};
			status: "ok";
	  }
	| {
			preview: {
				copy: typeof BULK_EDITING_COPY;
				records: BulkEditPreviewRecord[];
			};
			status: "ok";
	  }
	| {
			closePreview: ClosePreview | { reason: "target-not-found" };
			reason: "close-step-required";
			status: "rejected";
	  }
	| {
			reason:
				| "selection-required"
				| "schema-or-import-refused"
				| "target-not-found";
			status: "rejected";
	  };

export async function previewBulkEdit(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewBulkEditOutcome> {
	if (!isRecord(input)) {
		return { reason: "selection-required", status: "rejected" };
	}
	const selectedWorkIds = Array.isArray(input.selectedWorkIds)
		? input.selectedWorkIds.filter(
				(id): id is string => typeof id === "string" && id.length > 0
			)
		: [];
	if (selectedWorkIds.length === 0) {
		return { reason: "selection-required", status: "rejected" };
	}
	if (hasForbiddenChanges(input.changes)) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const parsedChanges = previewBulkFieldChangeSchema.safeParse(
		input.changes ?? {}
	);
	if (!parsedChanges.success) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const envelope = previewBulkEditInputSchema.safeParse({
		changes: parsedChanges.data,
		filterWorkIds: input.filterWorkIds,
		selectedWorkIds,
	});
	if (!envelope.success) {
		return { reason: "schema-or-import-refused", status: "rejected" };
	}
	const { changes } = envelope.data;
	if (
		changes.status === WORK_STATUS.closed &&
		changes.closureResult === undefined
	) {
		return {
			closePreview: await invokeCloseResult(prisma, selectedWorkIds),
			reason: "close-step-required",
			status: "rejected",
		};
	}
	const rows = await prisma.work.findMany({
		where: { id: { in: selectedWorkIds } },
	});
	if (rows.length !== selectedWorkIds.length) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const records: BulkEditPreviewRecord[] = [];
	for (const workId of selectedWorkIds) {
		const row = byId.get(workId);
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		records.push({
			fields: diffsFor(row, changes),
			key: row.key,
			title: row.title,
			workId: row.id,
		});
	}
	const preview = {
		copy: BULK_EDITING_COPY,
		records,
	};
	if (changes.status !== WORK_STATUS.closed) {
		return { preview, status: "ok" };
	}
	return {
		closePreview: await invokeCloseResult(prisma, selectedWorkIds),
		preview,
		status: "ok",
	};
}

async function invokeCloseResult(
	prisma: PrismaClient,
	selectedWorkIds: string[]
) {
	const previews = await Promise.all(
		selectedWorkIds.map((workId) => previewClose(prisma, { workId }))
	);
	return previews[0] ?? { reason: "target-not-found" as const };
}

function hasForbiddenChanges(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return FORBIDDEN_CHANGE_KEYS.some((key) => key in value);
}

function diffsFor(
	row: { closureResult: string | null; status: string; title: string },
	changes: {
		closureResult?: string;
		status?: string;
		title?: string;
	}
): BulkFieldDiff[] {
	const fields: BulkFieldDiff[] = [];
	if (changes.status !== undefined && changes.status !== row.status) {
		fields.push({ from: row.status, id: "status", to: changes.status });
	}
	if (
		changes.closureResult !== undefined &&
		changes.closureResult !== row.closureResult
	) {
		fields.push({
			from: row.closureResult,
			id: "closureResult",
			to: changes.closureResult,
		});
	}
	if (changes.title !== undefined && changes.title !== row.title) {
		fields.push({ from: row.title, id: "title", to: changes.title });
	}
	return fields;
}
