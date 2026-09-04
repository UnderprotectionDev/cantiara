import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import { createDecision } from "../../decisions/server/decisions";
import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import {
	EVIDENCE_SOURCE_KINDS,
	EVIDENCE_TARGET_KINDS,
	type OriginLocationInput,
	parseRecordKind,
	RELATIONS_COPY,
	validateRelationEnds,
} from "../../relations/server/relations-catalog";
import { createRisk } from "../../risks/server/risks";
import {
	createAssumption,
	createOpenQuestion,
} from "../../uncertainty-records/server/uncertainty-records";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";
import { lightChecklistItemSchema } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type BindEvidencePreview,
	bindEvidenceCommandSchema,
	type ConvertEvidencePreview,
	type ConvertRecordKind,
	convertEvidenceCommandSchema,
	convertKindToRecordKind,
	EVIDENCE_COPY,
	type EvidenceOriginLocationView,
	type EvidencePinView,
	type EvidenceWriteOutcome,
	firstLineTitle,
	type PreviewBindOutcome,
	type PreviewConvertOutcome,
	type PreviewRebindOutcome,
	previewBindEvidenceInputSchema,
	previewConvertEvidenceInputSchema,
	previewRebindEvidenceInputSchema,
	rebindEvidenceCommandSchema,
	redactEvidenceCommandSchema,
	SURROUNDING_WINDOW,
} from "./evidence-model";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

interface SourceSnapshot {
	body: string;
	latestVersionNumber: number;
	sourceId: string;
	sourceKind: (typeof EVIDENCE_SOURCE_KINDS)[number];
	sourceVersionId: string;
	sourceVersionNumber: number;
}

interface PinRow {
	contentRedacted: boolean;
	id: string;
	originComponentId: string | null;
	originComponentMissing: boolean;
	originOwnerId: string | null;
	originOwnerKind: string | null;
	originSourceVersion: string | null;
	rangeEnd: number;
	rangeStart: number;
	rangeText: string;
	relationId: string;
	sourceId: string;
	sourceKind: string;
	sourceVersionId: string;
	sourceVersionNumber: number;
	surroundingText: string;
	targetId: string;
	targetKind: string;
}

export async function previewBindEvidence(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewBindOutcome> {
	const parsed = previewBindEvidenceInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const snapshot = await loadSnapshot(
		prisma,
		parsed.data.sourceKind,
		parsed.data.sourceId,
		parsed.data.sourceVersionId
	);
	if (!snapshot) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const range = resolveRange(
		snapshot.body,
		parsed.data.selectedText,
		parsed.data.rangeStart,
		parsed.data.rangeEnd
	);
	if (!range) {
		return { reason: "range-not-in-version", status: "rejected" };
	}
	const ends = validateRelationEnds({
		from: { id: snapshot.sourceId, kind: snapshot.sourceKind },
		to: { id: parsed.data.targetId, kind: parsed.data.targetKind },
		type: RELATIONS_COPY.evidence,
	});
	if (ends.status === "rejected") {
		return { reason: "ends-not-allowed", status: "rejected" };
	}
	const targetTitle = await loadTargetTitle(
		prisma,
		parsed.data.targetKind,
		parsed.data.targetId
	);
	if (targetTitle === null) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		preview: withFingerprint({
			label: EVIDENCE_COPY.bindAsEvidenceToExistingRecord,
			rangeText: range.text,
			sourceId: snapshot.sourceId,
			sourceKind: snapshot.sourceKind,
			sourceStaysInPlace: EVIDENCE_COPY.sourceStaysInPlace,
			sourceVersionId: snapshot.sourceVersionId,
			sourceVersionNumber: snapshot.sourceVersionNumber,
			surroundingText: range.surrounding,
			targetId: parsed.data.targetId,
			targetKind: parsed.data.targetKind,
			targetTitle,
			textRange: { end: range.end, start: range.start },
			type: RELATIONS_COPY.evidence,
			versionPinnedEvidence: EVIDENCE_COPY.versionPinnedEvidence,
			...(parsed.data.originLocation
				? { originLocation: parsed.data.originLocation }
				: {}),
		}),
		status: "ok",
	};
}

