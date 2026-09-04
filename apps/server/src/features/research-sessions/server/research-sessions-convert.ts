import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import {
	type ConvertOutcome,
	type ConvertPreview,
	type ConvertTargetKind,
	consentGatesOpen,
	convertCommandSchema,
	type EvidencePinView,
	type PreviewConvertOutcome,
	previewConvertInputSchema,
	RESEARCH_SESSIONS_COPY,
	type ResearchSessionView,
} from "./research-sessions-model";

type PrismaTransaction = Prisma.TransactionClient;

const LINE_SPLIT = /\r?\n/;

class ConvertBarrierError extends Error {
	outcome: ConvertOutcome;
	constructor(outcome: ConvertOutcome) {
		super("convert-barrier");
		this.outcome = outcome;
	}
}

export async function previewConvert(
	prisma: PrismaClient,
	input: unknown
): Promise<PreviewConvertOutcome> {
	const parsed = previewConvertInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const session = await loadSession(prisma, parsed.data.sessionId);
	if (!session) {
		return { reason: "session-not-found", status: "rejected" };
	}
	if (!session.consentGatesOpen) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	const note = session.notes.find((item) => item.id === parsed.data.noteId);
	if (!note) {
		return { reason: "note-not-found", status: "rejected" };
	}
	if (!consentGatesOpen(note.capturedUnderConsent)) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	const range = pinRange(
		note.body,
		parsed.data.rangeStart,
		parsed.data.rangeEnd
	);
	if (!range) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const excerpt = note.body.slice(range.start, range.end);
	const title = parsed.data.title?.trim() || firstLineTitle(excerpt);
	return {
		preview: withFingerprint({
			body: excerpt,
			label: RESEARCH_SESSIONS_COPY.convertToNewRecordAndBind,
			noteId: note.id,
			origin: RELATIONS_COPY.origin,
			projectId: parsed.data.projectId,
			recordKind: parsed.data.recordKind,
			sessionId: session.id,
			sessionRevision: session.revision,
			textRange: range,
			title,
			versionPinnedEvidence: RESEARCH_SESSIONS_COPY.versionPinnedEvidence,
		}),
		status: "ok",
	};
}

