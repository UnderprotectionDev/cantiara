import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { USAGE_KIND } from "../../relations/server/relations-model";
import { getScreenRow, parseWireframeVersions } from "./screen-double";
import {
	alignNodes,
	defaultLayout,
	duplicateNodes,
	isFlowNodeKind,
	moveNodes,
	orderZ,
	snapToGrid,
} from "./user-flow-editor";
import {
	type ApplyEditorOpCommand,
	applyEditorOpCommandSchema,
	type CreateUserFlowCommand,
	convertRecordKindFromRelationKind,
	createUserFlowCommandSchema,
	emptyFlowDocument,
	emptyPathText,
	type FlowDocument,
	type FlowLiveCardDocument,
	type FlowNodeDocument,
	type FlowNodeKind,
	isScreenFlowNode,
	type PlaceFlowNodeCommand,
	type PresentedFlowNode,
	type PresentedLiveCard,
	type PresentedOriginRelation,
	parseFlowDocument,
	placeFlowNodeCommandSchema,
	placeScreenNodeCommandSchema,
	SCREEN_NODE_KIND,
	screenOpenHref,
	serializeFlowDocument,
	type UpdateNodePathTextCommand,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
	USER_FLOW_REJECTION,
	type UserFlowView,
	type UserFlowWriteOutcome,
	updateNodePathTextCommandSchema,
	usageEmbedIdForNode,
} from "./user-flow-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;
type PrismaTransaction = Prisma.TransactionClient;

export interface UserFlowRow {
	document: string;
	id: string;
	projectId: string;
	revision: number;
	title: string;
}

export async function createUserFlow(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = createUserFlowCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	return await writeCreate(prisma, parsed.data);
}

export async function placeScreenNode(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = placeScreenNodeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	return await placeFlowNode(prisma, {
		...parsed.data,
		payload: {
			...parsed.data.payload,
			kind: SCREEN_NODE_KIND,
		},
	});
}

export async function placeFlowNode(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = placeFlowNodeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	if (!isFlowNodeKind(parsed.data.payload.kind)) {
		return {
			reason: USER_FLOW_REJECTION.closedSemanticSet,
			status: "rejected",
		};
	}
	if (
		parsed.data.payload.kind === SCREEN_NODE_KIND &&
		!parsed.data.payload.screenId
	) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		chosenWireframeVersionId: parsed.data.payload.chosenWireframeVersionId,
		kind: parsed.data.payload.kind,
		label: parsed.data.payload.label,
		layout: parsed.data.payload.layout,
		pathText: parsed.data.payload.pathText,
		screenId: parsed.data.payload.screenId,
		userFlowId: parsed.data.payload.userFlowId,
		visualStyle: parsed.data.payload.visualStyle,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		placeNodeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function applyEditorOp(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = applyEditorOpCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		applyEditorOpInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function updateNodePathText(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = updateNodePathTextCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updatePathInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getUserFlow(
	prisma: PrismaClient,
	input: { userFlowId: string; workspaceId: string }
): Promise<UserFlowView | null> {
	const row = await loadFlow(prisma, input.userFlowId);
	if (!row) {
		return null;
	}
	return await presentUserFlow(prisma, row, input.workspaceId);
}

export async function listUserFlows(
	prisma: PrismaClient,
	input: { projectId: string; workspaceId: string }
): Promise<UserFlowView[]> {
	if (
		!("userFlow" in prisma) ||
		typeof prisma.userFlow?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.userFlow.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId: input.projectId },
	});
	return await Promise.all(
		rows.map((row) => presentUserFlow(prisma, row, input.workspaceId))
	);
}

async function writeCreate(
	prisma: PrismaClient,
	command: CreateUserFlowCommand
): Promise<UserFlowWriteOutcome> {
	const fingerprint = payloadFingerprint(command.payload);
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, command, commandKey, fingerprint)
	);
}

const STALE_GENERATED_CLIENT =
	"Prisma client is missing current models; restart the API after prisma generate";

function hasUserFlowWriteDelegate(tx: PrismaTransaction): boolean {
	return typeof tx.userFlow?.create === "function";
}