export async function bindEvidence(
	prisma: PrismaClient,
	command: unknown
): Promise<EvidenceWriteOutcome> {
	const parsed = bindEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewBindEvidence(prisma, {
		originLocation: parsed.data.payload.originLocation,
		rangeEnd: parsed.data.payload.rangeEnd,
		rangeStart: parsed.data.payload.rangeStart,
		selectedText: parsed.data.payload.selectedText,
		sourceId: parsed.data.payload.sourceId,
		sourceKind: parsed.data.payload.sourceKind,
		sourceVersionId: parsed.data.payload.sourceVersionId,
		targetId: parsed.data.payload.targetId,
		targetKind: parsed.data.payload.targetKind,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		previewFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		commitBind(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			preview: previewed.preview,
			workspaceId: parsed.data.workspaceId,
		})
	);
}

export async function previewConvertEvidence(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewConvertOutcome> {
	const parsed = previewConvertEvidenceInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const snapshot = await loadSnapshot(
		prisma,
		parsed.data.sourceKind,
		parsed.data.sourceId,
		parsed.data.sourceVersionId
	);
	if (!snapshot) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const range = resolveRange(
		snapshot.body,
		parsed.data.selectedText,
		parsed.data.rangeStart,
		parsed.data.rangeEnd
	);
	if (!range) {
		return { reason: "range-not-in-version", status: "rejected" };
	}
	const title = parsed.data.title?.trim() || firstLineTitle(range.text);
	return {
		preview: withFingerprint({
			label: EVIDENCE_COPY.convertToNewRecordAndBind,
			projectId: parsed.data.projectId,
			rangeText: range.text,
			recordKind: parsed.data.recordKind,
			sourceId: snapshot.sourceId,
			sourceKind: snapshot.sourceKind,
			sourceStaysInPlace: EVIDENCE_COPY.sourceStaysInPlace,
			sourceVersionId: snapshot.sourceVersionId,
			sourceVersionNumber: snapshot.sourceVersionNumber,
			surroundingText: range.surrounding,
			textRange: { end: range.end, start: range.start },
			title,
			versionPinnedEvidence: EVIDENCE_COPY.versionPinnedEvidence,
			...(parsed.data.originLocation
				? { originLocation: parsed.data.originLocation }
				: {}),
		}),
		status: "ok",
	};
}

export async function convertToNewRecordAndBind(
	prisma: PrismaClient,
	command: unknown
): Promise<EvidenceWriteOutcome> {
	const parsed = convertEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvertEvidence(prisma, {
		originLocation: parsed.data.payload.originLocation,
		projectId: parsed.data.payload.projectId,
		rangeEnd: parsed.data.payload.rangeEnd,
		rangeStart: parsed.data.payload.rangeStart,
		recordKind: parsed.data.payload.recordKind,
		selectedText: parsed.data.payload.selectedText,
		sourceId: parsed.data.payload.sourceId,
		sourceKind: parsed.data.payload.sourceKind,
		sourceVersionId: parsed.data.payload.sourceVersionId,
		title: parsed.data.payload.title,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		previewFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const created = await createConvertedRecord(prisma, {
		actorId: parsed.data.actorId,
		idempotencyKey: parsed.data.idempotencyKey,
		preview: previewed.preview,
	});
	if (!created) {
		return { reason: "unsupported-record-type", status: "rejected" };
	}
	const targetKind = convertKindToRecordKind(previewed.preview.recordKind);
	const bindPreviewed = await previewBindEvidence(prisma, {
		originLocation: parsed.data.payload.originLocation,
		rangeEnd: previewed.preview.textRange.end,
		rangeStart: previewed.preview.textRange.start,
		selectedText: previewed.preview.rangeText,
		sourceId: previewed.preview.sourceId,
		sourceKind: parsed.data.payload.sourceKind,
		sourceVersionId: parsed.data.payload.sourceVersionId,
		targetId: created.id,
		targetKind,
		workspaceId: parsed.data.workspaceId,
	});
	if (bindPreviewed.status !== "ok") {
		return bindPreviewed;
	}
	const bound = await bindEvidence(prisma, {
		actorId: parsed.data.actorId,
		idempotencyKey: `${parsed.data.idempotencyKey}:bind`,
		origin: HUMAN_ORIGIN,
		payload: {
			originLocation: parsed.data.payload.originLocation,
			previewFingerprint: bindPreviewed.preview.fingerprint,
			rangeEnd: previewed.preview.textRange.end,
			rangeStart: previewed.preview.textRange.start,
			selectedText: previewed.preview.rangeText,
			sourceId: previewed.preview.sourceId,
			sourceKind: parsed.data.payload.sourceKind,
			sourceVersionId: parsed.data.payload.sourceVersionId,
			targetId: created.id,
			targetKind,
		},
		previewAcknowledged: true,
		workspaceId: parsed.data.workspaceId,
	});
	if (bound.status === "rejected" || bound.status === "conflict") {
		return bound;
	}
	const pin = await getEvidencePin(
		prisma,
		bound.pin.id,
		parsed.data.workspaceId
	);
	if (!pin) {
		return { reason: "pin-not-found", status: "rejected" };
	}
	return {
		pin,
		record: created,
		status: bound.status,
	};
}

export async function previewRebindEvidence(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewRebindOutcome> {
	const parsed = previewRebindEvidenceInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const pin = await prisma.evidencePin.findUnique({
		where: { id: parsed.data.pinId },
	});
	if (!pin) {
		return { reason: "pin-not-found", status: "rejected" };
	}
	const latest = await loadLatestSnapshot(prisma, pin.sourceKind, pin.sourceId);
	if (!latest) {
		return { reason: "source-not-found", status: "rejected" };
	}
	if (latest.sourceVersionNumber <= pin.sourceVersionNumber) {
		return { reason: "no-match-in-candidate-version", status: "rejected" };
	}
	const selected = parsed.data.selectedText ?? pin.rangeText;
	const range = resolveRange(
		latest.body,
		selected,
		parsed.data.rangeStart,
		parsed.data.rangeEnd
	);
	if (!range) {
		return { reason: "no-match-in-candidate-version", status: "rejected" };
	}
	return {
		preview: withFingerprint({
			label: EVIDENCE_COPY.newerVersionExists,
			newSourceVersionId: latest.sourceVersionId,
			newSourceVersionNumber: latest.sourceVersionNumber,
			pinId: pin.id,
			rangeText: range.text,
			textRange: { end: range.end, start: range.start },
		}),
		status: "ok",
	};
}

export async function rebindEvidence(
	prisma: PrismaClient,
	command: unknown
): Promise<EvidenceWriteOutcome> {
	const parsed = rebindEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewRebindEvidence(prisma, {
		pinId: parsed.data.payload.pinId,
		rangeEnd: parsed.data.payload.rangeEnd,
		rangeStart: parsed.data.payload.rangeStart,
		selectedText: parsed.data.payload.selectedText,
		workspaceId: parsed.data.workspaceId,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		previewFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const existing = await tx.mutationReceipt.findUnique({
			where: { commandKey },
		});
		if (existing) {
			if (existing.payloadFingerprint !== fingerprint) {
				return { conflict: MUTATION_COPY.conflict, status: "conflict" };
			}
			const pin = await presentPin(tx, parsed.data.payload.pinId);
			if (!pin) {
				return { reason: "pin-not-found", status: "rejected" };
			}
			return { pin, status: "replayed" };
		}
		await tx.evidencePin.update({
			data: {
				rangeEnd: previewed.preview.textRange.end,
				rangeStart: previewed.preview.textRange.start,
				rangeText: previewed.preview.rangeText,
				sourceVersionId: previewed.preview.newSourceVersionId,
				sourceVersionNumber: previewed.preview.newSourceVersionNumber,
				surroundingText: previewed.preview.rangeText,
			},
			where: { id: parsed.data.payload.pinId },
		});
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			targetId: parsed.data.payload.pinId,
		});
		const pin = await presentPin(tx, parsed.data.payload.pinId);
		if (!pin) {
			return { reason: "pin-not-found", status: "rejected" };
		}
		return { pin, status: "committed" };
	});
}

export async function redactEvidenceContent(
	prisma: PrismaClient,
	command: unknown
): Promise<EvidenceWriteOutcome> {
	const parsed = redactEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const existing = await tx.mutationReceipt.findUnique({
			where: { commandKey },
		});
		if (existing) {
			if (existing.payloadFingerprint !== fingerprint) {
				return { conflict: MUTATION_COPY.conflict, status: "conflict" };
			}
			const pin = await presentPin(tx, parsed.data.payload.pinId);
			if (!pin) {
				return { reason: "pin-not-found", status: "rejected" };
			}
			return { pin, status: "replayed" };
		}
		const row = await tx.evidencePin.findUnique({
			where: { id: parsed.data.payload.pinId },
		});
		if (!pinRowExists(row)) {
			return { reason: "pin-not-found", status: "rejected" };
		}
		await tx.evidencePin.update({
			data: {
				contentRedacted: true,
				rangeText: "",
				surroundingText: "",
			},
			where: { id: parsed.data.payload.pinId },
		});
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			targetId: parsed.data.payload.pinId,
		});
		const pin = await presentPin(tx, parsed.data.payload.pinId);
		if (!pin) {
			return { reason: "pin-not-found", status: "rejected" };
		}
		return { pin, status: "committed" };
	});
}

