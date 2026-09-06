/**
 * Project Wall seam — live cards of existing masters,
 * layout and density do not write the source record.
 * Visual line, proximity, and group membership are not relations;
 * Lock Position is view-local. Evidence:
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Proje Duvarı ilişki kurma karşıtı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import {
	changeWorkStatus,
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";

import {
	applyAutoLayout,
	createGroup,
	createPersistentRelation,
	createProjectWall,
	drawVisualLine,
	getProjectWall,
	listProjectWalls,
	placeLiveCard,
	previewPersistentRelation,
	setLockPosition,
	updateCardDensity,
	updateCardLayout,
} from "./project-wall";
import {
	DENSITY_FIELDS,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	projectWallCatalog,
} from "./project-wall-model";

const DATABASE_URL = localTestDatabaseUrl();
const SURFACE_COPY = /Wireframe|Moodboard|Wiki page|nested wall|CSS/i;
const SKETCH_COPY = /Sketch|freehand|Freehand/i;

async function seedWorkspace(prisma: PrismaClient) {
	const user = await prisma.user.create({
		data: {
			email: `founder-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: crypto.randomUUID(),
			name: "Founder",
		},
	});
	const workspace = await prisma.workspace.create({
		data: {
			id: crypto.randomUUID(),
			name: "Workspace",
			ownerId: user.id,
		},
	});
	return { actorId: user.id, workspaceId: workspace.id };
}

async function resetSharedTables(prisma: PrismaClient) {
	await prisma.typedRelation.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function openProject(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-wall-project-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Atlas",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

async function committedWork(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string; title: string }
) {
	const created = await createWork(prisma, {
		actorId: input.actorId,
		idempotencyKey: `create-work-${crypto.randomUUID()}`,
		origin: "human",
		payload: { projectId: input.projectId, title: input.title },
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected work");
	}
	return created.work;
}

async function committedWall(
	prisma: PrismaClient,
	input: { actorId: string; name: string; projectId: string }
) {
	const created = await createProjectWall(prisma, {
		actorId: input.actorId,
		idempotencyKey: `create-wall-${crypto.randomUUID()}`,
		origin: "human",
		payload: { name: input.name, projectId: input.projectId },
	});
	if (created.status !== "committed") {
		throw new Error("expected wall");
	}
	return created.wall;
}

async function placedCard(
	prisma: PrismaClient,
	input: {
		actorId: string;
		positionX?: number;
		positionY?: number;
		sourceId: string;
		wallId: string;
	}
) {
	const placed = await placeLiveCard(prisma, {
		actorId: input.actorId,
		idempotencyKey: `place-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			positionX: input.positionX,
			positionY: input.positionY,
			sourceId: input.sourceId,
			sourceKind: PROJECT_WALL_SOURCE_KIND.work,
			wallId: input.wallId,
		},
	});
	if (placed.status !== "committed") {
		throw new Error("expected card");
	}
	const card = placed.wall.cards.find(
		(item) => item.sourceId === input.sourceId
	);
	if (!card) {
		throw new Error("expected placed card");
	}
	return { card, wall: placed.wall };
}

describe("Project Wall catalog", () => {
	it("uses English Project Wall densities and Open Source Record", () => {
		const catalog = projectWallCatalog();
		expect(catalog.copy.projectWall).toBe("Project Wall");
		expect(catalog.copy.compact).toBe("Compact");
		expect(catalog.copy.preview).toBe("Preview");
		expect(catalog.copy.detailed).toBe("Detailed");
		expect(catalog.copy.openSourceRecord).toBe("Open Source Record");
		expect(catalog.copy.createPersistentRelation).toBe(
			"Create Persistent Relation"
		);
		expect(catalog.copy.lockPosition).toBe("Lock Position");
		expect(catalog.densities).toEqual(PROJECT_WALL_DENSITIES);
		expect(catalog.densityFields.Compact).toEqual([
			PROJECT_WALL_FIELD.title,
			PROJECT_WALL_FIELD.type,
		]);
		expect(catalog.densityFields.Preview).toEqual([
			PROJECT_WALL_FIELD.title,
			PROJECT_WALL_FIELD.type,
			PROJECT_WALL_FIELD.status,
		]);
		expect(catalog.densityFields.Detailed).toEqual([
			PROJECT_WALL_FIELD.title,
			PROJECT_WALL_FIELD.type,
			PROJECT_WALL_FIELD.status,
			PROJECT_WALL_FIELD.key,
		]);
		expect(catalog.counterparts).toEqual({
			freehand: false,
			groupMembershipAsRelation: false,
			moodboard: false,
			nestedGroup: false,
			nestedWall: false,
			perCardCss: false,
			proximityAsRelation: false,
			sketchCard: false,
			visualLineAsRelation: false,
			wallOnlyFile: false,
			wallOnlyNote: false,
			wallOnlyTask: false,
			wikiPage: false,
			wireframe: false,
			workspaceWall: false,
		});
		expect(JSON.stringify(catalog.copy)).not.toMatch(SURFACE_COPY);
		expect(catalog.copy).not.toHaveProperty("css");
		expect(DENSITY_FIELDS.Compact).not.toContain("CSS");
	});
});

describe("Project Wall live cards", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("keeps multiple flat named Project Walls in one Project", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const narrative = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const research = await committedWall(prisma, {
			actorId,
			name: "Research map",
			projectId,
		});
		expect(narrative.type).toBe("Project Wall");
		expect(research.projectId).toBe(projectId);
		expect(narrative.id).not.toBe(research.id);
		expect(narrative).not.toHaveProperty("parentId");
		const listed = await listProjectWalls(prisma, projectId);
		expect(listed.map((wall) => wall.name)).toEqual([
			"Launch narrative",
			"Research map",
		]);
	});

	it("refuses a Workspace wall, a nested wall, and a Wireframe surface", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const workspaceWall = await createProjectWall(prisma, {
			actorId,
			idempotencyKey: "workspace-wall",
			origin: "human",
			payload: { name: "Home", workspaceId },
		});
		expect(workspaceWall).toEqual({
			reason: PROJECT_WALL_REJECTION.workspaceWall,
			status: "rejected",
		});
		const nested = await createProjectWall(prisma, {
			actorId,
			idempotencyKey: "nested-wall",
			origin: "human",
			payload: { name: "Child", parentId: "wall-1", projectId },
		});
		expect(nested).toEqual({
			reason: PROJECT_WALL_REJECTION.nestedWall,
			status: "rejected",
		});
		const wireframe = await createProjectWall(prisma, {
			actorId,
			idempotencyKey: "wireframe-as-wall",
			origin: "human",
			payload: { name: "Screen", projectId, surface: "Wireframe" },
		});
		expect(wireframe).toEqual({
			reason: PROJECT_WALL_REJECTION.wrongSurface,
			status: "rejected",
		});
	});

	it("places a live card that keeps the source id and does not copy the Work", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const placed = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-checkout",
			origin: "human",
			payload: {
				sourceId: work.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: wall.id,
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			return;
		}
		expect(placed.wall.cards).toHaveLength(1);
		const [card] = placed.wall.cards;
		expect(card?.sourceId).toBe(work.id);
		expect(card?.sourceKind).toBe(PROJECT_WALL_SOURCE_KIND.work);
		expect(card?.openSourceRecord).toBe(PROJECT_WALL_COPY.openSourceRecord);
		expect(card?.fields.Title).toBe("Checkout flow");
		const works = await prisma.work.findMany({ where: { projectId } });
		expect(works).toHaveLength(1);
		expect(works[0]?.id).toBe(work.id);
	});

	it("references the same Work on two walls without a second Work row", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const first = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const second = await committedWall(prisma, {
			actorId,
			name: "Research map",
			projectId,
		});
		await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-first",
			origin: "human",
			payload: {
				sourceId: work.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: first.id,
			},
		});
		await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-second",
			origin: "human",
			payload: {
				sourceId: work.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: second.id,
			},
		});
		const loadedFirst = await getProjectWall(prisma, first.id);
		const loadedSecond = await getProjectWall(prisma, second.id);
		expect(loadedFirst?.cards[0]?.sourceId).toBe(work.id);
		expect(loadedSecond?.cards[0]?.sourceId).toBe(work.id);
		expect(loadedFirst?.cards[0]?.id).not.toBe(loadedSecond?.cards[0]?.id);
		expect(await prisma.work.count({ where: { projectId } })).toBe(1);
	});

	it("refuses a wall-only note, task, or file", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const note = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "wall-note",
			origin: "human",
			payload: { sourceKind: "Note", wallId: wall.id },
		});
		expect(note).toEqual({
			reason: PROJECT_WALL_REJECTION.wallOnlyItem,
			status: "rejected",
		});
		const task = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "wall-task",
			origin: "human",
			payload: { sourceKind: "Task", wallId: wall.id },
		});
		expect(task.status).toBe("rejected");
		if (task.status === "rejected") {
			expect(task.reason).toBe(PROJECT_WALL_REJECTION.wallOnlyItem);
		}
	});

	it("does not write Work title, status, or relations when layout or density changes", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const placed = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-checkout",
			origin: "human",
			payload: {
				density: PROJECT_WALL_COPY.compact,
				positionX: 12,
				positionY: 24,
				sourceId: work.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: wall.id,
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			return;
		}
		const cardId = placed.wall.cards[0]?.id;
		expect(cardId).toBeTruthy();
		if (!cardId) {
			return;
		}
		const moved = await updateCardLayout(prisma, {
			actorId,
			idempotencyKey: "move-checkout",
			origin: "human",
			payload: {
				cardId,
				positionX: 200,
				positionY: 80,
				wallId: wall.id,
			},
		});
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			return;
		}
		expect(moved.wall.cards[0]?.positionX).toBe(200);
		expect(moved.wall.cards[0]?.positionY).toBe(80);
		const denser = await updateCardDensity(prisma, {
			actorId,
			idempotencyKey: "density-checkout",
			origin: "human",
			payload: {
				cardId,
				density: PROJECT_WALL_COPY.detailed,
				wallId: wall.id,
			},
		});
		expect(denser.status).toBe("committed");
		if (denser.status !== "committed") {
			return;
		}
		expect(denser.wall.cards[0]?.density).toBe(PROJECT_WALL_COPY.detailed);
		expect(denser.wall.cards[0]?.fields).toEqual({
			Key: work.key,
			Status: WORK_STATUS.notStarted,
			Title: "Checkout flow",
			Type: work.type,
		});
		const source = await getWork(prisma, work.id);
		expect(source?.title).toBe("Checkout flow");
		expect(source?.status).toBe(WORK_STATUS.notStarted);
		expect(source?.revision).toBe(work.revision);
		const relations = await listRelations(prisma, {
			record: { id: work.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toEqual([]);
		const statusWrite = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "status-from-source",
			origin: "human",
			status: WORK_STATUS.inProgress,
			workId: work.id,
		});
		expect(statusWrite.status).toBe("committed");
		const live = await getProjectWall(prisma, wall.id);
		expect(live?.cards[0]?.fields.Status).toBe(WORK_STATUS.inProgress);
		expect(live?.cards[0]?.sourceId).toBe(work.id);
	});
});

describe("Project Wall visual line and lock", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("stores a directed labeled visual line without writing a record relation", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const checkout = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wallet = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Wallet",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const from = await placedCard(prisma, {
			actorId,
			sourceId: checkout.id,
			wallId: wall.id,
		});
		const to = await placedCard(prisma, {
			actorId,
			sourceId: wallet.id,
			wallId: wall.id,
		});
		const drawn = await drawVisualLine(prisma, {
			actorId,
			idempotencyKey: "draw-checkout-wallet",
			origin: "human",
			payload: {
				fromCardId: from.card.id,
				label: "feeds",
				toCardId: to.card.id,
				wallId: wall.id,
			},
		});
		expect(drawn.status).toBe("committed");
		if (drawn.status !== "committed") {
			return;
		}
		expect(drawn.wall.visualLinks).toEqual([
			{
				fromCardId: from.card.id,
				id: expect.any(String),
				label: "feeds",
				toCardId: to.card.id,
			},
		]);
		expect(
			await listRelations(prisma, {
				record: { id: checkout.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		expect(
			await listRelations(prisma, {
				record: { id: wallet.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
	});

	it("does not write a relation from Create Persistent Relation without preview", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const checkout = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wallet = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Wallet",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const from = await placedCard(prisma, {
			actorId,
			sourceId: checkout.id,
			wallId: wall.id,
		});
		const to = await placedCard(prisma, {
			actorId,
			sourceId: wallet.id,
			wallId: wall.id,
		});
		const drawn = await drawVisualLine(prisma, {
			actorId,
			idempotencyKey: "draw-line",
			origin: "human",
			payload: {
				fromCardId: from.card.id,
				label: "feeds",
				toCardId: to.card.id,
				wallId: wall.id,
			},
		});
		expect(drawn.status).toBe("committed");
		if (drawn.status !== "committed") {
			return;
		}
		const visualLinkId = drawn.wall.visualLinks[0]?.id;
		expect(visualLinkId).toBeTruthy();
		if (!visualLinkId) {
			return;
		}
		const skipped = await createPersistentRelation(prisma, {
			actorId,
			idempotencyKey: "relate-no-preview",
			origin: "human",
			payload: {
				type: "Related",
				visualLinkId,
				wallId: wall.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(skipped).toEqual({
			reason: PROJECT_WALL_REJECTION.previewRequired,
			status: "rejected",
		});
		expect(
			await listRelations(prisma, {
				record: { id: checkout.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const preview = await previewPersistentRelation(prisma, {
			type: "Related",
			viewerWorkspaceId: workspaceId,
			visualLinkId,
			wallId: wall.id,
		});
		expect(preview).toMatchObject({
			preview: {
				from: { title: "Checkout flow" },
				to: { title: "Wallet" },
				type: "Related",
			},
			status: "ok",
		});
		const created = await createPersistentRelation(prisma, {
			actorId,
			idempotencyKey: "relate-checkout-wallet",
			origin: "human",
			payload: {
				previewAcknowledged: true,
				type: "Related",
				visualLinkId,
				wallId: wall.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.wall.visualLinks).toHaveLength(1);
		const related = await listRelations(prisma, {
			record: { id: checkout.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(related).toHaveLength(1);
		expect(related[0]?.type).toBe("Related");
		expect(related[0]?.from.id).toBe(checkout.id);
		expect(related[0]?.to.id).toBe(wallet.id);
	});

	it("does not treat proximity or group membership as a relation", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const checkout = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wallet = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Wallet",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const from = await placedCard(prisma, {
			actorId,
			positionX: 0,
			positionY: 0,
			sourceId: checkout.id,
			wallId: wall.id,
		});
		const to = await placedCard(prisma, {
			actorId,
			positionX: 8,
			positionY: 8,
			sourceId: wallet.id,
			wallId: wall.id,
		});
		expect(
			await listRelations(prisma, {
				record: { id: checkout.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const grouped = await createGroup(prisma, {
			actorId,
			idempotencyKey: "launch-group",
			origin: "human",
			payload: {
				cardIds: [from.card.id, to.card.id],
				name: "Launch cluster",
				wallId: wall.id,
			},
		});
		expect(grouped.status).toBe("committed");
		if (grouped.status !== "committed") {
			return;
		}
		expect(grouped.wall.groups).toEqual([
			{
				cardIds: [from.card.id, to.card.id],
				id: expect.any(String),
				name: "Launch cluster",
			},
		]);
		expect(grouped.wall.cards.every((card) => card.groupId)).toBe(true);
		const checkoutSource = await getWork(prisma, checkout.id);
		expect(checkoutSource?.title).toBe("Checkout flow");
		expect(checkoutSource).not.toHaveProperty("classification");
		expect(
			await listRelations(prisma, {
				record: { id: checkout.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const nested = await createGroup(prisma, {
			actorId,
			idempotencyKey: "nested-group",
			origin: "human",
			payload: {
				cardIds: [from.card.id],
				name: "Inner",
				parentId: grouped.wall.groups[0]?.id,
				wallId: wall.id,
			},
		});
		expect(nested).toEqual({
			reason: PROJECT_WALL_REJECTION.nestedGroup,
			status: "rejected",
		});
	});

	it("keeps Lock Position view-local and does not freeze the source record", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const checkout = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const wallet = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Wallet",
		});
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const locked = await placedCard(prisma, {
			actorId,
			positionX: 40,
			positionY: 60,
			sourceId: checkout.id,
			wallId: wall.id,
		});
		await placedCard(prisma, {
			actorId,
			positionX: 80,
			positionY: 90,
			sourceId: wallet.id,
			wallId: wall.id,
		});
		const pin = await setLockPosition(prisma, {
			actorId,
			idempotencyKey: "lock-checkout",
			origin: "human",
			payload: {
				cardId: locked.card.id,
				locked: true,
				wallId: wall.id,
			},
		});
		expect(pin.status).toBe("committed");
		if (pin.status !== "committed") {
			return;
		}
		expect(pin.wall.cards[0]?.locked).toBe(true);
		expect(pin.wall.cards[0]?.openSourceRecord).toBe(
			PROJECT_WALL_COPY.openSourceRecord
		);
		const moved = await updateCardLayout(prisma, {
			actorId,
			idempotencyKey: "move-locked",
			origin: "human",
			payload: {
				cardId: locked.card.id,
				positionX: 400,
				positionY: 400,
				wallId: wall.id,
			},
		});
		expect(moved).toEqual({
			reason: PROJECT_WALL_REJECTION.positionLocked,
			status: "rejected",
		});
		const laidOut = await applyAutoLayout(prisma, {
			actorId,
			idempotencyKey: "auto-layout",
			origin: "human",
			payload: { wallId: wall.id },
		});
		expect(laidOut.status).toBe("committed");
		if (laidOut.status !== "committed") {
			return;
		}
		const lockedCard = laidOut.wall.cards.find(
			(card) => card.id === locked.card.id
		);
		const other = laidOut.wall.cards.find((card) => card.id !== locked.card.id);
		expect(lockedCard?.positionX).toBe(40);
		expect(lockedCard?.positionY).toBe(60);
		expect(other?.positionX).not.toBe(80);
		const source = await getWork(prisma, checkout.id);
		expect(source?.status).toBe(WORK_STATUS.notStarted);
		expect(source?.revision).toBe(checkout.revision);
		const statusWrite = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: checkout.revision,
			idempotencyKey: "status-while-locked",
			origin: "human",
			status: WORK_STATUS.inProgress,
			workId: checkout.id,
		});
		expect(statusWrite.status).toBe("committed");
		const live = await getProjectWall(prisma, wall.id);
		expect(
			live?.cards.find((card) => card.id === locked.card.id)?.fields.Status
		).toBe(WORK_STATUS.inProgress);
	});

	it("refuses a Sketch card or freehand drawing on the wall", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const sketch = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "sketch-card",
			origin: "human",
			payload: { sourceKind: "Sketch", wallId: wall.id },
		});
		expect(sketch).toEqual({
			reason: PROJECT_WALL_REJECTION.wallOnlyItem,
			status: "rejected",
		});
		const freehand = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "freehand",
			origin: "human",
			payload: { sourceKind: "Freehand", wallId: wall.id },
		});
		expect(freehand).toEqual({
			reason: PROJECT_WALL_REJECTION.wallOnlyItem,
			status: "rejected",
		});
		expect(JSON.stringify(projectWallCatalog().copy)).not.toMatch(SKETCH_COPY);
	});
});
