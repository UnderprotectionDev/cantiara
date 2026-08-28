import type { Prisma, PrismaClient } from "@cantiara/db";
import { lockMutation } from "../../mutation-core/server/durable-mutation";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import { getFileAttachment } from "./file-attachments";
import {
	FILE_ATTACHMENT_COPY,
	FILE_KIND,
	FILE_PIN_KIND,
	type FileMark,
	FORBIDDEN_MARKING_TOOLS,
	fileMarksSchema,
	LOCATION_SURFACE,
	type LocationGeometry,
	locationGeometrySchema,
	MARKING_TOOLS,
	type MarkingTool,
	SHARE_PUBLISH_ITEM_KIND,
	type SharePublishItemKind,
	shareItemApprovalsSchema,
} from "./file-attachments-model";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

export interface MarkingLayerView {
	canUndo: boolean;
	contentHash: string;
	fileAttachmentId: string;
	marks: FileMark[];
	versionId: string;
	versionNumber: number;
}

export interface SharePublishItemView {
	approved: boolean;
	kind: SharePublishItemKind;
	label:
		| typeof FILE_ATTACHMENT_COPY.markingLayer
		| typeof FILE_ATTACHMENT_COPY.sourceVisual;
}

export type MarkingOutcome =
	| { layer: MarkingLayerView; status: "committed" }
	| { reason: string; status: "rejected" };

export type SharePublishOutcome =
	| { items: SharePublishItemView[]; status: "ok" }
	| { reason: string; status: "rejected" };

export type LocationBindPreview =
	| {
			fileScope: { kind: string; projectId?: string };
			observationIsWork: false;
			originLocation: {
				componentKind: string;
				ownerKind: "File Attachment";
				sourceVersionId: string;
			};
			previewAcknowledged: false;
			status: "ok";
			work: { id: string | null; title: string };
	  }
	| { reason: string; status: "rejected" };

export type LocationBindOutcome =
	| {
			file: NonNullable<Awaited<ReturnType<typeof getFileAttachment>>>;
			locationId: string;
			observationIsWork: false;
			originLocation: {
				componentId: string;
				ownerId: string;
				ownerKind: "File Attachment";
				sourceVersion: string;
			};
			status: "committed";
			work: { id: string; title: string };
	  }
	| { reason: string; status: "rejected" };

function isMarkingKind(kind: string): boolean {
	return kind === FILE_KIND.image || kind === FILE_KIND.pdf;
}

function isMarkingTool(value: string): value is MarkingTool {
	return (Object.values(MARKING_TOOLS) as string[]).includes(value);
}

function parseMarks(value: Prisma.JsonValue): FileMark[] {
	const parsed = fileMarksSchema.safeParse(value);
	return parsed.success ? parsed.data : [];
}

function parseApprovals(
	value: Prisma.JsonValue
): Record<SharePublishItemKind, boolean> {
	const parsed = shareItemApprovalsSchema.safeParse(value);
	return {
		[SHARE_PUBLISH_ITEM_KIND.markingLayer]:
			parsed.success &&
			parsed.data[SHARE_PUBLISH_ITEM_KIND.markingLayer] === true,
		[SHARE_PUBLISH_ITEM_KIND.sourceVisual]:
			parsed.success &&
			parsed.data[SHARE_PUBLISH_ITEM_KIND.sourceVisual] === true,
	};
}

function shareItemsFrom(
	approvals: Record<SharePublishItemKind, boolean>
): SharePublishItemView[] {
	return [
		{
			approved: approvals[SHARE_PUBLISH_ITEM_KIND.sourceVisual],
			kind: SHARE_PUBLISH_ITEM_KIND.sourceVisual,
			label: FILE_ATTACHMENT_COPY.sourceVisual,
		},
		{
			approved: approvals[SHARE_PUBLISH_ITEM_KIND.markingLayer],
			kind: SHARE_PUBLISH_ITEM_KIND.markingLayer,
			label: FILE_ATTACHMENT_COPY.markingLayer,
		},
	];
}

async function versionRow(prisma: PrismaDb, versionId: string) {
	return await prisma.fileAttachmentVersion.findUnique({
		include: { fileAttachment: true },
		where: { id: versionId },
	});
}

function layerView(row: {
	contentHash: string;
	fileAttachmentId: string;
	id: string;
	markingMarks: Prisma.JsonValue;
	versionNumber: number;
}): MarkingLayerView {
	const marks = parseMarks(row.markingMarks);
	return {
		canUndo: marks.length > 0,
		contentHash: row.contentHash,
		fileAttachmentId: row.fileAttachmentId,
		marks,
		versionId: row.id,
		versionNumber: row.versionNumber,
	};
}

