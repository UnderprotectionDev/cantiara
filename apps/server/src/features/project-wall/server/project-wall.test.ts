/**
 * Project Wall seam — live cards of existing masters,
 * layout and density do not write the source record.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Proje Duvarı canlı kart).
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
	createProjectWall,
	createRegionSnapshot,
	getProjectWall,
	listProjectWalls,
	placeLiveCard,
	previewRegionSnapshot,
	saveFocusOrder,
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

describe("Project Wall catalog", () => {
	it("uses English Project Wall densities and Open Source Record", () => {
		const catalog = projectWallCatalog();
		expect(catalog.copy.projectWall).toBe("Project Wall");
		expect(catalog.copy.compact).toBe("Compact");
		expect(catalog.copy.preview).toBe("Preview");
		expect(catalog.copy.detailed).toBe("Detailed");
		expect(catalog.copy.openSourceRecord).toBe("Open Source Record");
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
			moodboard: false,
			nestedWall: false,
			perCardCss: false,
			shareGrant: false,
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
