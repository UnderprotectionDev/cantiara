import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { viewSmartCollection } from "../../smart-collections/server/smart-collections";

import {
	COLLECTION_SUMMARY_LIMIT,
	type CreateProjectWallCommand,
	createProjectWallCommandSchema,
	createRegionSnapshotCommandSchema,
	DESIGN_TYPE_PROJECT_WALL,
	fieldsForDensity,
	type LiveCardFieldMap,
	type PlaceLiveCardCommand,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	type ProjectWallCardView,
	type ProjectWallDensity,
	type ProjectWallMemberPreview,
	type ProjectWallRejectionReason,
	type ProjectWallSourceKind,
	type ProjectWallView,
	type ProjectWallWriteOutcome,
	parseFocusOrder,
	placeLiveCardCommandSchema,
	type RegionSnapshotPreviewOutcome,
	type RegionSnapshotView,
	type RegionSnapshotWriteOutcome,
	regionSnapshotPayloadSchema,
	type SaveFocusOrderCommand,
	saveFocusOrderCommandSchema,
	snapshotNotice,
	type UpdateCardDensityCommand,
	type UpdateCardLayoutCommand,
	updateCardDensityCommandSchema,
	updateCardLayoutCommandSchema,
	updateDiagramNodeCommandSchema,
} from "./project-wall-model";
import { encodePdfPages, encodePngImage } from "./project-wall-snapshot";

type PrismaTransaction = Prisma.TransactionClient;

interface DesignRow {
	focusOrder: unknown;
	id: string;
	name: string;
	projectId: string;
	revision: number;
	type: string;
}