export function requireUserFlowWriteDelegate(tx: PrismaTransaction): void {
	if (!hasUserFlowWriteDelegate(tx)) {
		throw new Error(STALE_GENERATED_CLIENT);
	}
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateUserFlowCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	requireUserFlowWriteDelegate(tx);
	await lockProject(tx, command.payload.projectId);
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const document = serializeFlowDocument(emptyFlowDocument());
	const created = await tx.userFlow.create({
		data: {
			document,
			id: crypto.randomUUID(),
			projectId: command.payload.projectId,
			revision: 1,
			title: command.payload.title,
			versions: {
				create: {
					document,
					id: crypto.randomUUID(),
					revision: 1,
				},
			},
		},
	});
	const view = await presentUserFlow(tx, created, "");
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { flow: view, status: "committed" };
}

async function placeNodeInTransaction(
	tx: PrismaTransaction,
	command: PlaceFlowNodeCommand,
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
	const node = buildPlacedNode(command, document.nodes.length);
	const next: FlowDocument = {
		liveCards: document.liveCards ?? [],
		nodes: [...document.nodes, node],
	};
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next,
		row,
	});
}

function buildPlacedNode(
	command: PlaceFlowNodeCommand,
	index: number
): FlowNodeDocument {
	const layout = command.payload.layout ?? defaultLayout(index);
	const visualStyle = command.payload.visualStyle ?? { emphasis: "default" };
	const pathText = command.payload.pathText ?? emptyPathText();
	if (command.payload.kind === SCREEN_NODE_KIND) {
		return {
			chosenWireframeVersionId:
				command.payload.chosenWireframeVersionId ?? null,
			id: crypto.randomUUID(),
			kind: SCREEN_NODE_KIND,
			layout,
			pathText,
			screenId: command.payload.screenId ?? "",
			visualStyle,
		};
	}
	return {
		id: crypto.randomUUID(),
		kind: command.payload.kind as Exclude<
			FlowNodeKind,
			typeof SCREEN_NODE_KIND
		>,
		label: command.payload.label ?? command.payload.kind,
		layout,
		pathText,
		visualStyle,
	};
}

async function applyEditorOpInTransaction(
	tx: PrismaTransaction,
	command: ApplyEditorOpCommand,
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
	if (command.payload.op === "undo") {
		return await undoFlowDocument(tx, {
			actorId: command.actorId,
			commandKey,
			fingerprint,
			row,
		});
	}
	const next = nextDocumentFromOp(
		parseFlowDocument(row.document),
		command.payload
	);
	if (next.status === "rejected") {
		return next;
	}
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: next.document,
		row,
	});
}

async function undoFlowDocument(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		row: UserFlowRow;
	}
): Promise<UserFlowWriteOutcome> {
	if (
		!("userFlowVersion" in tx) ||
		typeof tx.userFlowVersion?.findUnique !== "function"
	) {
		return { reason: USER_FLOW_REJECTION.nothingToUndo, status: "rejected" };
	}
	if (input.row.revision < 2) {
		return { reason: USER_FLOW_REJECTION.nothingToUndo, status: "rejected" };
	}
	const previous = await tx.userFlowVersion.findUnique({
		where: {
			userFlowId_revision: {
				revision: input.row.revision - 1,
				userFlowId: input.row.id,
			},
		},
	});
	if (!previous) {
		return { reason: USER_FLOW_REJECTION.nothingToUndo, status: "rejected" };
	}
	return await persistFlowDocument(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		next: parseFlowDocument(previous.document),
		row: input.row,
	});
}

function nextDocumentFromOp(
	document: FlowDocument,
	payload: ApplyEditorOpCommand["payload"]
):
	| { document: FlowDocument; status: "ok" }
	| {
			reason: (typeof USER_FLOW_REJECTION)["invalidCommand"];
			status: "rejected";
	  } {
	const nodeIds = payload.nodeIds ?? [];
	if (payload.op === "align") {
		if (!payload.axis) {
			return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
		}
		return {
			document: alignNodes(document, nodeIds, payload.axis),
			status: "ok",
		};
	}
	if (payload.op === "z-order") {
		if (!payload.direction) {
			return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
		}
		return {
			document: orderZ(document, nodeIds, payload.direction),
			status: "ok",
		};
	}
	if (payload.op === "grid") {
		return { document: snapToGrid(document, nodeIds), status: "ok" };
	}
	if (payload.op === "move") {
		return {
			document: moveNodes(
				document,
				nodeIds,
				payload.deltaX ?? 0,
				payload.deltaY ?? 0
			),
			status: "ok",
		};
	}
	if (payload.op === "duplicate") {
		return { document: duplicateNodes(document, nodeIds), status: "ok" };
	}
	return { reason: USER_FLOW_REJECTION.invalidCommand, status: "rejected" };
}

