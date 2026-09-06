import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	createRelation,
	previewRelation,
} from "../../relations/server/relations";

import {
	type ApplyAutoLayoutCommand,
	AUTO_LAYOUT_STEP,
	applyAutoLayoutCommandSchema,
	type CreateGroupCommand,
	type CreateProjectWallCommand,
	createGroupCommandSchema,
	createPersistentRelationCommandSchema,
	createProjectWallCommandSchema,
	DESIGN_TYPE_PROJECT_WALL,
	type DrawVisualLineCommand,
	drawVisualLineCommandSchema,
	fieldsForDensity,
	type LiveCardFieldMap,
	type PlaceLiveCardCommand,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	type ProjectWallDensity,
	type ProjectWallGroupView,
	type ProjectWallRejectionReason,
	type ProjectWallView,
	type ProjectWallVisualLinkView,
	type ProjectWallWriteOutcome,
	placeLiveCardCommandSchema,
	previewPersistentRelationInputSchema,
	type SetLockPositionCommand,
	setLockPositionCommandSchema,
	type UpdateCardDensityCommand,
	type UpdateCardLayoutCommand,
	updateCardDensityCommandSchema,
	updateCardLayoutCommandSchema,
} from "./project-wall-model";

type PrismaTransaction = Prisma.TransactionClient;

interface DesignRow {
	id: string;
	name: string;
	projectId: string;
	revision: number;
	type: string;
}

interface CardRow {
	density: string;
	groupId: string | null;
	id: string;
	locked: boolean;
	positionX: number;
	positionY: number;
	sourceId: string;
	sourceKind: string;
}

export async function createProjectWall(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = createProjectWallCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const rejected = rejectCreate(parsed.data);
	if (rejected) {
		return rejected;
	}
	return await prisma.$transaction((tx) =>
		createWallInTransaction(tx, parsed.data)
	);
}

export async function placeLiveCard(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = placeLiveCardCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		placeCardInTransaction(tx, parsed.data)
	);
}

export async function updateCardLayout(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = updateCardLayoutCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		updateLayoutInTransaction(tx, parsed.data)
	);
}

export async function updateCardDensity(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = updateCardDensityCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		updateDensityInTransaction(tx, parsed.data)
	);
}

export async function drawVisualLine(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = drawVisualLineCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		drawVisualLineInTransaction(tx, parsed.data)
	);
}

export async function previewPersistentRelation(
	prisma: PrismaClient,
	input: unknown
) {
	const parsed = previewPersistentRelationInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected" as const,
		};
	}
	const ends = await visualLinkEnds(prisma, parsed.data);
	if (ends.status === "rejected") {
		return ends;
	}
	return await previewRelation(prisma, {
		from: { id: ends.from.sourceId, kind: PROJECT_WALL_SOURCE_KIND.work },
		to: { id: ends.to.sourceId, kind: PROJECT_WALL_SOURCE_KIND.work },
		type: parsed.data.type,
		viewerWorkspaceId: parsed.data.viewerWorkspaceId,
	});
}

export async function createPersistentRelation(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = createPersistentRelationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	if (parsed.data.payload.previewAcknowledged !== true) {
		return {
			reason: PROJECT_WALL_REJECTION.previewRequired,
			status: "rejected",
		};
	}
	const ends = await visualLinkEnds(prisma, parsed.data.payload);
	if (ends.status === "rejected") {
		return ends;
	}
	const related = await createRelation(prisma, {
		actorId: parsed.data.actorId,
		from: { id: ends.from.sourceId, kind: PROJECT_WALL_SOURCE_KIND.work },
		idempotencyKey: parsed.data.idempotencyKey,
		origin: "human",
		previewAcknowledged: true,
		to: { id: ends.to.sourceId, kind: PROJECT_WALL_SOURCE_KIND.work },
		type: parsed.data.payload.type,
		viewerWorkspaceId: parsed.data.viewerWorkspaceId,
	});
	if (related.status !== "committed" && related.status !== "replayed") {
		if (
			related.status === "rejected" &&
			related.reason === "preview-required"
		) {
			return {
				reason: PROJECT_WALL_REJECTION.previewRequired,
				status: "rejected",
			};
		}
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const wall = await getProjectWall(prisma, parsed.data.payload.wallId);
	if (!wall) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	return { status: related.status, wall };
}

export async function createGroup(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = createGroupCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	if (parsed.data.payload.parentId) {
		return {
			reason: PROJECT_WALL_REJECTION.nestedGroup,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		createGroupInTransaction(tx, parsed.data)
	);
}

export async function setLockPosition(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = setLockPositionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		setLockPositionInTransaction(tx, parsed.data)
	);
}

export async function applyAutoLayout(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = applyAutoLayoutCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		applyAutoLayoutInTransaction(tx, parsed.data)
	);
}

