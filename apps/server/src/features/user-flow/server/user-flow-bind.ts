import type { Prisma, PrismaClient } from "@cantiara/db";

import { createDecision } from "../../decisions/server/decisions";
import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createRisk } from "../../risks/server/risks";
import { createOpenQuestion } from "../../uncertainty-records/server/uncertainty-records";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";
import { getScreenRow } from "./screen-double";
import {
	commandKeyFor,
	createUserFlow,
	loadFlow,
	lockProject,
	persistFlowDocument,
	presentUserFlow,
	replayFlow,
	requireUserFlowWriteDelegate,
	workspaceIdForProject,
} from "./user-flow";
import { defaultLayout } from "./user-flow-editor";
import {
	type ConvertAndBindOutcome,
	type ConvertAndBindPreviewOutcome,
	type ConvertRecordKind,
	convertAndBindCommandSchema,
	convertBodyFromNode,
	convertTitleFromNode,
	type FlowDocument,
	type FlowNodeDocument,
	instantiateUserFlowTemplateCommandSchema,
	isConvertRecordKind,
	isScreenFlowNode,
	type MoveLiveCardCommand,
	moveLiveCardCommandSchema,
	type PlaceLiveCardCommand,
	type PromoteStepToScreenCommand,
	parseFlowDocument,
	placeLiveCardCommandSchema,
	previewConvertAndBindInputSchema,
	previewRebindOriginInputSchema,
	promoteStepToScreenCommandSchema,
	type RebindOriginCommand,
	type RebindOriginOutcome,
	type RebindOriginPreviewOutcome,
	type RemoveLiveCardCommand,
	rebindOriginCommandSchema,
	relationKindForConvert,
	removeLiveCardCommandSchema,
	type SaveUserFlowTemplateCommand,
	SCREEN_NODE_KIND,
	saveUserFlowTemplateCommandSchema,
	stampTemplateStructure,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
	USER_FLOW_REJECTION,
	type UserFlowTemplateView,
	type UserFlowTemplateWriteOutcome,
	type UserFlowWriteOutcome,
} from "./user-flow-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function previewConvertAndBind(
	prisma: PrismaClient,
	input: unknown
): Promise<ConvertAndBindPreviewOutcome> {
	const parsed = previewConvertAndBindInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (parsed.data.recordKind === USER_FLOW_COPY.screen) {
		return {
			reason: USER_FLOW_REJECTION.convertDoesNotMintScreen,
			status: "rejected",
		};
	}
	if (!isConvertRecordKind(parsed.data.recordKind)) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const row = await loadFlow(prisma, parsed.data.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const document = parseFlowDocument(row.document);
	const node = document.nodes.find((item) => item.id === parsed.data.nodeId);
	if (!node) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const project = await prisma.project.findUnique({
		select: { id: true, name: true, workspaceId: true },
		where: { id: row.projectId },
	});
	if (!project || project.workspaceId !== parsed.data.workspaceId) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const screenTitle = isScreenFlowNode(node)
		? ((await getScreenRow(prisma, node.screenId))?.title ?? null)
		: null;
	return {
		preview: {
			body: convertBodyFromNode(node),
			copy: {
				confirm: USER_FLOW_COPY.confirm,
				convertAndBind: USER_FLOW_COPY.convertAndBind,
				origin: USER_FLOW_COPY.origin,
				originLocation: USER_FLOW_COPY.originLocation,
			},
			origin: USER_FLOW_COPY.origin,
			originLocation: {
				componentId: node.id,
				ownerId: row.id,
				ownerKind: USER_FLOW_RECORD_KIND,
				sourceVersion: String(row.revision),
			},
			projectId: project.id,
			projectName: project.name,
			recordKind: parsed.data.recordKind,
			title: convertTitleFromNode(node, screenTitle),
		},
		status: "ok",
	};
}

export async function convertAndBind(
	prisma: PrismaClient,
	command: unknown
): Promise<ConvertAndBindOutcome> {
	const parsed = convertAndBindCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (parsed.data.payload.recordKind === USER_FLOW_COPY.screen) {
		return {
			reason: USER_FLOW_REJECTION.convertDoesNotMintScreen,
			status: "rejected",
		};
	}
	if (!isConvertRecordKind(parsed.data.payload.recordKind)) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: USER_FLOW_REJECTION.previewRequired, status: "rejected" };
	}
	const flowRow = await loadFlow(prisma, parsed.data.payload.userFlowId);
	if (!flowRow) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	if (flowRow.revision !== parsed.data.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const previewed = await previewConvertAndBind(prisma, {
		nodeId: parsed.data.payload.nodeId,
		recordKind: parsed.data.payload.recordKind,
		userFlowId: parsed.data.payload.userFlowId,
		workspaceId: await workspaceIdForProject(prisma, flowRow.projectId),
	});
	if (previewed.status !== "ok") {
		return previewed;
	}
	const title = parsed.data.payload.title ?? previewed.preview.title;
	const body = parsed.data.payload.body ?? previewed.preview.body;
	const created = await mintConvertedRecord(prisma, {
		actorId: parsed.data.actorId,
		body,
		idempotencyKey: parsed.data.idempotencyKey,
		kind: parsed.data.payload.recordKind,
		projectId: previewed.preview.projectId,
		title,
	});
	if (created.status !== "ok") {
		return created;
	}
	const related = await createRelation(prisma, {
		actorId: parsed.data.actorId,
		from: {
			id: previewed.preview.originLocation.ownerId,
			kind: USER_FLOW_RECORD_KIND,
		},
		idempotencyKey: `${parsed.data.idempotencyKey}:origin`,
		origin: HUMAN_ORIGIN,
		originLocation: previewed.preview.originLocation,
		previewAcknowledged: true,
		to: {
			id: created.record.id,
			kind: relationKindForConvert(parsed.data.payload.recordKind),
		},
		type: RELATIONS_COPY.origin,
		viewerWorkspaceId: await workspaceIdForProject(
			prisma,
			previewed.preview.projectId
		),
	});
	if (related.status === "conflict") {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (related.status !== "committed" && related.status !== "replayed") {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const flow = await loadFlow(prisma, parsed.data.payload.userFlowId);
	if (!flow) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	return {
		flow: await presentUserFlow(
			prisma,
			flow,
			await workspaceIdForProject(prisma, flow.projectId)
		),
		record: created.record,
		status: "committed",
	};
}

export async function promoteStepToScreen(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = promoteStepToScreenCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		promoteInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function previewRebindOrigin(
	prisma: PrismaClient,
	input: unknown
): Promise<RebindOriginPreviewOutcome> {
	const parsed = previewRebindOriginInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const located = await loadOriginBind(prisma, parsed.data);
	if (!located) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	return {
		preview: {
			fromVersion: located.relation.originSourceVersion ?? "",
			toVersion: String(located.flow.revision),
		},
		status: "ok",
	};
}

export async function rebindOrigin(
	prisma: PrismaClient,
	command: unknown
): Promise<RebindOriginOutcome> {
	const parsed = rebindOriginCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (parsed.data.previewAcknowledged !== true) {
		return { reason: USER_FLOW_REJECTION.previewRequired, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		rebindInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function saveUserFlowTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowTemplateWriteOutcome> {
	const parsed = saveUserFlowTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		saveTemplateInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function listUserFlowTemplates(
	prisma: PrismaClient,
	workspaceId: string
): Promise<UserFlowTemplateView[]> {
	if (
		!("userFlowTemplate" in prisma) ||
		typeof prisma.userFlowTemplate?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.userFlowTemplate.findMany({
		orderBy: { createdAt: "asc" },
		where: { workspaceId },
	});
	return rows.map((row) => toTemplateView(row));
}

export async function instantiateUserFlowTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = instantiateUserFlowTemplateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const template = await loadTemplate(prisma, parsed.data.payload.templateId);
	if (!template) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const created = await createUserFlow(prisma, {
		actorId: parsed.data.actorId,
		idempotencyKey: `${parsed.data.idempotencyKey}:flow`,
		origin: HUMAN_ORIGIN,
		payload: {
			projectId: parsed.data.payload.projectId,
			title: parsed.data.payload.title,
		},
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		return created;
	}
	const stamped = parseFlowDocument(template.structure);
	const next: FlowDocument = {
		liveCards: [],
		nodes: stamped.nodes.map((node) => ({
			...node,
			id: crypto.randomUUID(),
		})),
	};
	const row = await loadFlow(prisma, created.flow.id);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	return await prisma.$transaction((tx) =>
		persistFlowDocument(tx, {
			actorId: parsed.data.actorId,
			commandKey: commandKeyFor(
				parsed.data.actorId,
				parsed.data.idempotencyKey
			),
			fingerprint: payloadFingerprint(parsed.data.payload),
			next,
			row,
		})
	);
}

export async function placeLiveCard(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = placeLiveCardCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		placeLiveCardInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function moveLiveCard(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = moveLiveCardCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		moveLiveCardInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function removeLiveCard(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = removeLiveCardCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		removeLiveCardInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

type MintedRecord =
	| {
			record: { id: string; kind: ConvertRecordKind; title: string };
			status: "ok";
	  }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: string; status: "rejected" };

async function mintConvertedRecord(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		idempotencyKey: string;
		kind: ConvertRecordKind;
		projectId: string;
		title: string;
	}
): Promise<MintedRecord> {
	if (input.kind === USER_FLOW_COPY.work) {
		return await mintWork(prisma, input);
	}
	if (input.kind === USER_FLOW_COPY.decision) {
		return await mintDecision(prisma, input);
	}
	if (input.kind === USER_FLOW_COPY.risk) {
		return await mintRisk(prisma, input);
	}
	return await mintOpenQuestion(prisma, input);
}

async function mintWork(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
): Promise<MintedRecord> {
	const created = await createWork(prisma, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:record`,
		origin: HUMAN_ORIGIN,
		payload: { projectId: input.projectId, title: input.title },
	});
	if (created.status === "conflict") {
		return created;
	}
	if (created.status !== "committed" && created.status !== "replayed") {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (input.body.length > 0) {
		await prisma.work.update({
			data: { description: input.body },
			where: { id: created.work.id },
		});
	}
	return {
		record: {
			id: created.work.id,
			kind: USER_FLOW_COPY.work,
			title: created.work.title,
		},
		status: "ok",
	};
}

async function mintDecision(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
): Promise<MintedRecord> {
	const created = await createDecision(prisma, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:record`,
		origin: HUMAN_ORIGIN,
		payload: {
			decision: input.body,
			projectId: input.projectId,
			rationale: "",
			title: input.title,
		},
	});
	if (created.status === "conflict") {
		return created;
	}
	if (created.status !== "committed" && created.status !== "replayed") {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	return {
		record: {
			id: created.decision.id,
			kind: USER_FLOW_COPY.decision,
			title: created.decision.title,
		},
		status: "ok",
	};
}

async function mintRisk(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
): Promise<MintedRecord> {
	const created = await createRisk(prisma, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:record`,
		origin: HUMAN_ORIGIN,
		payload: {
			description: input.body,
			impact: "",
			probability: "",
			projectId: input.projectId,
			response: "",
			title: input.title,
		},
	});
	if (created.status === "conflict") {
		return created;
	}
	if (created.status !== "committed" && created.status !== "replayed") {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	return {
		record: {
			id: created.risk.id,
			kind: USER_FLOW_COPY.risk,
			title: created.risk.title,
		},
		status: "ok",
	};
}

async function mintOpenQuestion(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
): Promise<MintedRecord> {
	const created = await createOpenQuestion(prisma, {
		actorId: input.actorId,
		idempotencyKey: `${input.idempotencyKey}:record`,
		origin: HUMAN_ORIGIN,
		payload: {
			context: input.body,
			projectId: input.projectId,
			question: input.title,
			title: input.title,
		},
	});
	if (created.status === "conflict") {
		return created;
	}
	if (created.status !== "committed" && created.status !== "replayed") {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	return {
		record: {
			id: created.openQuestion.id,
			kind: USER_FLOW_COPY.openQuestion,
			title: created.openQuestion.title,
		},
		status: "ok",
	};
}

async function promoteInTransaction(
	tx: PrismaTransaction,
	command: PromoteStepToScreenCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	requireUserFlowWriteDelegate(tx);
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	if (row.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await lockProject(tx, row.projectId);
	const document = parseFlowDocument(row.document);
	const node = document.nodes.find(
		(item) => item.id === command.payload.nodeId
	);
	if (!node) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const { screenId: linkedScreenId } = command.payload;
	let screenId = linkedScreenId;
	if (!screenId) {
		const minted = await tx.screen.create({
			data: {
				id: crypto.randomUUID(),
				projectId: row.projectId,
				revision: 1,
				title: convertTitleFromNode(node, null),
			},
		});
		screenId = minted.id;
	}
	const promoted: FlowNodeDocument = {
		chosenWireframeVersionId: isScreenFlowNode(node)
			? node.chosenWireframeVersionId
			: null,
		id: node.id,
		kind: SCREEN_NODE_KIND,
		layout: node.layout,
		pathText: node.pathText,
		screenId,
		visualStyle: node.visualStyle,
	};
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: {
			liveCards: document.liveCards ?? [],
			nodes: document.nodes.map((item) =>
				item.id === node.id ? promoted : item
			),
		},
		row,
	});
}

async function rebindInTransaction(
	tx: PrismaTransaction,
	command: RebindOriginCommand,
	commandKey: string,
	fingerprint: string
): Promise<RebindOriginOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { status: "replayed" };
	}
	const located = await loadOriginBind(tx, command.payload);
	if (!located) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	await tx.typedRelation.update({
		data: { originSourceVersion: String(located.flow.revision) },
		where: { id: located.relation.id },
	});
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: located.flow.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: String(located.flow.revision),
			targetId: located.relation.id,
		},
	});
	return { status: "committed" };
}

async function loadOriginBind(
	prisma: PrismaClient | PrismaTransaction,
	input: {
		nodeId: string;
		recordId: string;
		recordKind: string;
		userFlowId: string;
	}
) {
	if (!isConvertRecordKind(input.recordKind)) {
		return null;
	}
	const flow = await loadFlow(prisma, input.userFlowId);
	if (!flow) {
		return null;
	}
	const document = parseFlowDocument(flow.document);
	if (!document.nodes.some((node) => node.id === input.nodeId)) {
		return null;
	}
	const relation = await prisma.typedRelation.findFirst({
		where: {
			fromId: flow.id,
			fromKind: USER_FLOW_RECORD_KIND,
			originComponentId: input.nodeId,
			toId: input.recordId,
			toKind: relationKindForConvert(input.recordKind),
			type: RELATIONS_COPY.origin,
		},
	});
	if (!relation) {
		return null;
	}
	return { flow, relation };
}

async function saveTemplateInTransaction(
	tx: PrismaTransaction,
	command: SaveUserFlowTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowTemplateWriteOutcome> {
	if (typeof tx.userFlowTemplate?.create !== "function") {
		throw new Error(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
	}
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const live = await loadTemplate(tx, existing.targetId);
		if (!live) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { status: "replayed", template: live };
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const project = await tx.project.findUnique({
		select: { workspaceId: true },
		where: { id: row.projectId },
	});
	if (!project) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const structure = stampTemplateStructure(parseFlowDocument(row.document));
	const created = await tx.userFlowTemplate.create({
		data: {
			id: crypto.randomUUID(),
			name: command.payload.name,
			revision: 1,
			structure,
			workspaceId: project.workspaceId,
		},
	});
	const view = toTemplateView(created);
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(view),
			targetId: view.id,
		},
	});
	return { status: "committed", template: view };
}

async function loadTemplate(
	prisma: PrismaClient | PrismaTransaction,
	templateId: string
): Promise<UserFlowTemplateView | null> {
	if (
		!("userFlowTemplate" in prisma) ||
		typeof prisma.userFlowTemplate?.findUnique !== "function"
	) {
		return null;
	}
	const row = await prisma.userFlowTemplate.findUnique({
		where: { id: templateId },
	});
	if (!row) {
		return null;
	}
	return toTemplateView(row);
}

function toTemplateView(row: {
	id: string;
	name: string;
	revision: number;
	structure: string;
}): UserFlowTemplateView {
	return {
		id: row.id,
		name: row.name,
		revision: row.revision,
		structure: row.structure,
	};
}

async function placeLiveCardInTransaction(
	tx: PrismaTransaction,
	command: PlaceLiveCardCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	requireUserFlowWriteDelegate(tx);
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	if (row.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await lockProject(tx, row.projectId);
	const document = parseFlowDocument(row.document);
	const liveCards = [
		...(document.liveCards ?? []),
		{
			id: crypto.randomUUID(),
			layout:
				command.payload.layout ??
				defaultLayout(document.liveCards?.length ?? 0),
			recordId: command.payload.recordId,
			recordKind: command.payload.recordKind,
		},
	];
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: { liveCards, nodes: document.nodes },
		row,
	});
}

async function moveLiveCardInTransaction(
	tx: PrismaTransaction,
	command: MoveLiveCardCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	requireUserFlowWriteDelegate(tx);
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	if (row.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await lockProject(tx, row.projectId);
	const document = parseFlowDocument(row.document);
	if (
		!(document.liveCards ?? []).some(
			(card) => card.id === command.payload.cardId
		)
	) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	const liveCards = (document.liveCards ?? []).map((card) =>
		card.id === command.payload.cardId
			? {
					...card,
					layout: {
						...card.layout,
						x: card.layout.x + command.payload.deltaX,
						y: card.layout.y + command.payload.deltaY,
					},
				}
			: card
	);
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: { liveCards, nodes: document.nodes },
		row,
	});
}

async function removeLiveCardInTransaction(
	tx: PrismaTransaction,
	command: RemoveLiveCardCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	requireUserFlowWriteDelegate(tx);
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	if (row.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await lockProject(tx, row.projectId);
	const document = parseFlowDocument(row.document);
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: {
			liveCards: (document.liveCards ?? []).filter(
				(card) => card.id !== command.payload.cardId
			),
			nodes: document.nodes,
		},
		row,
	});
}
