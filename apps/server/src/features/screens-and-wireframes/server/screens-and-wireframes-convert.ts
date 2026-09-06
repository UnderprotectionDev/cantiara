import type { Prisma, PrismaClient } from "@cantiara/db";

import { createDecisionInTransaction } from "../../decisions/server/decisions";
import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getProject } from "../../project-shell/server/project-shell";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createRiskInTransaction } from "../../risks/server/risks";
import { createOpenQuestionFromCommand } from "../../uncertainty-records/server/uncertainty-records";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import {
	findScreenRow,
	findWireframeVersionRow,
	listScreenEvents,
	listWireframeVersions,
	type ScreenRow,
	updateWireframeVersionDocument,
} from "./screen-store";
import {
	CONVERT_RECORD_KINDS,
	type ConvertPreview,
	type ConvertRecordKind,
	convertAndBindCommandSchema,
	convertRecordKindSchema,
	presentScreenLife,
	previewConvertAndBindInputSchema,
	previewRebindOriginInputSchema,
	rebindOriginCommandSchema,
	redactWireframeBlockCommandSchema,
	SCREEN_KIND,
	SCREENS_COPY,
	type ScreenView,
	type ScreenWriteOutcome,
	saveWireframeTemplateCommandSchema,
	type WireframeTemplateView,
} from "./screens-and-wireframes-model";
import {
	findWireframeTemplateRow,
	insertWireframeTemplateRow,
} from "./template-store";
import {
	parseWireframeDocument,
	WIREFRAME_DOCUMENT_SCHEMA,
	type WireframeDocument,
	type WireframeNode,
} from "./wireframe-document";

const LINE_SPLIT = /\r?\n/;

type PrismaTransaction = Prisma.TransactionClient;

class ConvertBarrierError extends Error {
	outcome: ConvertWriteOutcome;
	constructor(outcome: ConvertWriteOutcome) {
		super("convert-barrier");
		this.outcome = outcome;
	}
}

export interface ConvertWriteCommitted {
	originLocation: ConvertPreview["originLocation"];
	record: { id: string; kind: ConvertRecordKind; title: string };
	screen: ScreenView;
}

export type ConvertWriteOutcome =
	| (ConvertWriteCommitted & { status: "committed" })
	| (ConvertWriteCommitted & { status: "replayed" })
	| { reason: string; status: "rejected" }
	| { conflict: string; status: "conflict" };

export type ConvertPreviewOutcome =
	| { preview: ConvertPreview; status: "ok" }
	| { reason: string; status: "rejected" };

export type TemplateWriteOutcome =
	| { status: "committed"; template: WireframeTemplateView }
	| { status: "replayed"; template: WireframeTemplateView }
	| { reason: string; status: "rejected" }
	| { conflict: string; status: "conflict" };

export async function previewConvertAndBind(
	prisma: PrismaClient,
	input: unknown
): Promise<ConvertPreviewOutcome> {
	const parsed = previewConvertAndBindInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.recordKind === SCREEN_KIND) {
		return { reason: "screen-not-a-convert-target", status: "rejected" };
	}
	const recordKind = convertRecordKindSchema.safeParse(parsed.data.recordKind);
	if (!recordKind.success) {
		return { reason: "screen-not-a-convert-target", status: "rejected" };
	}
	const mapped = await mapBlock(prisma, parsed.data);
	if (mapped.status !== "ok") {
		return mapped;
	}
	return {
		preview: withFingerprint({
			body: parsed.data.body?.trim() || mapped.body,
			label: SCREENS_COPY.convertAndBind,
			origin: SCREENS_COPY.origin,
			originLocation: mapped.originLocation,
			projectId: parsed.data.projectId,
			recordKind: recordKind.data,
			recordKinds: [...CONVERT_RECORD_KINDS],
			screenId: parsed.data.screenId,
			title: parsed.data.title?.trim() || mapped.title,
			versionNumber: parsed.data.versionNumber,
		}),
		status: "ok",
	};
}