export async function getProjectWall(
	prisma: PrismaClient | PrismaTransaction,
	wallId: string
): Promise<ProjectWallView | null> {
	const row = await prisma.design.findUnique({ where: { id: wallId } });
	if (!row || row.type !== DESIGN_TYPE_PROJECT_WALL) {
		return null;
	}
	return await hydrateWall(prisma, row);
}

export async function listProjectWalls(
	prisma: PrismaClient,
	projectId: string
): Promise<ProjectWallView[]> {
	const rows = await prisma.design.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId, type: DESIGN_TYPE_PROJECT_WALL },
	});
	return await Promise.all(rows.map((row) => hydrateWall(prisma, row)));
}

function rejectCreate(
	command: CreateProjectWallCommand
): ProjectWallWriteOutcome | null {
	if (command.payload.parentId) {
		return { reason: PROJECT_WALL_REJECTION.nestedWall, status: "rejected" };
	}
	if (
		command.payload.surface &&
		command.payload.surface !== DESIGN_TYPE_PROJECT_WALL
	) {
		return { reason: PROJECT_WALL_REJECTION.wrongSurface, status: "rejected" };
	}
	if (!command.payload.projectId || command.payload.workspaceId) {
		return { reason: PROJECT_WALL_REJECTION.workspaceWall, status: "rejected" };
	}
	return null;
}

async function createWallInTransaction(
	tx: PrismaTransaction,
	command: CreateProjectWallCommand
): Promise<ProjectWallWriteOutcome> {
	const { payload } = command;
	const { projectId } = payload;
	if (!projectId) {
		return { reason: PROJECT_WALL_REJECTION.workspaceWall, status: "rejected" };
	}
	await lockProject(tx, projectId);
	const fingerprint = payloadFingerprint({
		name: payload.name,
		projectId,
		type: DESIGN_TYPE_PROJECT_WALL,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const created = await tx.design.create({
		data: {
			id: crypto.randomUUID(),
			name: payload.name,
			projectId,
			revision: 1,
			type: DESIGN_TYPE_PROJECT_WALL,
		},
	});
	const wall = await hydrateWall(tx, created);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		wall,
	});
	return { status: "committed", wall };
}