export async function getMarkingLayer(
	prisma: PrismaClient,
	versionId: string
): Promise<MarkingOutcome> {
	const row = await versionRow(prisma, versionId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (!isMarkingKind(row.kind)) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	return { layer: layerView(row), status: "committed" };
}

export async function appendMark(
	prisma: PrismaClient,
	input: {
		geometry: Record<string, unknown>;
		page?: number;
		tool: string;
		versionId: string;
	}
): Promise<MarkingOutcome> {
	// The public marking command has no idempotency key; the transaction lock
	// prevents lost updates, while a repeated command intentionally appends
	// another mark rather than guessing whether it was a retry.
	if ((FORBIDDEN_MARKING_TOOLS as readonly string[]).includes(input.tool)) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	if (!isMarkingTool(input.tool)) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	return await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `file-marking:${input.versionId}`);
		const row = await versionRow(tx, input.versionId);
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		if (!isMarkingKind(row.kind)) {
			return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
		}
		const marks = [
			...parseMarks(row.markingMarks),
			{
				geometry: input.geometry,
				id: crypto.randomUUID(),
				page: input.page,
				tool: input.tool as MarkingTool,
			} satisfies FileMark,
		];
		const updated = await tx.fileAttachmentVersion.update({
			data: { markingMarks: marks as Prisma.InputJsonValue },
			where: { id: row.id },
		});
		return { layer: layerView(updated), status: "committed" };
	});
}

export async function undoMark(
	prisma: PrismaClient,
	versionId: string
): Promise<MarkingOutcome> {
	// Undo has no public idempotency key. Serializing the version is the
	// strongest safe behavior without changing the command contract.
	return await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `file-marking:${versionId}`);
		const row = await versionRow(tx, versionId);
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		if (!isMarkingKind(row.kind)) {
			return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
		}
		const marks = parseMarks(row.markingMarks);
		const next = marks.slice(0, -1);
		const updated = await tx.fileAttachmentVersion.update({
			data: { markingMarks: next as Prisma.InputJsonValue },
			where: { id: row.id },
		});
		return { layer: layerView(updated), status: "committed" };
	});
}

export async function listSharePublishItems(
	prisma: PrismaClient,
	versionId: string
): Promise<SharePublishOutcome> {
	const row = await versionRow(prisma, versionId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (!isMarkingKind(row.kind)) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	return {
		items: shareItemsFrom(parseApprovals(row.shareItemApprovals)),
		status: "ok",
	};
}

export async function approveSharePublishItem(
	prisma: PrismaClient,
	input: { kind: string; versionId: string }
): Promise<SharePublishOutcome> {
	// Approval has no public idempotency key; setting the same boolean is
	// naturally idempotent under the version lock.
	if (
		input.kind !== SHARE_PUBLISH_ITEM_KIND.markingLayer &&
		input.kind !== SHARE_PUBLISH_ITEM_KIND.sourceVisual
	) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	return await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `file-share-approval:${input.versionId}`);
		const row = await versionRow(tx, input.versionId);
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		const approvals = parseApprovals(row.shareItemApprovals);
		approvals[input.kind as SharePublishItemKind] = true;
		const updated = await tx.fileAttachmentVersion.update({
			data: { shareItemApprovals: approvals as Prisma.InputJsonValue },
			where: { id: row.id },
		});
		return {
			items: shareItemsFrom(parseApprovals(updated.shareItemApprovals)),
			status: "ok",
		};
	});
}

export function previewLocationWorkBind(input: {
	existingWork?: { id: string; title: string } | null;
	fileKind: string;
	geometry: LocationGeometry;
	scope: { kind: string; projectId?: string };
	surface: string;
	title?: string;
	versionId: string;
}): LocationBindPreview {
	if (
		input.surface === LOCATION_SURFACE.wireframe ||
		input.surface === LOCATION_SURFACE.screen
	) {
		return {
			reason: FILE_ATTACHMENT_COPY.wireframeOriginNotThisFeature,
			status: "rejected",
		};
	}
	if (input.surface !== LOCATION_SURFACE.fileAttachment) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	if (!isMarkingKind(input.fileKind)) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	const geometry = locationGeometrySchema.safeParse(input.geometry);
	if (!geometry.success) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	return {
		fileScope: input.scope,
		observationIsWork: false,
		originLocation: {
			componentKind: geometry.data.kind,
			ownerKind: "File Attachment",
			sourceVersionId: input.versionId,
		},
		previewAcknowledged: false,
		status: "ok",
		work: input.existingWork
			? { id: input.existingWork.id, title: input.existingWork.title }
			: {
					id: null,
					title: input.title?.trim() || FILE_ATTACHMENT_COPY.newWork,
				},
	};
}