export async function persistFlowDocument(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		next: FlowDocument;
		row: UserFlowRow;
	}
): Promise<UserFlowWriteOutcome> {
	const serialized = serializeFlowDocument(input.next);
	const updated = await tx.userFlow.update({
		data: {
			document: serialized,
			revision: input.row.revision + 1,
			versions: {
				create: {
					document: serialized,
					id: crypto.randomUUID(),
					revision: input.row.revision + 1,
				},
			},
		},
		where: { id: input.row.id },
	});
	await syncScreenUsageLinks(tx, updated);
	const workspaceId = await workspaceIdForProject(tx, input.row.projectId);
	const view = await presentUserFlow(tx, updated, workspaceId);
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		view,
	});
	return { flow: view, status: "committed" };
}

async function updatePathInTransaction(
	tx: PrismaTransaction,
	command: UpdateNodePathTextCommand,
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
	const nodes = document.nodes.map((node) =>
		node.id === command.payload.nodeId
			? { ...node, pathText: command.payload.pathText }
			: node
	);
	if (!nodes.some((node) => node.id === command.payload.nodeId)) {
		return { reason: USER_FLOW_REJECTION.targetNotFound, status: "rejected" };
	}
	return await persistFlowDocument(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		next: { liveCards: document.liveCards ?? [], nodes },
		row,
	});
}

async function syncScreenUsageLinks(
	tx: PrismaTransaction,
	flow: UserFlowRow
): Promise<void> {
	if (!("usageLink" in tx) || typeof tx.usageLink?.findMany !== "function") {
		return;
	}
	const document = parseFlowDocument(flow.document);
	const project = await tx.project.findUnique({
		select: { workspaceId: true },
		where: { id: flow.projectId },
	});
	if (!project) {
		return;
	}
	const existing = await tx.usageLink.findMany({
		where: { hostRecordId: flow.id },
	});
	const desired = new Set(
		document.nodes
			.filter(isScreenFlowNode)
			.map((node) => usageEmbedIdForNode(node.id))
	);
	for (const row of existing) {
		if (desired.has(row.embedId)) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: usage-link cleanup stays sequential in one flow write.
		await tx.usageLink.delete({ where: { id: row.id } });
		await tx.usageHostEmbed.deleteMany({ where: { id: row.embedId } });
	}
	const present = new Set(existing.map((row) => row.embedId));
	for (const node of document.nodes.filter(isScreenFlowNode)) {
		const embedId = usageEmbedIdForNode(node.id);
		if (present.has(embedId)) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: embed then link must land before the next node.
		await tx.usageHostEmbed.create({
			data: {
				hostRecordId: flow.id,
				id: embedId,
				kind: USAGE_KIND.flowNodeScreenReference,
				sourceRecordId: node.screenId,
			},
		});
		await tx.usageLink.create({
			data: {
				embedId,
				hostRecordId: flow.id,
				id: crypto.randomUUID(),
				kind: USAGE_KIND.flowNodeScreenReference,
				sourceRecordId: node.screenId,
				workspaceId: project.workspaceId,
			},
		});
	}
}

export async function presentUserFlow(
	prisma: PrismaLike,
	row: UserFlowRow,
	workspaceId: string
): Promise<UserFlowView> {
	const document = parseFlowDocument(row.document);
	const usageLinks = await loadUsageLinks(prisma, row.id);
	const originRelations = await loadOriginRelations(prisma, row.id);
	const nodes = await Promise.all(
		document.nodes.map((node) =>
			presentNode(prisma, {
				flowProjectId: row.projectId,
				node,
				usageCreatedAt: usageLinks.find(
					(link) => link.embedId === usageEmbedIdForNode(node.id)
				)?.createdAt,
				workspaceId,
			})
		)
	);
	return {
		copy: {
			action: USER_FLOW_COPY.action,
			align: USER_FLOW_COPY.align,
			archived: USER_FLOW_COPY.archived,
			convertAndBind: USER_FLOW_COPY.convertAndBind,
			decision: USER_FLOW_COPY.decision,
			fitView: USER_FLOW_COPY.fitView,
			openSourceRecord: USER_FLOW_COPY.openSourceRecord,
			originLocation: USER_FLOW_COPY.originLocation,
			promoteToScreen: USER_FLOW_COPY.promoteToScreen,
			screen: USER_FLOW_COPY.screen,
			section: USER_FLOW_COPY.section,
			stateOutcome: USER_FLOW_COPY.stateOutcome,
			undo: USER_FLOW_COPY.undo,
			userFlow: USER_FLOW_COPY.userFlow,
		},
		id: row.id,
		liveCards: await presentLiveCards(prisma, document.liveCards ?? []),
		nodes,
		originRelations,
		projectId: row.projectId,
		recordKind: USER_FLOW_RECORD_KIND,
		revision: row.revision,
		title: row.title,
		usageLinks: usageLinks.map((link) => ({
			embedId: link.embedId,
			kind: link.kind,
			sourceRecordId: link.sourceRecordId,
		})),
	};
}