interface CardRow {
	authority: string | null;
	density: string;
	id: string;
	pinVersionId: string | null;
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

export async function saveFocusOrder(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectWallWriteOutcome> {
	const parsed = saveFocusOrderCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await prisma.$transaction((tx) =>
		saveFocusOrderInTransaction(tx, parsed.data)
	);
}

export async function previewRegionSnapshot(
	prisma: PrismaClient,
	input: unknown
): Promise<RegionSnapshotPreviewOutcome> {
	const parsed = regionSnapshotPayloadSchema.safeParse(input);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const built = await buildRegionSnapshot(prisma, parsed.data);
	if (built.status === "rejected") {
		return built;
	}
	return { ...built.snapshot, status: "ok" };
}

export async function createRegionSnapshot(
	prisma: PrismaClient,
	command: unknown
): Promise<RegionSnapshotWriteOutcome> {
	const parsed = createRegionSnapshotCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return await buildRegionSnapshot(prisma, parsed.data.payload);
}

export function updateDiagramNode(
	_prisma: PrismaClient,
	command: unknown
): ProjectWallWriteOutcome {
	const parsed = updateDiagramNodeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	return {
		reason: PROJECT_WALL_REJECTION.diagramReadOnly,
		status: "rejected",
	};
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
			focusOrder: [],
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
	const resolved = await resolveSource(tx, wall, payload);
	if (resolved.status === "rejected") {
		return resolved;
	}
	const { sourceId, sourceKind } = resolved;
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
			authority: resolved.authority,
			density,
			designId: wall.id,
			id: crypto.randomUUID(),
			pinVersionId: payload.pinVersionId ?? null,
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
	const cards = await prisma.projectWallCard.findMany({
		orderBy: { createdAt: "asc" },
		where: { designId: row.id },
	});
	return {
		cards: await Promise.all(
			cards.map((card) => presentCard(prisma, card, row.projectId, cards))
		),
		focusOrder: parseFocusOrder(row.focusOrder),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		recordKind: DESIGN_TYPE_PROJECT_WALL,
		revision: row.revision,
		type: DESIGN_TYPE_PROJECT_WALL,
	};
}

async function presentCard(
	prisma: PrismaClient | PrismaTransaction,
	card: CardRow,
	projectId: string,
	wallCards: CardRow[]
): Promise<ProjectWallCardView> {
	const density = isDensity(card.density)
		? card.density
		: PROJECT_WALL_COPY.preview;
	if (card.sourceKind === PROJECT_WALL_SOURCE_KIND.technicalDiagram) {
		const diagram = await prisma.design.findUnique({
			where: { id: card.sourceId },
		});
		const authority =
			card.authority === PROJECT_WALL_COPY.exact
				? PROJECT_WALL_COPY.exact
				: PROJECT_WALL_COPY.live;
		return {
			authority,
			density,
			fields: {
				[PROJECT_WALL_FIELD.title]: diagram?.name ?? "",
				[PROJECT_WALL_FIELD.type]: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
			},
			id: card.id,
			nodeEditing: false,
			openSourceRecord: PROJECT_WALL_COPY.openSourceRecord,
			positionX: card.positionX,
			positionY: card.positionY,
			sourceId: card.sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
		};
	}
	if (card.sourceKind === PROJECT_WALL_SOURCE_KIND.smartCollection) {
		const project = await prisma.project.findUnique({
			where: { id: projectId },
		});
		const members: ProjectWallMemberPreview[] = [];
		if (project) {
			const view = await viewSmartCollection(
				prisma as PrismaClient,
				project.workspaceId,
				card.sourceId
			);
			const cardSourceIds = new Set(
				wallCards
					.filter((item) => item.sourceKind === PROJECT_WALL_SOURCE_KIND.work)
					.map((item) => item.sourceId)
			);
			for (const member of view?.membership.members.slice(
				0,
				COLLECTION_SUMMARY_LIMIT
			) ?? []) {
				members.push({
					id: member.id,
					sharedSource: cardSourceIds.has(member.id)
						? PROJECT_WALL_COPY.sharedSource
						: undefined,
					title: member.title,
				});
			}
		}
		return {
			density,
			fields: {
				[PROJECT_WALL_FIELD.title]:
					(
						await prisma.smartCollection.findUnique({
							where: { id: card.sourceId },
						})
					)?.name ?? "",
				[PROJECT_WALL_FIELD.type]: PROJECT_WALL_SOURCE_KIND.smartCollection,
			},
			id: card.id,
			members,
			openAllInSource: PROJECT_WALL_COPY.openAllInSource,
			openSourceRecord: PROJECT_WALL_COPY.openSourceRecord,
			ownQuery: false,
			positionX: card.positionX,
			positionY: card.positionY,
			sourceId: card.sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.smartCollection,
		};
	}
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

async function resolveSource(
	tx: PrismaTransaction,
	wall: DesignRow,
	payload: PlaceLiveCardCommand["payload"]
): Promise<
	| {
			authority: string | null;
			sourceId: string;
			sourceKind: ProjectWallSourceKind;
			status: "ok";
	  }
	| { reason: ProjectWallRejectionReason; status: "rejected" }
> {
	const { sourceId, sourceKind } = payload;
	if (!sourceId) {
		return { reason: PROJECT_WALL_REJECTION.wallOnlyItem, status: "rejected" };
	}
	if (sourceKind === PROJECT_WALL_SOURCE_KIND.work) {
		const source = await tx.work.findUnique({ where: { id: sourceId } });
		if (!source || source.projectId !== wall.projectId) {
			return {
				reason: PROJECT_WALL_REJECTION.sourceNotFound,
				status: "rejected",
			};
		}
		return {
			authority: null,
			sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.work,
			status: "ok",
		};
	}
	if (sourceKind === PROJECT_WALL_SOURCE_KIND.technicalDiagram) {
		const diagram = await tx.design.findUnique({ where: { id: sourceId } });
		if (
			!diagram ||
			diagram.projectId !== wall.projectId ||
			diagram.type !== PROJECT_WALL_SOURCE_KIND.technicalDiagram
		) {
			return {
				reason: PROJECT_WALL_REJECTION.sourceNotFound,
				status: "rejected",
			};
		}
		const exact = payload.authority === PROJECT_WALL_COPY.exact;
		return {
			authority: exact ? PROJECT_WALL_COPY.exact : PROJECT_WALL_COPY.live,
			sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
			status: "ok",
		};
	}
	if (sourceKind === PROJECT_WALL_SOURCE_KIND.smartCollection) {
		const collection = await tx.smartCollection.findUnique({
			where: { id: sourceId },
		});
		const project = await tx.project.findUnique({
			where: { id: wall.projectId },
		});
		if (
			!(collection && project) ||
			collection.workspaceId !== project.workspaceId ||
			(collection.projectId !== null && collection.projectId !== wall.projectId)
		) {
			return {
				reason: PROJECT_WALL_REJECTION.sourceNotFound,
				status: "rejected",
			};
		}
		return {
			authority: null,
			sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.smartCollection,
			status: "ok",
		};
	}
	return { reason: PROJECT_WALL_REJECTION.wallOnlyItem, status: "rejected" };
}

async function saveFocusOrderInTransaction(
	tx: PrismaTransaction,
	command: SaveFocusOrderCommand
): Promise<ProjectWallWriteOutcome> {
	const wall = await tx.design.findUnique({
		where: { id: command.payload.wallId },
	});
	if (!wall || wall.type !== DESIGN_TYPE_PROJECT_WALL) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const cards = await tx.projectWallCard.findMany({
		where: { designId: wall.id },
	});
	const known = new Set(cards.map((card) => card.id));
	if (command.payload.cardIds.some((cardId) => !known.has(cardId))) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	await lockProject(tx, wall.projectId);
	const fingerprint = payloadFingerprint({
		cardIds: command.payload.cardIds,
		wallId: wall.id,
	});
	const commandKey = commandKeyFor(command.actorId, command.idempotencyKey);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const updated = await tx.design.update({
		data: {
			focusOrder: command.payload.cardIds,
			revision: wall.revision + 1,
		},
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

async function buildRegionSnapshot(
	prisma: PrismaClient,
	payload: { cardIds: string[]; format: string; wallId: string }
): Promise<RegionSnapshotWriteOutcome> {
	if (payload.cardIds.length === 0) {
		return {
			reason: PROJECT_WALL_REJECTION.emptySelection,
			status: "rejected",
		};
	}
	const wall = await getProjectWall(prisma, payload.wallId);
	if (!wall) {
		return { reason: PROJECT_WALL_REJECTION.wallNotFound, status: "rejected" };
	}
	const byId = new Map(wall.cards.map((card) => [card.id, card]));
	const selected = payload.cardIds.map((cardId) => byId.get(cardId));
	if (selected.some((card) => !card)) {
		return {
			reason: PROJECT_WALL_REJECTION.invalidCommand,
			status: "rejected",
		};
	}
	const titles = selected.map(
		(card) => card?.fields.Title ?? card?.fields.Type ?? card?.id ?? ""
	);
	const base: RegionSnapshotView = {
		...snapshotNotice(),
		capturedAt: new Date().toISOString(),
		titles,
	};
	if (payload.format === PROJECT_WALL_COPY.png) {
		return {
			snapshot: {
				...base,
				images: titles.map(() => ({ bytes: encodePngImage() })),
			},
			status: "committed",
		};
	}
	return {
		snapshot: {
			...base,
			bytes: encodePdfPages(titles),
			pages: titles.map((title) => ({ title })),
		},
		status: "committed",
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