function rejectWireframeSurface(surface: string): LocationBindOutcome | null {
	if (
		surface === LOCATION_SURFACE.wireframe ||
		surface === LOCATION_SURFACE.screen
	) {
		return {
			reason: FILE_ATTACHMENT_COPY.wireframeOriginNotThisFeature,
			status: "rejected",
		};
	}
	return null;
}

export async function confirmLocationWorkBind(
	prisma: PrismaClient,
	input: {
		actorId: string;
		existingWorkId?: string;
		geometry: LocationGeometry;
		idempotencyKey: string;
		previewAcknowledged: boolean;
		surface: string;
		title?: string;
		versionId: string;
		workspaceId: string;
	}
): Promise<LocationBindOutcome> {
	if (input.previewAcknowledged !== true) {
		return { reason: FILE_ATTACHMENT_COPY.previewRequired, status: "rejected" };
	}
	const blockedSurface = rejectWireframeSurface(input.surface);
	if (blockedSurface) {
		return blockedSurface;
	}
	const geometry = locationGeometrySchema.safeParse(input.geometry);
	if (!geometry.success) {
		return { reason: FILE_ATTACHMENT_COPY.typeRejected, status: "rejected" };
	}
	const row = await versionRow(prisma, input.versionId);
	if (!(row && isMarkingKind(row.kind))) {
		return {
			reason: row ? FILE_ATTACHMENT_COPY.typeRejected : "target-not-found",
			status: "rejected",
		};
	}
	const file = await getFileAttachment(prisma, {
		id: row.fileAttachmentId,
		workspaceId: input.workspaceId,
	});
	const projectId =
		file?.scope.kind === "project" ? file.scope.projectId : undefined;
	if (!(file && projectId)) {
		return {
			reason: file
				? FILE_ATTACHMENT_COPY.workRequiresProject
				: "target-not-found",
			status: "rejected",
		};
	}
	const locationId = crypto.randomUUID();
	const work = await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `file-location-bind:${row.id}`);
		const lockedVersion = await versionRow(tx, row.id);
		if (!lockedVersion) {
			return { reason: "target-not-found", status: "rejected" } as const;
		}
		let workId: string;
		let title: string;
		if (input.existingWorkId) {
			const existing = await tx.work.findUnique({
				where: { id: input.existingWorkId },
			});
			if (!existing || existing.projectId !== projectId) {
				return { reason: "target-not-found", status: "rejected" } as const;
			}
			workId = existing.id;
			({ title } = existing);
		} else {
			const created = await createWorkInTransaction(tx, {
				actorId: input.actorId,
				idempotencyKey: `${input.idempotencyKey}:work`,
				origin: "human",
				payload: {
					projectId,
					title: input.title?.trim() || FILE_ATTACHMENT_COPY.newWork,
				},
			});
			if (created.status !== "committed" && created.status !== "replayed") {
				return { reason: "work-create-failed", status: "rejected" } as const;
			}
			workId = created.work.id;
			({ title } = created.work);
		}
		await tx.fileAttachmentOriginLocation.create({
			data: {
				geometry: geometry.data as Prisma.InputJsonValue,
				id: locationId,
				kind: geometry.data.kind,
				versionId: lockedVersion.id,
			},
		});
		const related = await createRelationInTransaction(tx, {
			actorId: input.actorId,
			from: { id: file.id, kind: "File Attachment" },
			idempotencyKey: `${input.idempotencyKey}:origin`,
			origin: "human",
			originLocation: {
				componentId: locationId,
				ownerId: file.id,
				ownerKind: "File Attachment",
				sourceVersion: lockedVersion.id,
			},
			previewAcknowledged: true,
			to: { id: workId, kind: "Work" },
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: input.workspaceId,
		});
		if (related.status !== "committed" && related.status !== "replayed") {
			return {
				reason:
					related.status === "rejected" ? related.reason : "origin-failed",
				status: "rejected",
			} as const;
		}
		await tx.fileAttachmentVersionPin.create({
			data: {
				id: crypto.randomUUID(),
				kind: FILE_PIN_KIND.location,
				targetId: workId,
				versionId: lockedVersion.id,
			},
		});
		return { status: "ok", title, workId } as const;
	});
	if (work.status !== "ok") {
		return work;
	}
	const refreshed = await getFileAttachment(prisma, {
		id: file.id,
		workspaceId: input.workspaceId,
	});
	if (!refreshed) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		file: refreshed,
		locationId,
		observationIsWork: false,
		originLocation: {
			componentId: locationId,
			ownerId: file.id,
			ownerKind: "File Attachment",
			sourceVersion: row.id,
		},
		status: "committed",
		work: { id: work.workId, title: work.title },
	};
}