async function placeCardInTransaction(
	tx: PrismaTransaction,
	command: PlaceLiveCardCommand
): Promise<ProjectWallWriteOutcome> {
	const wall = await tx.design.findUnique({
		where: { id: command.payload.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const { payload } = command;
	const { sourceId, sourceKind } = payload;
	if (!sourceId || sourceKind !== PROJECT_WALL_SOURCE_KIND.work) {
		return { reason: PROJECT_WALL_REJECTION.wallOnlyItem, status: "rejected" };
	}
	const source = await tx.work.findUnique({ where: { id: sourceId } });
	if (!source || source.projectId !== wall.projectId) {
		return {
			reason: PROJECT_WALL_REJECTION.sourceNotFound,
			status: "rejected",
		};
	}
	await lockProject(tx, wall.projectId);
	const fingerprint = payloadFingerprint({
		sourceId,
		sourceKind,
		wallId: wall.id,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const existing = await tx.projectWallCard.findUnique({
		where: {
			designId_sourceId: { designId: wall.id, sourceId },
		},
	});
	if (existing) {
		return {
			reason: PROJECT_WALL_REJECTION.duplicateSource,
			status: "rejected",
		};
	}
	const density = command.payload.density ?? PROJECT_WALL_COPY.preview;
	await tx.projectWallCard.create({
		data: {
			density,
			designId: wall.id,
			id: crypto.randomUUID(),
			positionX: command.payload.positionX ?? 0,
			positionY: command.payload.positionY ?? 0,
			sourceId,
			sourceKind,
		},
	});
	const updated = await tx.design.update({
		data: { revision: wall.revision + 1 },
		where: { id: wall.id },
	});
	const view = await hydrateWall(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		wall: view,
	});
	return { status: "committed", wall: view };
}

async function updateLayoutInTransaction(
	tx: PrismaTransaction,
	command: UpdateCardLayoutCommand
): Promise<ProjectWallWriteOutcome> {
	return await updateCardInTransaction(tx, command, {
		fingerprint: payloadFingerprint({
			cardId: command.payload.cardId,
			positionX: command.payload.positionX,
			positionY: command.payload.positionY,
			wallId: command.payload.wallId,
		}),
		write: async (card) => {
			if (card.locked) {
				return PROJECT_WALL_REJECTION.positionLocked;
			}
			await tx.projectWallCard.update({
				data: {
					positionX: command.payload.positionX,
					positionY: command.payload.positionY,
				},
				where: { id: card.id },
			});
			return null;
		},
	});
}

async function updateDensityInTransaction(
	tx: PrismaTransaction,
	command: UpdateCardDensityCommand
): Promise<ProjectWallWriteOutcome> {
	const { payload } = command;
	const { density } = payload;
	if (!isDensity(density)) {
		return {
			reason: PROJECT_WALL_REJECTION.unknownDensity,
			status: "rejected",
		};
	}
	return await updateCardInTransaction(tx, command, {
		fingerprint: payloadFingerprint({
			cardId: payload.cardId,
			density,
			wallId: payload.wallId,
		}),
		write: async (card) => {
			await tx.projectWallCard.update({
				data: { density },
				where: { id: card.id },
			});
			return null;
		},
	});
}

async function updateCardInTransaction(
	tx: PrismaTransaction,
	command:
		| UpdateCardLayoutCommand
		| UpdateCardDensityCommand
		| SetLockPositionCommand,
	step: {
		fingerprint: string;
		write: (card: CardRow) => Promise<ProjectWallRejectionReason | null>;
	}
): Promise<ProjectWallWriteOutcome> {
	const wall = await tx.design.findUnique({
		where: { id: command.payload.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const card = await tx.projectWallCard.findUnique({
		where: { id: command.payload.cardId },
	});
	if (!card || card.designId !== wall.id) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	await lockProject(tx, wall.projectId);
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, step.fingerprint);
	if (replayed) {
		return replayed;
	}
	const lockedReason = await step.write(card);
	if (lockedReason) {
		return { reason: lockedReason, status: "rejected" };
	}
	const updated = await tx.design.update({
		data: { revision: wall.revision + 1 },
		where: { id: wall.id },
	});
	const view = await hydrateWall(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint: step.fingerprint,
		wall: view,
	});
	return { status: "committed", wall: view };
}

async function hydrateWall(
	prisma: PrismaClient | PrismaTransaction,
	row: DesignRow
): Promise<ProjectWallView> {
	const cards = await prisma.projectWallCard.findMany({
		orderBy: { createdAt: "asc" },
		where: { designId: row.id },
	});
	const groups = await prisma.projectWallGroup.findMany({
		orderBy: { createdAt: "asc" },
		where: { designId: row.id },
	});
	const visualLinks = await prisma.projectWallVisualLink.findMany({
		orderBy: { createdAt: "asc" },
		where: { designId: row.id },
	});
	const presentedCards = await Promise.all(
		cards.map((card) => presentCard(prisma, card))
	);
	return {
		cards: presentedCards,
		groups: presentGroups(groups, presentedCards),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		recordKind: DESIGN_TYPE_PROJECT_WALL,
		revision: row.revision,
		type: DESIGN_TYPE_PROJECT_WALL,
		visualLinks: visualLinks.map(presentVisualLink),
	};
}

async function presentCard(
	prisma: PrismaClient | PrismaTransaction,
	card: CardRow
) {
	const density = isDensity(card.density)
		? card.density
		: PROJECT_WALL_COPY.preview;
	const source =
		card.sourceKind === PROJECT_WALL_SOURCE_KIND.work
			? await prisma.work.findUnique({ where: { id: card.sourceId } })
			: null;
	const sourceFields: LiveCardFieldMap = source
		? {
				[PROJECT_WALL_FIELD.key]: source.key,
				[PROJECT_WALL_FIELD.status]: source.status,
				[PROJECT_WALL_FIELD.title]: source.title,
				[PROJECT_WALL_FIELD.type]: source.type,
			}
		: {};
	return {
		density,
		fields: fieldsForDensity(density, sourceFields),
		groupId: card.groupId,
		id: card.id,
		locked: card.locked,
		openSourceRecord: PROJECT_WALL_COPY.openSourceRecord,
		positionX: card.positionX,
		positionY: card.positionY,
		sourceId: card.sourceId,
		sourceKind: PROJECT_WALL_SOURCE_KIND.work,
	};
}

function presentGroups(
	groups: { id: string; name: string }[],
	cards: { groupId: string | null; id: string }[]
): ProjectWallGroupView[] {
	return groups.map((group) => ({
		cardIds: cards
			.filter((card) => card.groupId === group.id)
			.map((card) => card.id),
		id: group.id,
		name: group.name,
	}));
}

function presentVisualLink(link: {
	fromCardId: string;
	id: string;
	label: string;
	toCardId: string;
}): ProjectWallVisualLinkView {
	return {
		fromCardId: link.fromCardId,
		id: link.id,
		label: link.label,
		toCardId: link.toCardId,
	};
}

async function visualLinkEnds(
	prisma: PrismaClient | PrismaTransaction,
	input: { visualLinkId: string; wallId: string }
): Promise<
	| { from: CardRow; status: "ok"; to: CardRow }
	| { reason: ProjectWallRejectionReason; status: "rejected" }
> {
	const wall = await prisma.design.findUnique({
		where: { id: input.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const link = await prisma.projectWallVisualLink.findUnique({
		where: { id: input.visualLinkId },
	});
	if (!link || link.designId !== wall.id) {
		return {
			reason: PROJECT_WALL_REJECTION.visualLinkNotFound,
			status: "rejected",
		};
	}
	const from = await prisma.projectWallCard.findUnique({
		where: { id: link.fromCardId },
	});
	const to = await prisma.projectWallCard.findUnique({
		where: { id: link.toCardId },
	});
	if (!(from && to)) {
		return {
			reason: PROJECT_WALL_REJECTION.visualLinkNotFound,
			status: "rejected",
		};
	}
	return { from, status: "ok", to };
}

async function drawVisualLineInTransaction(
	tx: PrismaTransaction,
	command: DrawVisualLineCommand
): Promise<ProjectWallWriteOutcome> {
	const { payload } = command;
	if (payload.fromCardId === payload.toCardId) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const wall = await tx.design.findUnique({ where: { id: payload.wallId } });
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const from = await tx.projectWallCard.findUnique({
		where: { id: payload.fromCardId },
	});
	const to = await tx.projectWallCard.findUnique({
		where: { id: payload.toCardId },
	});
	if (!(from && to) || from.designId !== wall.id || to.designId !== wall.id) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	await lockProject(tx, wall.projectId);
	const fingerprint = payloadFingerprint({
		fromCardId: payload.fromCardId,
		label: payload.label,
		toCardId: payload.toCardId,
		wallId: wall.id,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	await tx.projectWallVisualLink.create({
		data: {
			designId: wall.id,
			fromCardId: payload.fromCardId,
			id: crypto.randomUUID(),
			label: payload.label,
			toCardId: payload.toCardId,
		},
	});
	const updated = await tx.design.update({
		data: { revision: wall.revision + 1 },
		where: { id: wall.id },
	});
	const view = await hydrateWall(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		wall: view,
	});
	return { status: "committed", wall: view };
}

async function createGroupInTransaction(
	tx: PrismaTransaction,
	command: CreateGroupCommand
): Promise<ProjectWallWriteOutcome> {
	const wall = await tx.design.findUnique({
		where: { id: command.payload.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const cards = await tx.projectWallCard.findMany({
		where: {
			designId: wall.id,
			id: { in: command.payload.cardIds },
		},
	});
	if (cards.length !== command.payload.cardIds.length) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	await lockProject(tx, wall.projectId);
	const fingerprint = payloadFingerprint({
		cardIds: command.payload.cardIds,
		name: command.payload.name,
		wallId: wall.id,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const groupId = crypto.randomUUID();
	await tx.projectWallGroup.create({
		data: {
			designId: wall.id,
			id: groupId,
			name: command.payload.name,
		},
	});
	await tx.projectWallCard.updateMany({
		data: { groupId },
		where: { id: { in: command.payload.cardIds } },
	});
	const updated = await tx.design.update({
		data: { revision: wall.revision + 1 },
		where: { id: wall.id },
	});
	const view = await hydrateWall(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		wall: view,
	});
	return { status: "committed", wall: view };
}

async function setLockPositionInTransaction(
	tx: PrismaTransaction,
	command: SetLockPositionCommand
): Promise<ProjectWallWriteOutcome> {
	return await updateCardInTransaction(tx, command, {
		fingerprint: payloadFingerprint({
			cardId: command.payload.cardId,
			locked: command.payload.locked,
			wallId: command.payload.wallId,
		}),
		write: async (card) => {
			await tx.projectWallCard.update({
				data: { locked: command.payload.locked },
				where: { id: card.id },
			});
			return null;
		},
	});
}

async function applyAutoLayoutInTransaction(
	tx: PrismaTransaction,
	command: ApplyAutoLayoutCommand
): Promise<ProjectWallWriteOutcome> {
	const wall = await tx.design.findUnique({
		where: { id: command.payload.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	await lockProject(tx, wall.projectId);
	const fingerprint = payloadFingerprint({
		autoLayout: true,
		wallId: wall.id,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const cards = await tx.projectWallCard.findMany({
		orderBy: { createdAt: "asc" },
		where: { designId: wall.id },
	});
	const moves: Promise<unknown>[] = [];
	let unlockedIndex = 0;
	for (const card of cards) {
		if (card.locked) {
			continue;
		}
		moves.push(
			tx.projectWallCard.update({
				data: {
					positionX: unlockedIndex * AUTO_LAYOUT_STEP,
					positionY: 0,
				},
				where: { id: card.id },
			})
		);
		unlockedIndex += 1;
	}
	await Promise.all(moves);
	const updated = await tx.design.update({
		data: { revision: wall.revision + 1 },
		where: { id: wall.id },
	});
	const view = await hydrateWall(tx, updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		wall: view,
	});
	return { status: "committed", wall: view };
}

function isDensity(value: string): value is ProjectWallDensity {
	return (PROJECT_WALL_DENSITIES as readonly string[]).includes(value);
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ProjectWallWriteOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const wall = await getProjectWall(tx, existing.targetId);
	if (wall) {
		return { status: "replayed", wall };
	}
	return { conflict: MUTATION_COPY.conflict, status: "conflict" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		wall: ProjectWallView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.wall.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.wall),
			targetId: input.wall.id,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-wall:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