export async function getEvidencePin(
	prisma: PrismaDb,
	pinId: string,
	_workspaceId?: string
): Promise<EvidencePinView | null> {
	return await presentPin(prisma, pinId);
}

export async function listEvidenceOnSource(
	prisma: PrismaDb,
	sourceKind: string,
	sourceId: string
): Promise<EvidencePinView[]> {
	const rows = await prisma.evidencePin.findMany({
		orderBy: { createdAt: "asc" },
		where: { sourceId, sourceKind },
	});
	const presented = await Promise.all(
		rows.map((row) => presentPin(prisma, row.id))
	);
	return presented.filter((pin): pin is EvidencePinView => pin !== null);
}

export async function listEvidenceOnTarget(
	prisma: PrismaDb,
	targetKind: string,
	targetId: string
): Promise<EvidencePinView[]> {
	const rows = await prisma.evidencePin.findMany({
		orderBy: { createdAt: "asc" },
		where: { targetId, targetKind },
	});
	const presented = await Promise.all(
		rows.map((row) => presentPin(prisma, row.id))
	);
	return presented.filter((pin): pin is EvidencePinView => pin !== null);
}

async function commitBind(
	tx: Prisma.TransactionClient,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		preview: BindEvidencePreview;
		workspaceId: string;
	}
): Promise<EvidenceWriteOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey: input.commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== input.fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const pin = await presentPin(tx, existing.targetId);
		if (!pin) {
			return { reason: "pin-not-found", status: "rejected" };
		}
		return { pin, status: "replayed" };
	}
	const relation = await createRelationInTransaction(tx, {
		actorId: input.actorId,
		from: {
			id: input.preview.sourceId,
			kind: input.preview.sourceKind,
		},
		idempotencyKey: `${input.commandKey}:evidence`,
		origin: HUMAN_ORIGIN,
		previewAcknowledged: true,
		to: {
			id: input.preview.targetId,
			kind: input.preview.targetKind,
		},
		type: RELATIONS_COPY.evidence,
		viewerWorkspaceId: input.workspaceId,
	});
	if (relation.status !== "committed" && relation.status !== "replayed") {
		return { reason: "ends-not-allowed", status: "rejected" };
	}
	const origin = input.preview.originLocation;
	const pinId = crypto.randomUUID();
	await tx.evidencePin.create({
		data: {
			id: pinId,
			originComponentId: origin?.componentId ?? null,
			originComponentMissing: false,
			originOwnerId: origin?.ownerId ?? null,
			originOwnerKind: origin?.ownerKind ?? null,
			originSourceVersion: origin?.sourceVersion ?? null,
			rangeEnd: input.preview.textRange.end,
			rangeStart: input.preview.textRange.start,
			rangeText: input.preview.rangeText,
			relationId: relation.relation.id,
			sourceId: input.preview.sourceId,
			sourceKind: input.preview.sourceKind,
			sourceVersionId: input.preview.sourceVersionId,
			sourceVersionNumber: input.preview.sourceVersionNumber,
			surroundingText: input.preview.surroundingText,
			targetId: input.preview.targetId,
			targetKind: input.preview.targetKind,
		},
	});
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		targetId: pinId,
	});
	const pin = await presentPin(tx, pinId);
	if (!pin) {
		return { reason: "pin-not-found", status: "rejected" };
	}
	return { pin, status: "committed" };
}