export async function convertToNewRecord(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertOutcome> {
	const parsed = convertCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const session = await loadSession(prisma, parsed.data.payload.sessionId);
	if (!session) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!session.consentGatesOpen) {
		return { reason: "consent-gates-closed", status: "rejected" };
	}
	if (parsed.data.payload.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!parsed.data.payload.recordKind) {
		return { reason: "type-required", status: "rejected" };
	}
	if (!(parsed.data.payload.noteId && parsed.data.payload.projectId)) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (!parsed.data.payload.previewFingerprint) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvert(prisma, {
		noteId: parsed.data.payload.noteId,
		projectId: parsed.data.payload.projectId,
		rangeEnd: parsed.data.payload.rangeEnd,
		rangeStart: parsed.data.payload.rangeStart,
		recordKind: parsed.data.payload.recordKind,
		sessionId: parsed.data.payload.sessionId,
		title: parsed.data.payload.title,
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		convertFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	if (
		previewed.preview.recordKind !== "Work" &&
		previewed.preview.recordKind !== "Feature"
	) {
		return { reason: "unsupported-record-type", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = `human:${parsed.data.actorId}:${parsed.data.idempotencyKey}`;
	try {
		return await prisma.$transaction((tx) =>
			convertInTransaction(
				tx,
				{
					actorId: parsed.data.actorId,
					baseRevision: parsed.data.baseRevision,
					idempotencyKey: parsed.data.idempotencyKey,
					preview: previewed.preview,
				},
				commandKey,
				fingerprint
			)
		);
	} catch (error) {
		if (error instanceof ConvertBarrierError) {
			return error.outcome;
		}
		throw error;
	}
}

async function loadSession(
	db: PrismaClient | PrismaTransaction,
	sessionId: string
): Promise<ResearchSessionView | null> {
	const { getResearchSession } = await import("./research-sessions");
	return await getResearchSession(db, sessionId);
}

export async function resolveEvidencePin(
	prisma: PrismaClient | PrismaTransaction,
	pinId: string
): Promise<EvidencePinView | null> {
	const row = await prisma.researchSessionEvidencePin.findUnique({
		where: { id: pinId },
	});
	if (!row) {
		return null;
	}
	return toPinView(row);
}

function convertFingerprint(preview: ConvertPreview): string {
	const { fingerprint: _fingerprint, ...rest } = preview;
	return payloadFingerprint(rest);
}

function withFingerprint(
	preview: Omit<ConvertPreview, "fingerprint">
): ConvertPreview {
	return { ...preview, fingerprint: payloadFingerprint(preview) };
}

function pinRange(
	body: string,
	rangeStart: number | undefined,
	rangeEnd: number | undefined
): { end: number; start: number } | null {
	const start = rangeStart ?? 0;
	const end = rangeEnd ?? body.length;
	if (start < 0 || end < start || end > body.length) {
		return null;
	}
	return { end, start };
}

function firstLineTitle(text: string): string {
	const line = text.split(LINE_SPLIT, 1)[0]?.trim() ?? "";
	return line.length > 0 ? line : text;
}

async function convertInTransaction(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		baseRevision: number | undefined;
		idempotencyKey: string;
		preview: ConvertPreview;
	},
	commandKey: string,
	fingerprint: string
): Promise<ConvertOutcome> {
	const replayed = await replayConvert(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const current = await tx.researchSession.findUnique({
		include: { project: true },
		where: { id: input.preview.sessionId },
	});
	if (!current) {
		return { reason: "session-not-found", status: "rejected" };
	}
	if (
		input.baseRevision !== undefined &&
		current.revision !== input.baseRevision
	) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const created = await createWorkInTransaction(tx, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:work`,
		origin: HUMAN_ORIGIN,
		payload: {
			projectId: input.preview.projectId,
			title: input.preview.title,
			type: input.preview.recordKind === "Feature" ? "Feature" : undefined,
		},
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	const targetKind: ConvertTargetKind =
		input.preview.recordKind === "Feature" ? "Feature" : "Work";
	const endOverrides = {
		[`User Research Session:${current.id}`]: { title: current.title },
	};
	const origin = await createRelationInTransaction(
		tx,
		{
			actorId: input.actorId,
			from: { id: current.id, kind: "User Research Session" },
			idempotencyKey: `${input.idempotencyKey}:origin`,
			origin: HUMAN_ORIGIN,
			originLocation: {
				componentId: input.preview.noteId,
				ownerId: current.id,
				ownerKind: "User Research Session",
				sourceVersion: String(input.preview.sessionRevision),
			},
			previewAcknowledged: true,
			to: { id: created.work.id, kind: "Work" },
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: current.project.workspaceId,
		},
		endOverrides
	);
	if (origin.status !== "committed" && origin.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	const evidence = await createRelationInTransaction(
		tx,
		{
			actorId: input.actorId,
			from: { id: current.id, kind: "User Research Session" },
			idempotencyKey: `${input.idempotencyKey}:evidence`,
			origin: HUMAN_ORIGIN,
			previewAcknowledged: true,
			to: { id: created.work.id, kind: "Work" },
			type: RELATIONS_COPY.evidence,
			viewerWorkspaceId: current.project.workspaceId,
		},
		endOverrides
	);
	if (evidence.status !== "committed" && evidence.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	const pin = await pinEvidence(tx, {
		excerpt: input.preview.body,
		noteId: input.preview.noteId,
		rangeEnd: input.preview.textRange.end,
		rangeStart: input.preview.textRange.start,
		sessionId: current.id,
		sessionRevision: input.preview.sessionRevision,
		targetId: created.work.id,
		targetKind,
	});
	const view = await loadSession(tx, current.id);
	if (!view) {
		throw new ConvertBarrierError({
			reason: "session-not-found",
			status: "rejected",
		});
	}
	const result = {
		pinId: pin.id,
		records: [
			{
				id: created.work.id,
				kind: targetKind,
				title: created.work.title,
			},
		],
		session: view,
	};
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(result),
			targetId: view.id,
		},
	});
	return { ...result, status: "committed" };
}

async function pinEvidence(
	tx: PrismaTransaction,
	input: {
		excerpt: string;
		noteId: string;
		rangeEnd: number;
		rangeStart: number;
		sessionId: string;
		sessionRevision: number;
		targetId: string;
		targetKind: ConvertTargetKind;
	}
): Promise<{ id: string }> {
	return await tx.researchSessionEvidencePin.create({
		data: {
			excerpt: input.excerpt,
			id: crypto.randomUUID(),
			noteId: input.noteId,
			pinnedRevision: input.sessionRevision,
			rangeEnd: input.rangeEnd,
			rangeStart: input.rangeStart,
			sessionId: input.sessionId,
			targetId: input.targetId,
			targetKind: input.targetKind,
		},
	});
}

function toPinView(row: {
	excerpt: string;
	noteId: string;
	pinnedRevision: number;
	rangeEnd: number;
	rangeStart: number;
	sessionId: string;
	targetId: string;
	targetKind: string;
}): EvidencePinView {
	const targetKind =
		row.targetKind === "Feature" ? "Feature" : ("Work" as const);
	return {
		excerpt: row.excerpt,
		noteId: row.noteId,
		sessionId: row.sessionId,
		sessionRevision: row.pinnedRevision,
		targetId: row.targetId,
		targetKind,
		textRange: { end: row.rangeEnd, start: row.rangeStart },
	};
}

async function replayConvert(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ConvertOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	try {
		const stored: unknown = JSON.parse(existing.resultValue);
		if (
			!stored ||
			typeof stored !== "object" ||
			!("pinId" in stored) ||
			!("session" in stored)
		) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return {
			...(stored as {
				pinId: string;
				records: Array<{
					id: string;
					kind: ConvertTargetKind;
					title: string;
				}>;
				session: ResearchSessionView;
			}),
			status: "replayed",
		};
	} catch {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
}
