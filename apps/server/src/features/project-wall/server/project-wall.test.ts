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
import { listRelations } from "../../relations/server/relations";
import {
	changeWorkStatus,
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";

import {
	createProjectWall,
	getProjectWall,
	listProjectWalls,
	materializeStarterSkeletonWalls,
	placeLiveCard,
	updateCardDensity,
	updateCardLayout,
} from "./project-wall";
import {
	CUSTOMER_JOURNEY_HEADINGS,
	DENSITY_FIELDS,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
	PROJECT_WALL_FIELD,
	PROJECT_WALL_REJECTION,
	PROJECT_WALL_SOURCE_KIND,
	projectWallCatalog,
	SITEMAP_HEADINGS,
} from "./project-wall-model";

const DATABASE_URL = localTestDatabaseUrl();
const SURFACE_COPY = /Wireframe|Moodboard|Wiki page|nested wall|CSS/i;
const SAMPLE_SKELETON_CONTENT =
	/Alex|Jordan|example finding|sample task|we decided|lorem|TODO: fill/i;

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
		expect(catalog.copy.sitemap).toBe("Sitemap");
		expect(catalog.copy.customerJourney).toBe("Customer Journey");
		expect(catalog.copy.compact).toBe("Compact");
		expect(catalog.copy.preview).toBe("Preview");
		expect(catalog.copy.detailed).toBe("Detailed");
		expect(catalog.copy.openSourceRecord).toBe("Open Source Record");
		expect(catalog.skeletons).toEqual([
			{
				emptyHeadings: [...SITEMAP_HEADINGS],
				name: PROJECT_WALL_COPY.sitemap,
			},
			{
				emptyHeadings: [...CUSTOMER_JOURNEY_HEADINGS],
				name: PROJECT_WALL_COPY.customerJourney,
			},
		]);
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
			moodboard: false,
			nestedWall: false,
			perCardCss: false,
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

describe("Project Wall starter skeletons", () => {
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

	it("does not create living skeleton walls when the project shell has no catalog selection", async () => {
		const { actorId, projectId, workspaceId } = await openProject(prisma);
		expect(await listProjectWalls(prisma, projectId)).toEqual([]);
		const materialized = await materializeStarterSkeletonWalls(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-walls:${projectId}`,
			origin: "human",
			payload: { projectId },
			workspaceId,
		});
		expect(materialized).toEqual({ status: "committed", walls: [] });
		expect(await listProjectWalls(prisma, projectId)).toEqual([]);
	});

	it("materializes Sitemap and Customer Journey as empty-heading Project Walls after catalog selection", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `saas-${crypto.randomUUID()}`,
			origin: "human",
			payload: {
				name: "Billing",
				starterConfiguration: "Solo SaaS",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		expect(created.project).not.toHaveProperty("walls");
		expect(await listProjectWalls(prisma, created.project.id)).toEqual([]);
		expect(
			await prisma.work.count({ where: { projectId: created.project.id } })
		).toBe(0);
		expect(
			await prisma.document.count({ where: { projectId: created.project.id } })
		).toBe(0);
		const materialized = await materializeStarterSkeletonWalls(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-walls:${created.project.id}`,
			origin: "human",
			payload: { projectId: created.project.id },
			workspaceId,
		});
		expect(materialized.status).toBe("committed");
		if (materialized.status !== "committed") {
			throw new Error("expected committed skeletons");
		}
		expect(
			materialized.walls.map((wall) => ({
				groups: wall.groups.map((group) => group.name),
				name: wall.name,
				type: wall.type,
			}))
		).toEqual([
			{
				groups: [...SITEMAP_HEADINGS],
				name: PROJECT_WALL_COPY.sitemap,
				type: PROJECT_WALL_COPY.projectWall,
			},
			{
				groups: [...CUSTOMER_JOURNEY_HEADINGS],
				name: PROJECT_WALL_COPY.customerJourney,
				type: PROJECT_WALL_COPY.projectWall,
			},
		]);
		for (const wall of materialized.walls) {
			expect(wall.cards).toEqual([]);
			expect(wall.recordKind).toBe(PROJECT_WALL_COPY.projectWall);
			expect(JSON.stringify(wall)).not.toMatch(SAMPLE_SKELETON_CONTENT);
			expect(wall.groups.every((group) => group.name.length > 0)).toBe(true);
		}
		expect(
			await Promise.all(
				materialized.walls.map((wall) => getProjectWall(prisma, wall.id))
			)
		).toEqual(materialized.walls);
		expect(
			(await listProjectWalls(prisma, created.project.id)).map(
				(wall) => wall.name
			)
		).toEqual([PROJECT_WALL_COPY.sitemap, PROJECT_WALL_COPY.customerJourney]);
		expect(
			await prisma.work.count({ where: { projectId: created.project.id } })
		).toBe(0);
		expect(
			await prisma.document.count({ where: { projectId: created.project.id } })
		).toBe(0);
		expect(
			materialized.walls.some((wall) =>
				["Persona", "Retrospective", "Launch Plan"].includes(wall.name)
			)
		).toBe(false);
		const work = await committedWork(prisma, {
			actorId,
			projectId: created.project.id,
			title: "Checkout flow",
		});
		const [sitemap] = materialized.walls;
		expect(sitemap).toBeTruthy();
		if (!sitemap) {
			return;
		}
		const placed = await placeLiveCard(prisma, {
			actorId,
			idempotencyKey: "place-on-sitemap",
			origin: "human",
			payload: {
				sourceId: work.id,
				sourceKind: PROJECT_WALL_SOURCE_KIND.work,
				wallId: sitemap.id,
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			return;
		}
		expect(placed.wall.name).toBe(PROJECT_WALL_COPY.sitemap);
		expect(placed.wall.groups.map((group) => group.name)).toEqual([
			...SITEMAP_HEADINGS,
		]);
		expect(placed.wall.cards[0]?.sourceId).toBe(work.id);
		const replayed = await materializeStarterSkeletonWalls(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-walls:${created.project.id}`,
			origin: "human",
			payload: { projectId: created.project.id },
			workspaceId,
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			throw new Error("expected replayed skeletons");
		}
		expect(replayed.walls.map((wall) => wall.id)).toEqual(
			materialized.walls.map((wall) => wall.id)
		);
	});
});