async function presentPin(
	db: PrismaDb,
	pinId: string
): Promise<EvidencePinView | null> {
	const row = await db.evidencePin.findUnique({
		where: { id: pinId },
	});
	if (!pinRowExists(row)) {
		return null;
	}
	const snapshot = await loadSnapshot(
		db,
		row.sourceKind,
		row.sourceId,
		row.sourceVersionId
	);
	const targetTitle =
		(await loadTargetTitle(db, row.targetKind, row.targetId)) ?? "";
	const siblings = await db.evidencePin.findMany({
		orderBy: { createdAt: "asc" },
		where: { sourceId: row.sourceId, sourceKind: row.sourceKind },
	});
	const backlinks: EvidencePinView["backlinks"] = await Promise.all(
		siblings.map(async (sibling) => ({
			targetId: sibling.targetId,
			targetKind: sibling.targetKind,
			targetTitle:
				(await loadTargetTitle(db, sibling.targetKind, sibling.targetId)) ?? "",
		}))
	);
	const originLocation = await presentOriginLocation(db, row);
	const redacted = row.contentRedacted;
	return {
		backlinks,
		contentAccess: redacted ? "redacted" : "open",
		highlight: { end: row.rangeEnd, start: row.rangeStart },
		historicalBindExists: true,
		id: row.id,
		newerVersionExists: snapshot
			? snapshot.latestVersionNumber > row.sourceVersionNumber
			: false,
		openSourceRecord: EVIDENCE_COPY.openSourceRecord,
		originLocation,
		pinnedBody: redacted ? "" : (snapshot?.body ?? ""),
		rangeText: redacted ? "" : row.rangeText,
		relationId: row.relationId,
		sourceId: row.sourceId,
		sourceKind: parseEvidenceSourceKind(row.sourceKind),
		sourceStayedInPlace: true,
		sourceVersionId: row.sourceVersionId,
		sourceVersionNumber: row.sourceVersionNumber,
		surroundingText: redacted ? "" : row.surroundingText,
		targetId: row.targetId,
		targetKind: parseEvidenceTargetKind(row.targetKind),
		targetTitle,
		textRange: { end: row.rangeEnd, start: row.rangeStart },
		versionPinnedEvidence: EVIDENCE_COPY.versionPinnedEvidence,
	};
}

