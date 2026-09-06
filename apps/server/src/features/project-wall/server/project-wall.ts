import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getProject } from "../../project-shell/server/project-shell";
import {
	type CreateProjectWallCommand,
	createProjectWallCommandSchema,
	DESIGN_TYPE_PROJECT_WALL,
	fieldsForDensity,
	type LiveCardFieldMap,
	type MaterializeStarterSkeletonWallsCommand,
	materializeStarterSkeletonWallsCommandSchema,
	type PlaceLiveCardCommand,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	PROJECT_WALL_STARTER_SKELETONS,
	type ProjectWallDensity,
	type ProjectWallView,
	type ProjectWallWriteOutcome,
	placeLiveCardCommandSchema,
	type StarterSkeletonWallsOutcome,
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
	id: string;
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

export async function materializeStarterSkeletonWalls(
	prisma: PrismaClient,
	command: unknown
): Promise<StarterSkeletonWallsOutcome> {
	const parsed =
		materializeStarterSkeletonWallsCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const project = await getProject(prisma, parsed.data.payload.projectId);
	if (!project || project.workspaceId !== parsed.data.workspaceId) {
		return {
			reason: PROJECT_WALL_REJECTION.projectNotFound,
			status: "rejected",
		};
	}
	const selectedNames = new Set(
		project.selectedSkeletons
			.filter((skeleton) => skeleton.surface === DESIGN_TYPE_PROJECT_WALL)
			.map((skeleton) => skeleton.name)
	);
	const skeletons = PROJECT_WALL_STARTER_SKELETONS.filter((skeleton) =>
		selectedNames.has(skeleton.name)
	);
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		materializeSkeletonsInTransaction(
			tx,
			parsed.data,
			commandKey,
			fingerprint,
			skeletons
		)
	);
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
			await tx.projectWallCard.update({
				data: {
					positionX: command.payload.positionX,
					positionY: command.payload.positionY,
				},
				where: { id: card.id },
			});
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
		},
	});
}

async function updateCardInTransaction(
	tx: PrismaTransaction,
	command: UpdateCardLayoutCommand | UpdateCardDensityCommand,
	step: {
		fingerprint: string;
		write: (card: CardRow) => Promise<void>;
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
	await step.write(card);
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
	const [cards, groups] = await Promise.all([
		prisma.projectWallCard.findMany({
			orderBy: { createdAt: "asc" },
			where: { designId: row.id },
		}),
		prisma.projectWallGroup.findMany({
			orderBy: { sortOrder: "asc" },
			where: { designId: row.id },
		}),
	]);
	return {
		cards: await Promise.all(cards.map((card) => presentCard(prisma, card))),
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			sortOrder: group.sortOrder,
		})),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		recordKind: DESIGN_TYPE_PROJECT_WALL,
		revision: row.revision,
		type: DESIGN_TYPE_PROJECT_WALL,
	};
}

async function materializeSkeletonsInTransaction(
	tx: PrismaTransaction,
	command: MaterializeStarterSkeletonWallsCommand,
	commandKey: string,
	fingerprint: string,
	skeletons: readonly (typeof PROJECT_WALL_STARTER_SKELETONS)[number][]
): Promise<StarterSkeletonWallsOutcome> {
	await lockProject(tx, command.payload.projectId);
	const replayed = await replaySkeletonsOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const startedAt = Date.now();
	const created = await Promise.all(
		skeletons.map((skeleton, index) =>
			tx.design.create({
				data: {
					createdAt: new Date(startedAt + index),
					groups: {
						create: skeleton.emptyHeadings.map((name, sortOrder) => ({
							id: crypto.randomUUID(),
							name,
							sortOrder,
						})),
					},
					id: crypto.randomUUID(),
					name: skeleton.name,
					projectId: command.payload.projectId,
					revision: 1,
					type: DESIGN_TYPE_PROJECT_WALL,
				},
			})
		)
	);
	const walls = await Promise.all(created.map((row) => hydrateWall(tx, row)));
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: walls[0]?.revision ?? 0,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(walls),
			targetId: walls[0]?.id ?? command.payload.projectId,
		},
	});
	return { status: "committed", walls };
}

async function replaySkeletonsOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<StarterSkeletonWallsOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = JSON.parse(existing.resultValue) as unknown;
	if (!Array.isArray(stored)) {
		return { status: "replayed", walls: [] };
	}
	const ids = stored.flatMap((entry) =>
		isRecord(entry) && typeof entry.id === "string" ? [entry.id] : []
	);
	const walls = await Promise.all(ids.map((id) => getProjectWall(tx, id)));
	return {
		status: "replayed",
		walls: walls.flatMap((wall) => (wall ? [wall] : [])),
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
		id: card.id,
		openSourceRecord: PROJECT_WALL_COPY.openSourceRecord,
		positionX: card.positionX,
		positionY: card.positionY,
		sourceId: card.sourceId,
		sourceKind: PROJECT_WALL_SOURCE_KIND.work,
	};
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