async function presentLiveCards(
	prisma: PrismaLike,
	cards: readonly FlowLiveCardDocument[]
): Promise<PresentedLiveCard[]> {
	return await Promise.all(
		cards.map(async (card) => {
			const source = await loadLiveCardSource(prisma, card);
			return {
				id: card.id,
				layout: card.layout,
				openSourceRecord: USER_FLOW_COPY.openSourceRecord,
				recordId: card.recordId,
				recordKind: card.recordKind,
				status: source.status,
				title: source.title,
			};
		})
	);
}

async function loadLiveCardSource(
	prisma: PrismaLike,
	card: FlowLiveCardDocument
): Promise<{ status: string | null; title: string }> {
	if (card.recordKind === USER_FLOW_COPY.work && "work" in prisma) {
		const work = await prisma.work.findUnique({
			where: { id: card.recordId },
		});
		if (work) {
			return { status: work.status, title: work.title };
		}
	}
	if (card.recordKind === USER_FLOW_COPY.decision && "decision" in prisma) {
		const decision = await prisma.decision.findUnique({
			where: { id: card.recordId },
		});
		if (decision) {
			return { status: decision.life, title: decision.title };
		}
	}
	if (card.recordKind === USER_FLOW_COPY.risk && "risk" in prisma) {
		const risk = await prisma.risk.findUnique({ where: { id: card.recordId } });
		if (risk) {
			return { status: risk.status, title: risk.title };
		}
	}
	return { status: null, title: card.recordKind };
}

async function presentNode(
	prisma: PrismaLike,
	input: {
		flowProjectId: string;
		node: FlowNodeDocument;
		usageCreatedAt?: Date;
		workspaceId: string;
	}
): Promise<PresentedFlowNode> {
	if (!isScreenFlowNode(input.node)) {
		return {
			boundAt: null,
			chosenWireframeVersionId: null,
			id: input.node.id,
			kind: input.node.kind,
			label: input.node.label,
			layout: input.node.layout,
			openHref: null,
			openSourceRecord: null,
			pathText: input.node.pathText,
			preview: null,
			reason: null,
			resolution: "ok",
			screenId: null,
			screenTitle: null,
			usageKind: null,
			visualStyle: input.node.visualStyle,
		};
	}
	const boundAt = input.usageCreatedAt?.toISOString() ?? null;
	const base = {
		boundAt,
		chosenWireframeVersionId: input.node.chosenWireframeVersionId,
		id: input.node.id,
		kind: SCREEN_NODE_KIND,
		label: "",
		layout: input.node.layout,
		pathText: input.node.pathText,
		screenId: input.node.screenId,
		usageKind: USAGE_KIND.flowNodeScreenReference,
		visualStyle: input.node.visualStyle,
	};
	const screen = await getScreenRow(prisma, input.node.screenId);
	if (!screen) {
		return {
			...base,
			openHref: null,
			openSourceRecord: null,
			preview: null,
			reason: USER_FLOW_COPY.permanentlyDeleted,
			resolution: "broken",
			screenTitle: null,
		};
	}
	const project = await loadProject(prisma, screen.projectId);
	if (
		input.workspaceId.length > 0 &&
		project &&
		project.workspaceId !== input.workspaceId
	) {
		return {
			...base,
			openHref: null,
			openSourceRecord: null,
			preview: null,
			reason: USER_FLOW_COPY.noAccess,
			resolution: "broken",
			screenTitle: null,
		};
	}
	if (screen.redactedAt) {
		return {
			...base,
			openHref: null,
			openSourceRecord: null,
			preview: null,
			reason: USER_FLOW_COPY.redactedForSecurity,
			resolution: "broken",
			screenTitle: null,
		};
	}
	if (screen.trashedAt) {
		return {
			...base,
			openHref: screenOpenHref(input.flowProjectId, screen.id),
			openSourceRecord: USER_FLOW_COPY.openSourceRecord,
			preview: null,
			reason: USER_FLOW_COPY.inTrash,
			resolution: "broken",
			screenTitle: screen.title,
		};
	}
	const versions = parseWireframeVersions(screen.wireframeVersionsJson);
	const chosenId =
		input.node.chosenWireframeVersionId ?? screen.currentWireframeVersionId;
	const preview =
		versions.find((version) => version.id === chosenId)?.preview ?? null;
	if (screen.archivedAt) {
		return {
			...base,
			openHref: screenOpenHref(input.flowProjectId, screen.id),
			openSourceRecord: USER_FLOW_COPY.openSourceRecord,
			preview,
			reason: USER_FLOW_COPY.archived,
			resolution: "archived",
			screenTitle: screen.title,
		};
	}
	return {
		...base,
		openHref: screenOpenHref(input.flowProjectId, screen.id),
		openSourceRecord: USER_FLOW_COPY.openSourceRecord,
		preview,
		reason: null,
		resolution: "ok",
		screenTitle: screen.title,
	};
}

