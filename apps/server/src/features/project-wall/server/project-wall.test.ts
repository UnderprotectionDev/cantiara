/**
 * Project Wall seam — live cards of existing masters,
 * layout and density do not write the source record.
 * Visual line, proximity, and group membership are not relations;
 * Lock Position is view-local. Evidence:
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Proje Duvarı canlı kart; ilişki kurma karşıtı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import { listRelations } from "../../relations/server/relations";
import {
	createSmartCollection,
	viewSmartCollection,
} from "../../smart-collections/server/smart-collections";
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
	createRegionSnapshot,
	drawVisualLine,
	getProjectWall,
	listProjectWalls,
	placeLiveCard,
	previewPersistentRelation,
	previewRegionSnapshot,
	saveFocusOrder,
	setLockPosition,
	updateCardDensity,
	updateCardLayout,
	updateDiagramNode,
} from "./project-wall";
import {
	DENSITY_FIELDS,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	projectWallCatalog,
	wallPresentation,
} from "./project-wall-model";

const DATABASE_URL = localTestDatabaseUrl();
const SURFACE_COPY = /Wireframe|Moodboard|Wiki page|nested wall|CSS/i;
const SHARE_UI = /Link sharing|Build in Public|External Surface/i;
const SKETCH_COPY = /Sketch|freehand|Freehand/i;
const CAPTURED_DAY = /^\d{4}-\d{2}-\d{2}/;

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
		expect(catalog.copy.visualLink).toBe("Visual link");
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
			buildInPublic: false,
			collectionOwnQuery: false,
			contentCopy: false,
			diagramNodeEditing: false,
			externalSurface: false,
			freehand: false,
			groupMembershipAsRelation: false,
			moodboard: false,
			nestedGroup: false,
			nestedWall: false,
			perCardCss: false,
			proximityAsRelation: false,
			shareGrant: false,
			sketchCard: false,
			visualLineAsRelation: false,
			wallOnlyFile: false,
			wallOnlyNote: false,
			wallOnlyTask: false,
			wikiPage: false,
			wireframe: false,
			workspaceWall: false,
		});
		expect(catalog.copy.presentationMode).toBe("Presentation Mode");
		expect(catalog.copy.frozenCopy).toBe("Frozen copy");
		expect(catalog.copy.openAllInSource).toBe("Open all in source");
		expect(JSON.stringify(catalog.copy)).not.toMatch(SURFACE_COPY);
		expect(JSON.stringify(catalog.copy)).not.toMatch(SHARE_UI);
		expect(JSON.stringify(catalog.copy)).not.toMatch(SKETCH_COPY);
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

describe("Project Wall presentation and internal snapshot", () => {
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

	it("treats Presentation Mode as view metadata that hides tools without a second wall", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
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
		const cardId = placed.wall.cards[0]?.id;
		expect(cardId).toBeTruthy();
		if (!cardId) {
			return;
		}
		const saved = await saveFocusOrder(prisma, {
			actorId,
			idempotencyKey: "focus-order",
			origin: "human",
			payload: { cardIds: [cardId], wallId: wall.id },
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			return;
		}
		expect(saved.wall.focusOrder).toEqual([cardId]);
		expect(await prisma.design.count({ where: { projectId } })).toBe(1);
		expect(await prisma.work.count({ where: { projectId } })).toBe(1);
		const presenting = wallPresentation(saved.wall, true);
		expect(presenting.toolsVisible).toBe(false);
		expect(presenting.contentCopy).toBe(false);
		expect(presenting.wall.id).toBe(wall.id);
		expect(presenting.focusOrder).toEqual([cardId]);
		const editing = wallPresentation(saved.wall, false);
		expect(editing.toolsVisible).toBe(true);
	});

	it("previews a frozen copy that does not grant share access or open 73/75 UI", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
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
		const cardId = placed.wall.cards[0]?.id;
		expect(cardId).toBeTruthy();
		if (!cardId) {
			return;
		}
		const preview = await previewRegionSnapshot(prisma, {
			cardIds: [cardId],
			format: PROJECT_WALL_COPY.png,
			wallId: wall.id,
		});
		expect(preview.status).toBe("ok");
		if (preview.status !== "ok") {
			return;
		}
		expect(preview.kind).toBe(PROJECT_WALL_COPY.frozenCopy);
		expect(preview.shareGrant).toBe(false);
		expect(preview.opensLinkSharing).toBe(false);
		expect(preview.opensBuildInPublic).toBe(false);
		expect(preview.wallLocked).toBe(false);
		expect(preview.liveSourceLink).toBe(false);
		expect(preview.notice).toBe(PROJECT_WALL_COPY.noShareGrant);
		expect(JSON.stringify(preview)).not.toMatch(SHARE_UI);
	});

	it("captures a dated PNG or PDF frozen copy while live cards keep updating", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const first = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		const second = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Refund path",
		});
		const placedFirst = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-first",
			origin: "human",
			payload: {
				sourceId: first.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: wall.id,
			},
		});
		const placedSecond = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-second",
			origin: "human",
			payload: {
				sourceId: second.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: wall.id,
			},
		});
		expect(placedFirst.status).toBe("committed");
		expect(placedSecond.status).toBe("committed");
		if (
			placedFirst.status !== "committed" ||
			placedSecond.status !== "committed"
		) {
			return;
		}
		const firstCard = placedFirst.wall.cards[0]?.id;
		const secondCard = placedSecond.wall.cards.find(
			(card) => card.sourceId === second.id
		)?.id;
		expect(firstCard && secondCard).toBeTruthy();
		if (!(firstCard && secondCard)) {
			return;
		}
		const png = await createRegionSnapshot(prisma, {
			actorId,
			idempotencyKey: "snap-png",
			origin: "human",
			payload: {
				cardIds: [firstCard, secondCard],
				format: PROJECT_WALL_COPY.png,
				wallId: wall.id,
			},
		});
		expect(png.status).toBe("committed");
		if (png.status !== "committed") {
			return;
		}
		expect(png.snapshot.kind).toBe(PROJECT_WALL_COPY.frozenCopy);
		expect(png.snapshot.capturedAt).toMatch(CAPTURED_DAY);
		expect(png.snapshot.images).toHaveLength(2);
		expect(png.snapshot.images[0]?.bytes.subarray(0, 8)).toEqual(
			Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
		);
		expect(png.snapshot.shareGrant).toBe(false);
		const smashed = await createRegionSnapshot(prisma, {
			actorId,
			idempotencyKey: "smash-wall",
			origin: "human",
			payload: {
				cardIds: [],
				format: PROJECT_WALL_COPY.png,
				wallId: wall.id,
			},
		});
		expect(smashed).toEqual({
			reason: PROJECT_WALL_REJECTION.emptySelection,
			status: "rejected",
		});
		const pdf = await createRegionSnapshot(prisma, {
			actorId,
			idempotencyKey: "snap-pdf",
			origin: "human",
			payload: {
				cardIds: [firstCard, secondCard],
				format: PROJECT_WALL_COPY.pdf,
				wallId: wall.id,
			},
		});
		expect(pdf.status).toBe("committed");
		if (pdf.status !== "committed") {
			return;
		}
		expect(pdf.snapshot.pages).toHaveLength(2);
		expect(new TextDecoder().decode(pdf.snapshot.bytes.subarray(0, 5))).toBe(
			"%PDF-"
		);
		const beforeMove = await getProjectWall(prisma, wall.id);
		expect(beforeMove?.revision).toBe(placedSecond.wall.revision);
		const moved = await updateCardLayout(prisma, {
			actorId,
			idempotencyKey: "move-after-snap",
			origin: "human",
			payload: {
				cardId: firstCard,
				positionX: 88,
				positionY: 44,
				wallId: wall.id,
			},
		});
		expect(moved.status).toBe("committed");
		const statusWrite = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: first.revision,
			idempotencyKey: "live-after-snap",
			origin: "human",
			status: WORK_STATUS.inProgress,
			workId: first.id,
		});
		expect(statusWrite.status).toBe("committed");
		const live = await getProjectWall(prisma, wall.id);
		expect(
			live?.cards.find((card) => card.id === firstCard)?.fields.Status
		).toBe(WORK_STATUS.inProgress);
		expect(png.snapshot.titles).toEqual(["Checkout flow", "Refund path"]);
		expect(live?.cards.find((card) => card.id === firstCard)?.positionX).toBe(
			88
		);
	});

	it("shows a Technical Diagram card as a read-only live preview", async () => {
		const { actorId, projectId } = await openProject(prisma);
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		const diagram = await prisma.design.create({
			data: {
				id: crypto.randomUUID(),
				name: "Checkout schema",
				projectId,
				revision: 1,
				type: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
			},
		});
		const livePlaced = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-diagram",
			origin: "human",
			payload: {
				sourceId: diagram.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
				wallId: wall.id,
			},
		});
		expect(livePlaced.status).toBe("committed");
		if (livePlaced.status !== "committed") {
			return;
		}
		const [liveCard] = livePlaced.wall.cards;
		expect(liveCard?.sourceId).toBe(diagram.id);
		expect(liveCard?.sourceKind).toBe(
			PROJECT_WALL_SOURCE_KIND.technicalDiagram
		);
		expect(liveCard?.nodeEditing).toBe(false);
		expect(liveCard?.authority).toBe(PROJECT_WALL_COPY.live);
		expect(liveCard?.fields.Title).toBe("Checkout schema");
		const edited = await updateDiagramNode(prisma, {
			actorId,
			idempotencyKey: "edit-node",
			origin: "human",
			payload: {
				cardId: liveCard?.id ?? "",
				nodeId: "entity-1",
				wallId: wall.id,
			},
		});
		expect(edited).toEqual({
			reason: PROJECT_WALL_REJECTION.diagramReadOnly,
			status: "rejected",
		});
		const historical = await prisma.design.create({
			data: {
				id: crypto.randomUUID(),
				name: "Checkout schema v1",
				projectId,
				revision: 1,
				type: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
			},
		});
		const exactPlaced = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-exact",
			origin: "human",
			payload: {
				authority: PROJECT_WALL_COPY.exact,
				pinVersionId: "diagram-v1",
				sourceId: historical.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
				wallId: wall.id,
			},
		});
		expect(exactPlaced.status).toBe("committed");
		if (exactPlaced.status !== "committed") {
			return;
		}
		const exactCard = exactPlaced.wall.cards.find(
			(card) => card.sourceId === historical.id
		);
		expect(exactCard?.authority).toBe(PROJECT_WALL_COPY.exact);
		expect(exactCard?.nodeEditing).toBe(false);
	});

	it("adds a Smart Collection summary that reuses the source query", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		const matching = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout flow",
		});
		await committedWork(prisma, {
			actorId,
			projectId,
			title: "Idle task",
		});
		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: matching.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: WORK_STATUS.inProgress,
			workId: matching.id,
		});
		expect(progressed.status).toBe("committed");
		const collection = await createSmartCollection(prisma, {
			conditions: [
				{ field: "status", operator: "equals", value: WORK_STATUS.inProgress },
			],
			name: "Active Work",
			projectId,
			sourceKind: RECORD_DISCOVERY_COPY.work,
			workspaceId,
		});
		expect(collection.status).toBe("ok");
		if (collection.status !== "ok") {
			return;
		}
		const wall = await committedWall(prisma, {
			actorId,
			name: "Launch narrative",
			projectId,
		});
		await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-work-card",
			origin: "human",
			payload: {
				sourceId: matching.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: wall.id,
			},
		});
		const placed = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-collection",
			origin: "human",
			payload: {
				sourceId: collection.collection.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.smartCollection,
				wallId: wall.id,
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			return;
		}
		const block = placed.wall.cards.find(
			(card) => card.sourceKind === PROJECT_WALL_SOURCE_KIND.smartCollection
		);
		expect(block?.ownQuery).toBe(false);
		expect(block?.openAllInSource).toBe(PROJECT_WALL_COPY.openAllInSource);
		expect(block?.members.map((member) => member.id)).toEqual([matching.id]);
		expect(block?.members[0]?.sharedSource).toBe(
			PROJECT_WALL_COPY.sharedSource
		);
		expect(await prisma.smartCollection.count()).toBe(1);
		const sourceView = await viewSmartCollection(
			prisma,
			workspaceId,
			collection.collection.id
		);
		expect(sourceView?.membership.members.map((member) => member.id)).toEqual([
			matching.id,
		]);
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