export async function convertAndBind(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertWriteOutcome> {
	const parsed = convertAndBindCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!parsed.data.payload.previewFingerprint) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewConvertAndBind(prisma, {
		body: parsed.data.payload.body,
		nodeId: parsed.data.payload.nodeId,
		projectId: parsed.data.payload.projectId,
		recordKind: parsed.data.payload.recordKind,
		screenId: parsed.data.payload.screenId,
		title: parsed.data.payload.title,
		versionNumber: parsed.data.payload.versionNumber,
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
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = `human:${parsed.data.actorId}:${parsed.data.idempotencyKey}`;
	try {
		return await prisma.$transaction((tx) =>
			convertInTransaction(
				tx,
				{
					actorId: parsed.data.actorId,
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

export async function previewRebindOrigin(
	prisma: PrismaClient,
	input: unknown
): Promise<ConvertPreviewOutcome> {
	const parsed = previewRebindOriginInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const mapped = await mapBlock(prisma, parsed.data);
	if (mapped.status !== "ok") {
		return mapped;
	}
	return {
		preview: withFingerprint({
			body: mapped.body,
			label: SCREENS_COPY.convertAndBind,
			origin: SCREENS_COPY.origin,
			originLocation: mapped.originLocation,
			projectId: mapped.projectId,
			recordKind: parsed.data.recordKind,
			recordKinds: [...CONVERT_RECORD_KINDS],
			screenId: parsed.data.screenId,
			title: mapped.title,
			versionNumber: parsed.data.versionNumber,
		}),
		status: "ok",
	};
}

export async function rebindOrigin(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertWriteOutcome> {
	const parsed = rebindOriginCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!parsed.data.payload.previewFingerprint) {
		return { reason: "preview-required", status: "rejected" };
	}
	const previewed = await previewRebindOrigin(prisma, parsed.data.payload);
	if (previewed.status !== "ok") {
		return previewed;
	}
	if (
		convertFingerprint(previewed.preview) !==
		parsed.data.payload.previewFingerprint
	) {
		return { reason: "preview-mismatch", status: "rejected" };
	}
	const screen = await loadScreenView(prisma, parsed.data.payload.screenId);
	if (!screen) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	const project = await getProject(prisma, screen.projectId);
	if (!project) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	const origin = await createRelationInTransaction(prisma, {
		actorId: parsed.data.actorId,
		from: { id: screen.id, kind: SCREEN_KIND },
		idempotencyKey: `${parsed.data.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		originLocation: previewed.preview.originLocation,
		previewAcknowledged: true,
		to: {
			id: parsed.data.payload.recordId,
			kind: relationKind(parsed.data.payload.recordKind),
		},
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: project.workspaceId,
	});
	if (origin.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (origin.status !== "committed" && origin.status !== "replayed") {
		return { reason: origin.reason, status: "rejected" };
	}
	return {
		originLocation: previewed.preview.originLocation,
		record: {
			id: parsed.data.payload.recordId,
			kind: parsed.data.payload.recordKind,
			title: previewed.preview.title,
		},
		screen,
		status: origin.status,
	};
}

export async function redactWireframeBlock(
	prisma: PrismaClient,
	command: unknown
): Promise<ScreenWriteOutcome> {
	const parsed = redactWireframeBlockCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const screen = await findScreenRow(prisma, parsed.data.payload.screenId);
	if (!screen) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	const row = await findWireframeVersionRow(prisma, {
		screenId: parsed.data.payload.screenId,
		versionNumber: parsed.data.payload.versionNumber,
	});
	if (!row) {
		return { reason: "version-not-found", status: "rejected" };
	}
	const document = parseWireframeDocument(row.document);
	if (document.status !== "ok") {
		return { reason: document.reason, status: "rejected" };
	}
	const next: WireframeDocument = {
		...document.document,
		nodes: document.document.nodes.filter(
			(node) => node.id !== parsed.data.payload.nodeId
		),
	};
	await updateWireframeVersionDocument(prisma, {
		document: next,
		id: row.id,
	});
	const view = await loadScreenView(prisma, screen.id);
	if (!view) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	return { screen: view, status: "committed" };
}

export async function saveWireframeTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<TemplateWriteOutcome> {
	const parsed = saveWireframeTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const screen = await loadScreenView(prisma, parsed.data.payload.screenId);
	if (!screen) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	const version = await loadVersionDocument(prisma, {
		screenId: screen.id,
		versionNumber: parsed.data.payload.versionNumber,
	});
	if (!version) {
		return { reason: "version-not-found", status: "rejected" };
	}
	const project = await getProject(prisma, screen.projectId);
	if (!project) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	const document = stampDocument(version.document);
	const fingerprint = payloadFingerprint({
		document,
		name: parsed.data.payload.name,
	});
	const commandKey = `human:${parsed.data.actorId}:${parsed.data.idempotencyKey}`;
	return await prisma.$transaction(async (tx) => {
		const existing = await tx.mutationReceipt.findUnique({
			where: { commandKey },
		});
		if (existing) {
			if (existing.payloadFingerprint !== fingerprint) {
				return { conflict: MUTATION_COPY.conflict, status: "conflict" };
			}
			const stored = JSON.parse(existing.resultValue) as WireframeTemplateView;
			return { status: "replayed" as const, template: stored };
		}
		const created = await insertWireframeTemplateRow(tx, {
			document,
			id: crypto.randomUUID(),
			name: parsed.data.payload.name,
			revision: 1,
			workspaceId: project.workspaceId,
		});
		const view: WireframeTemplateView = {
			document,
			id: created.id,
			name: created.name,
			workspaceId: created.workspaceId,
		};
		await tx.mutationReceipt.create({
			data: {
				actorId: parsed.data.actorId,
				actorType: MUTATION_ACTOR.user,
				commandKey,
				committedRevision: 1,
				id: crypto.randomUUID(),
				kind: "commit",
				origin: HUMAN_ORIGIN,
				payloadFingerprint: fingerprint,
				resultValue: JSON.stringify(view),
				targetId: view.id,
			},
		});
		return { status: "committed" as const, template: view };
	});
}

export async function stampedTemplateDocument(
	prisma: PrismaClient,
	templateId: string
): Promise<
	| { document: WireframeDocument; status: "ok" }
	| { reason: string; status: "rejected" }
> {
	const template = await findWireframeTemplateRow(prisma, templateId);
	if (!template) {
		return { reason: "template-not-found", status: "rejected" };
	}
	const document = parseWireframeDocument(template.document);
	if (document.status !== "ok") {
		return { reason: document.reason, status: "rejected" };
	}
	return { document: stampDocument(document.document), status: "ok" };
}

async function mapBlock(
	prisma: PrismaClient,
	input: {
		nodeId: string;
		projectId?: string;
		screenId: string;
		versionNumber: number;
	}
): Promise<
	| {
			body: string;
			originLocation: ConvertPreview["originLocation"];
			projectId: string;
			status: "ok";
			title: string;
	  }
	| { reason: string; status: "rejected" }
> {
	const screen = await loadScreenView(prisma, input.screenId);
	if (!screen) {
		return { reason: "screen-not-found", status: "rejected" };
	}
	if (input.projectId && input.projectId !== screen.projectId) {
		return { reason: "project-mismatch", status: "rejected" };
	}
	const version = await loadVersionDocument(prisma, {
		screenId: screen.id,
		versionNumber: input.versionNumber,
	});
	if (!version) {
		return { reason: "version-not-found", status: "rejected" };
	}
	const node = version.document.nodes.find((item) => item.id === input.nodeId);
	if (!node) {
		return { reason: "block-not-found", status: "rejected" };
	}
	const title = nodeTitle(node);
	return {
		body: nodeBody(node, title),
		originLocation: {
			componentId: node.id,
			missing: false,
			ownerId: screen.id,
			ownerKind: SCREEN_KIND,
			sourceVersion: String(version.versionNumber),
		},
		projectId: screen.projectId,
		status: "ok",
		title,
	};
}

async function convertInTransaction(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		idempotencyKey: string;
		preview: ConvertPreview;
	},
	commandKey: string,
	fingerprint: string
): Promise<ConvertWriteOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const stored = JSON.parse(existing.resultValue) as ConvertWriteCommitted;
		return { ...stored, status: "replayed" };
	}
	const created = await createConvertedRecord(tx, input);
	const screen = await loadScreenView(tx, input.preview.screenId);
	if (!screen) {
		throw new ConvertBarrierError({
			reason: "screen-not-found",
			status: "rejected",
		});
	}
	const project = await tx.project.findUnique({
		select: { workspaceId: true },
		where: { id: screen.projectId },
	});
	if (!project) {
		throw new ConvertBarrierError({
			reason: "screen-not-found",
			status: "rejected",
		});
	}
	const origin = await createRelationInTransaction(tx, {
		actorId: input.actorId,
		from: { id: screen.id, kind: SCREEN_KIND },
		idempotencyKey: `${input.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		originLocation: input.preview.originLocation,
		previewAcknowledged: true,
		to: { id: created.id, kind: relationKind(created.kind) },
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: project.workspaceId,
	});
	if (origin.status !== "committed" && origin.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	const result: ConvertWriteCommitted = {
		originLocation: input.preview.originLocation,
		record: created,
		screen,
	};
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: screen.revision,
			id: crypto.randomUUID(),
			kind: "commit",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(result),
			targetId: created.id,
		},
	});
	return { ...result, status: "committed" };
}

async function createConvertedRecord(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		idempotencyKey: string;
		preview: ConvertPreview;
	}
): Promise<{ id: string; kind: ConvertRecordKind; title: string }> {
	if (input.preview.recordKind === "Work") {
		const created = await createWorkInTransaction(tx, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:work`,
			origin: HUMAN_ORIGIN,
			payload: {
				projectId: input.preview.projectId,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			throw new ConvertBarrierError({
				reason: "invalid-command",
				status: "rejected",
			});
		}
		return {
			id: created.work.id,
			kind: "Work",
			title: created.work.title,
		};
	}
	if (input.preview.recordKind === "Decision") {
		const created = await createDecisionInTransaction(tx, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:decision`,
			origin: HUMAN_ORIGIN,
			payload: {
				decision: input.preview.body,
				projectId: input.preview.projectId,
				rationale: input.preview.body,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			throw new ConvertBarrierError({
				reason: "invalid-command",
				status: "rejected",
			});
		}
		return {
			id: created.decision.id,
			kind: "Decision",
			title: created.decision.title,
		};
	}
	if (input.preview.recordKind === "Risk") {
		const created = await createRiskInTransaction(tx, {
			actorId: input.actorId,
			idempotencyKey: `${input.idempotencyKey}:risk`,
			origin: HUMAN_ORIGIN,
			payload: {
				description: input.preview.body,
				impact: input.preview.body,
				probability: input.preview.body,
				projectId: input.preview.projectId,
				response: input.preview.body,
				title: input.preview.title,
			},
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			throw new ConvertBarrierError({
				reason: "invalid-command",
				status: "rejected",
			});
		}
		return {
			id: created.risk.id,
			kind: "Risk",
			title: created.risk.title,
		};
	}
	const created = await createOpenQuestionFromCommand(tx, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:question`,
		origin: HUMAN_ORIGIN,
		payload: {
			context: input.preview.body,
			projectId: input.preview.projectId,
			question: input.preview.body,
			title: input.preview.title,
		},
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new ConvertBarrierError({
			reason: "invalid-command",
			status: "rejected",
		});
	}
	return {
		id: created.openQuestion.id,
		kind: "Open Question",
		title: created.openQuestion.title,
	};
}

function relationKind(
	kind: ConvertRecordKind
): "Work" | "Decision" | "Risk" | "Question" {
	if (kind === "Open Question") {
		return "Question";
	}
	return kind;
}

function nodeTitle(node: WireframeNode): string {
	const fromText =
		node.text?.mode === "placeholder" ? node.text.value.trim() : "";
	if (fromText.length > 0) {
		return fromText.split(LINE_SPLIT, 1)[0] ?? fromText;
	}
	if (node.label && node.label.trim().length > 0) {
		return node.label.trim();
	}
	return node.kind;
}

function nodeBody(node: WireframeNode, title: string): string {
	if (node.text?.mode === "placeholder" && node.text.value.trim().length > 0) {
		return node.text.value.trim();
	}
	return title;
}

function stampDocument(document: WireframeDocument): WireframeDocument {
	return {
		...document,
		nodes: document.nodes.map((node) => {
			const { liveRecord: _liveRecord, ...rest } = node;
			return rest;
		}),
	};
}

function withFingerprint(
	preview: Omit<ConvertPreview, "fingerprint">
): ConvertPreview {
	return { ...preview, fingerprint: payloadFingerprint(preview) };
}

function convertFingerprint(preview: ConvertPreview): string {
	const { fingerprint: _fingerprint, ...rest } = preview;
	return payloadFingerprint(rest);
}

async function loadScreenView(
	db: PrismaClient | PrismaTransaction,
	screenId: string
): Promise<ScreenView | null> {
	const row = await findScreenRow(db, screenId);
	if (!row) {
		return null;
	}
	return await toScreenView(db, row);
}

async function loadVersionDocument(
	db: PrismaClient | PrismaTransaction,
	input: { screenId: string; versionNumber: number }
): Promise<{ document: WireframeDocument; versionNumber: number } | null> {
	const row = await findWireframeVersionRow(db, input);
	if (!row) {
		return null;
	}
	const parsed = parseWireframeDocument(row.document);
	if (parsed.status !== "ok") {
		return null;
	}
	return { document: parsed.document, versionNumber: row.versionNumber };
}

async function toScreenView(
	db: PrismaClient | PrismaTransaction,
	row: ScreenRow
): Promise<ScreenView> {
	const versions = await listWireframeVersions(db, row.id);
	const events = await listScreenEvents(db, row.id);
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		history: events.map((event) => ({
			kind: event.kind,
			occurredAt: event.occurredAt.toISOString(),
		})),
		id: row.id,
		life: presentScreenLife(row),
		projectId: row.projectId,
		recordKind: SCREEN_KIND,
		revision: row.revision,
		title: row.title,
		trashedAt: row.trashedAt?.toISOString() ?? null,
		versions: versions.map((version) => ({
			createdAt: version.createdAt.toISOString(),
			id: version.id,
			schema: WIREFRAME_DOCUMENT_SCHEMA,
			screenId: version.screenId,
			versionNumber: version.versionNumber,
		})),
	};
}

export async function loadScreenDocument(
	prisma: PrismaClient,
	screenId: string
): Promise<ScreenView | null> {
	return await loadScreenView(prisma, screenId);
}
