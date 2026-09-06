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
	type CreateUserFlowCommand,
	createUserFlowCommandSchema,
	emptyFlowDocument,
	emptyPathText,
	type FlowDocument,
	type FlowNodeDocument,
	type PlaceScreenNodeCommand,
	type PresentedScreenNode,
	parseFlowDocument,
	placeScreenNodeCommandSchema,
	SCREEN_NODE_KIND,
	screenOpenHref,
	serializeFlowDocument,
	type UpdateNodePathTextCommand,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
	type UserFlowView,
	type UserFlowWriteOutcome,
	updateNodePathTextCommandSchema,
	usageEmbedIdForNode,
} from "./user-flow-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;
type PrismaTransaction = Prisma.TransactionClient;

interface UserFlowRow {
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
		return { reason: "invalid-command", status: "rejected" };
	}
	return await writeCreate(prisma, parsed.data);
}

export async function placeScreenNode(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = placeScreenNodeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		placeNodeInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function updateNodePathText(
	prisma: PrismaClient,
	command: unknown
): Promise<UserFlowWriteOutcome> {
	const parsed = updateNodePathTextCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
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

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateUserFlowCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
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
	command: PlaceScreenNodeCommand,
	commandKey: string,
	fingerprint: string
): Promise<UserFlowWriteOutcome> {
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (row.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	await lockProject(tx, row.projectId);
	const document = parseFlowDocument(row.document);
	const node: FlowNodeDocument = {
		chosenWireframeVersionId: command.payload.chosenWireframeVersionId ?? null,
		id: crypto.randomUUID(),
		kind: SCREEN_NODE_KIND,
		pathText: command.payload.pathText ?? emptyPathText(),
		screenId: command.payload.screenId,
	};
	const next: FlowDocument = { nodes: [...document.nodes, node] };
	const serialized = serializeFlowDocument(next);
	const updated = await tx.userFlow.update({
		data: {
			document: serialized,
			revision: row.revision + 1,
			versions: {
				create: {
					document: serialized,
					id: crypto.randomUUID(),
					revision: row.revision + 1,
				},
			},
		},
		where: { id: row.id },
	});
	await syncScreenUsageLinks(tx, updated);
	const workspaceId = await workspaceIdForProject(tx, row.projectId);
	const view = await presentUserFlow(tx, updated, workspaceId);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
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
	const replayed = await replayFlow(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const row = await loadFlow(tx, command.payload.userFlowId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
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
		return { reason: "target-not-found", status: "rejected" };
	}
	const serialized = serializeFlowDocument({ nodes });
	const updated = await tx.userFlow.update({
		data: {
			document: serialized,
			revision: row.revision + 1,
			versions: {
				create: {
					document: serialized,
					id: crypto.randomUUID(),
					revision: row.revision + 1,
				},
			},
		},
		where: { id: row.id },
	});
	const workspaceId = await workspaceIdForProject(tx, row.projectId);
	const view = await presentUserFlow(tx, updated, workspaceId);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		view,
	});
	return { flow: view, status: "committed" };
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
		document.nodes.map((node) => usageEmbedIdForNode(node.id))
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
	for (const node of document.nodes) {
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

async function presentUserFlow(
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
			archived: USER_FLOW_COPY.archived,
			openSourceRecord: USER_FLOW_COPY.openSourceRecord,
			userFlow: USER_FLOW_COPY.userFlow,
		},
		id: row.id,
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

async function presentNode(
	prisma: PrismaLike,
	input: {
		flowProjectId: string;
		node: FlowNodeDocument;
		usageCreatedAt?: Date;
		workspaceId: string;
	}
): Promise<PresentedScreenNode> {
	const boundAt = input.usageCreatedAt?.toISOString() ?? null;
	const base = {
		boundAt,
		chosenWireframeVersionId: input.node.chosenWireframeVersionId,
		id: input.node.id,
		kind: SCREEN_NODE_KIND,
		pathText: input.node.pathText,
		screenId: input.node.screenId,
		usageKind: USAGE_KIND.flowNodeScreenReference,
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

async function loadFlow(
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

async function workspaceIdForProject(
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
): Promise<{ id: string; type: string }[]> {
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
	return rows.map((row) => ({ id: row.id, type: row.type }));
}

async function replayFlow(
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

async function writeReceipt(
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

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`user-flow:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