async function presentOriginLocation(
	db: PrismaDb,
	row: PinRow
): Promise<EvidenceOriginLocationView | null> {
	if (
		!(
			row.originComponentId &&
			row.originOwnerId &&
			row.originOwnerKind &&
			row.originSourceVersion
		)
	) {
		return null;
	}
	const ownerKind = parseRecordKind(row.originOwnerKind);
	if (!ownerKind) {
		return null;
	}
	const missing =
		row.originComponentMissing ||
		!(await originComponentExists(db, {
			componentId: row.originComponentId,
			ownerId: row.originOwnerId,
			ownerKind,
			sourceVersion: row.originSourceVersion,
		}));
	if (missing && !row.originComponentMissing) {
		await db.evidencePin.update({
			data: { originComponentMissing: true },
			where: { id: row.id },
		});
	}
	return {
		componentId: row.originComponentId,
		missing,
		missingLabel: missing ? EVIDENCE_COPY.sourceElementNoLongerExists : null,
		ownerId: row.originOwnerId,
		ownerKind,
		sourceVersion: row.originSourceVersion,
	};
}

async function originComponentExists(
	db: PrismaDb,
	input: OriginLocationInput
): Promise<boolean> {
	if (input.ownerKind === "Work") {
		const work = await db.work.findUnique({
			where: { id: input.ownerId },
		});
		if (!work) {
			return false;
		}
		const parsed = z
			.array(lightChecklistItemSchema)
			.safeParse(work.lightChecklist);
		if (!parsed.success) {
			return false;
		}
		return parsed.data.some((item) => item.id === input.componentId);
	}
	if (input.ownerKind === "User Research Session") {
		const note = await db.researchSessionNote.findUnique({
			where: { id: input.componentId },
		});
		return Boolean(note && note.sessionId === input.ownerId);
	}
	return false;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: closed Kanıtı source catalog
async function loadSnapshot(
	db: PrismaDb,
	sourceKind: string,
	sourceId: string,
	sourceVersionId: string
): Promise<SourceSnapshot | null> {
	if (sourceKind === "Source") {
		const version = await db.sourceVersion.findUnique({
			where: { id: sourceVersionId },
		});
		const source = await db.source.findUnique({
			where: { id: sourceId },
		});
		if (!(version && source) || version.sourceId !== source.id) {
			return null;
		}
		return {
			body: version.capturedContent,
			latestVersionNumber: source.approvedVersionNumber,
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: version.id,
			sourceVersionNumber: version.versionNumber,
		};
	}
	if (sourceKind === "Document") {
		const version = await db.documentVersion.findUnique({
			where: { id: sourceVersionId },
		});
		if (!version || version.documentId !== sourceId) {
			return null;
		}
		const latest = await db.document.findUnique({
			where: { id: sourceId },
		});
		return {
			body: version.body,
			latestVersionNumber: latest?.revision ?? version.revision,
			sourceId: version.documentId,
			sourceKind: "Document",
			sourceVersionId: version.id,
			sourceVersionNumber: version.revision,
		};
	}
	if (sourceKind === "File Attachment") {
		const version = await db.fileAttachmentVersion.findUnique({
			where: { id: sourceVersionId },
		});
		if (!version || version.fileAttachmentId !== sourceId) {
			return null;
		}
		const latest = await db.fileAttachment.findUnique({
			where: { id: sourceId },
		});
		return {
			body: version.filename,
			latestVersionNumber: latest?.revision ?? version.versionNumber,
			sourceId: version.fileAttachmentId,
			sourceKind: "File Attachment",
			sourceVersionId: version.id,
			sourceVersionNumber: version.versionNumber,
		};
	}
	if (sourceKind === "Experiment/Validation") {
		const record = await db.validationRecord.findUnique({
			where: { id: sourceId },
		});
		if (!record) {
			return null;
		}
		return {
			body: `${record.title}\n${record.method}\n${record.result}`,
			latestVersionNumber: record.revision,
			sourceId: record.id,
			sourceKind: "Experiment/Validation",
			sourceVersionId: String(record.revision),
			sourceVersionNumber: record.revision,
		};
	}
	if (sourceKind === "User Research Session") {
		const session = await db.researchSession.findUnique({
			where: { id: sourceId },
		});
		if (!session) {
			return null;
		}
		const notes = await db.researchSessionNote.findMany({
			where: { sessionId: session.id },
		});
		const body = notes.map((note) => note.body).join("\n");
		return {
			body,
			latestVersionNumber: session.revision,
			sourceId: session.id,
			sourceKind: "User Research Session",
			sourceVersionId: String(session.revision),
			sourceVersionNumber: session.revision,
		};
	}
	return null;
}

async function loadLatestSnapshot(
	db: PrismaDb,
	sourceKind: string,
	sourceId: string
): Promise<SourceSnapshot | null> {
	if (sourceKind === "Source") {
		const source = await db.source.findUnique({
			where: { id: sourceId },
		});
		if (!source) {
			return null;
		}
		const version = await db.sourceVersion.findFirst({
			where: {
				sourceId,
				versionNumber: source.approvedVersionNumber,
			},
		});
		if (!version) {
			return null;
		}
		return loadSnapshot(db, sourceKind, sourceId, version.id);
	}
	if (sourceKind === "Document") {
		const document = await db.document.findUnique({
			where: { id: sourceId },
		});
		if (!document) {
			return null;
		}
		const version = await db.documentVersion.findFirst({
			where: { documentId: sourceId, revision: document.revision },
		});
		if (!version) {
			return null;
		}
		return loadSnapshot(db, sourceKind, sourceId, version.id);
	}
	return loadSnapshot(db, sourceKind, sourceId, sourceId);
}

async function loadTargetTitle(
	db: PrismaDb,
	targetKind: string,
	targetId: string
): Promise<string | null> {
	if (targetKind === "Work") {
		const work = await db.work.findUnique({
			where: { id: targetId },
		});
		return work?.title ?? null;
	}
	if (targetKind === "Decision") {
		const decision = await db.decision.findUnique({
			where: { id: targetId },
		});
		return decision?.title ?? null;
	}
	if (targetKind === "Risk") {
		const risk = await db.risk.findUnique({
			where: { id: targetId },
		});
		return risk?.title ?? null;
	}
	if (targetKind === "Assumption") {
		const assumption = await db.assumption.findUnique({
			where: { id: targetId },
		});
		return assumption?.statement ?? null;
	}
	if (targetKind === "Question") {
		const question = await db.openQuestion.findUnique({
			where: { id: targetId },
		});
		return question?.title ?? null;
	}
	return null;
}

async function createConvertedRecord(
	prisma: PrismaClient,
	input: {
		actorId: string;
		idempotencyKey: string;
		preview: ConvertEvidencePreview;
	}
): Promise<{ id: string; kind: ConvertRecordKind; title: string } | null> {
	const excerpt = input.preview.rangeText;
	if (input.preview.recordKind === "Work") {
		const created = await createWork(prisma, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:record`,
			origin: HUMAN_ORIGIN,
			payload: {
				projectId: input.preview.projectId,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			return null;
		}
		return {
			id: created.work.id,
			kind: "Work",
			title: created.work.title,
		};
	}
	if (input.preview.recordKind === "Decision") {
		const created = await createDecision(prisma, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:record`,
			origin: HUMAN_ORIGIN,
			payload: {
				decision: excerpt,
				projectId: input.preview.projectId,
				rationale: "",
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			return null;
		}
		return {
			id: created.decision.id,
			kind: "Decision",
			title: created.decision.title,
		};
	}
	if (input.preview.recordKind === "Risk") {
		const created = await createRisk(prisma, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:record`,
			origin: HUMAN_ORIGIN,
			payload: {
				description: excerpt,
				impact: excerpt,
				probability: excerpt,
				projectId: input.preview.projectId,
				response: excerpt,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			return null;
		}
		return {
			id: created.risk.id,
			kind: "Risk",
			title: created.risk.title,
		};
	}
	if (input.preview.recordKind === "Assumption") {
		const created = await createAssumption(prisma, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:record`,
			origin: HUMAN_ORIGIN,
			payload: {
				projectId: input.preview.projectId,
				rationale: "",
				statement: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			return null;
		}
		return {
			id: created.assumption.id,
			kind: "Assumption",
			title: created.assumption.statement,
		};
	}
	if (input.preview.recordKind === "Open Question") {
		const created = await createOpenQuestion(prisma, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:record`,
			origin: HUMAN_ORIGIN,
			payload: {
				context: excerpt,
				projectId: input.preview.projectId,
				question: excerpt,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			return null;
		}
		return {
			id: created.openQuestion.id,
			kind: "Open Question",
			title: created.openQuestion.title,
		};
	}
	return null;
}

function resolveRange(
	body: string,
	selectedText: string,
	rangeStart: number | undefined,
	rangeEnd: number | undefined
): { end: number; surrounding: string; start: number; text: string } | null {
	if (
		rangeStart !== undefined &&
		rangeEnd !== undefined &&
		rangeStart >= 0 &&
		rangeEnd <= body.length &&
		rangeEnd > rangeStart &&
		body.slice(rangeStart, rangeEnd) === selectedText
	) {
		return ranged(body, rangeStart, rangeEnd);
	}
	const index = body.indexOf(selectedText);
	if (index < 0) {
		return null;
	}
	return ranged(body, index, index + selectedText.length);
}

function ranged(
	body: string,
	start: number,
	end: number
): { end: number; surrounding: string; start: number; text: string } {
	const surroundStart = Math.max(0, start - SURROUNDING_WINDOW);
	const surroundEnd = Math.min(body.length, end + SURROUNDING_WINDOW);
	return {
		end,
		start,
		surrounding: body.slice(surroundStart, surroundEnd),
		text: body.slice(start, end),
	};
}

function withFingerprint<T extends object>(
	preview: T
): T & { fingerprint: string } {
	return { ...preview, fingerprint: payloadFingerprint(preview) };
}

function previewFingerprint(preview: { fingerprint: string }): string {
	const { fingerprint: _fingerprint, ...rest } = preview;
	return payloadFingerprint(rest);
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function writeReceipt(
	tx: Prisma.TransactionClient,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		targetId: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: input.targetId,
			targetId: input.targetId,
		},
	});
}

function pinRowExists(row: PinRow | null): row is PinRow {
	return row !== null;
}

function parseEvidenceSourceKind(
	value: string
): (typeof EVIDENCE_SOURCE_KINDS)[number] {
	if ((EVIDENCE_SOURCE_KINDS as readonly string[]).includes(value)) {
		return value as (typeof EVIDENCE_SOURCE_KINDS)[number];
	}
	return "Source";
}

function parseEvidenceTargetKind(
	value: string
): (typeof EVIDENCE_TARGET_KINDS)[number] {
	if ((EVIDENCE_TARGET_KINDS as readonly string[]).includes(value)) {
		return value as (typeof EVIDENCE_TARGET_KINDS)[number];
	}
	return "Work";
}