export async function loadFlow(
	prisma: PrismaLike,
	userFlowId: string
): Promise<UserFlowRow | null> {
	if (
		!("userFlow" in prisma) ||
		typeof prisma.userFlow?.findUnique !== "function"
	) {
		return null;
	}
	return await prisma.userFlow.findUnique({ where: { id: userFlowId } });
}

async function loadProject(
	prisma: PrismaLike,
	projectId: string
): Promise<{ workspaceId: string } | null> {
	if (
		!("project" in prisma) ||
		typeof prisma.project?.findUnique !== "function"
	) {
		return null;
	}
	return await prisma.project.findUnique({
		select: { workspaceId: true },
		where: { id: projectId },
	});
}

export async function workspaceIdForProject(
	prisma: PrismaLike,
	projectId: string
): Promise<string> {
	const project = await loadProject(prisma, projectId);
	return project?.workspaceId ?? "";
}

async function loadUsageLinks(
	prisma: PrismaLike,
	hostRecordId: string
): Promise<
	{
		createdAt: Date;
		embedId: string;
		kind: string;
		sourceRecordId: string;
	}[]
> {
	if (
		!("usageLink" in prisma) ||
		typeof prisma.usageLink?.findMany !== "function"
	) {
		return [];
	}
	return await prisma.usageLink.findMany({
		orderBy: { createdAt: "asc" },
		where: { hostRecordId },
	});
}

async function loadOriginRelations(
	prisma: PrismaLike,
	recordId: string
): Promise<PresentedOriginRelation[]> {
	if (
		!("typedRelation" in prisma) ||
		typeof prisma.typedRelation?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.typedRelation.findMany({
		where: {
			OR: [{ fromId: recordId }, { toId: recordId }],
			type: RELATIONS_COPY.origin,
		},
	});
	const presented: PresentedOriginRelation[] = [];
	for (const row of rows) {
		const sourceIsFlow = row.fromId === recordId;
		const targetKind = sourceIsFlow ? row.toKind : row.fromKind;
		const recordKind = convertRecordKindFromRelationKind(targetKind);
		if (!recordKind) {
			continue;
		}
		presented.push({
			id: row.id,
			nodeId: row.originComponentId,
			recordId: sourceIsFlow ? row.toId : row.fromId,
			recordKind,
			sourceVersion: row.originSourceVersion,
			type: row.type,
		});
	}
	return presented;
}

export async function replayFlow(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await loadFlow(tx, existing.targetId);
	if (!live) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const workspaceId = await workspaceIdForProject(tx, live.projectId);
	return {
		flow: await presentUserFlow(tx, live, workspaceId),
		status: "replayed",
	};
}

export async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		view: UserFlowView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.view.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.view.id,
		},
	});
}

export async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`user-flow:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

export function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
