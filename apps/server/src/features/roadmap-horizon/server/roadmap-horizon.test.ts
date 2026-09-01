/**
 * Roadmap Horizon seam — optional Now / Next / Later placement and
 * named-view filters tell the same Work story without writing
 * workflow status, priority-criterion values, or Backlog order;
 * horizon is not start, Target date, or a release commitment;
 * inner scope is derived (no Show on Roadmap membership). Default
 * Product direction shows Research as primary and origin-linked
 * Feature as secondary, without an Initiative record. Synthetic
 * fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Roadmap: horizon/filters do not write status, priority values,
 * or Backlog order).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	listPreparedBacklog,
	reorderManualOrder,
} from "../../backlog/server/backlog";
import {
	createPriorityCriterion,
	listWorkPriorityValues,
	setPriorityCriterionValue,
} from "../../priority/server/priority";
import { createProject } from "../../project-shell/server/project-shell";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	getHorizonPlacement,
	listRoadmap,
	placeHorizon,
	saveRoadmapNamedView,
} from "./roadmap-horizon";
import {
	ROADMAP_COPY,
	ROADMAP_GROUP_FIELDS,
	ROADMAP_HORIZONS,
	ROADMAP_INNER_MEMBERSHIP,
	ROADMAP_PRESENTATIONS,
	ROADMAP_WRITES,
	roadmapCatalog,
} from "./roadmap-horizon-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"; // pragma: allowlist secret

const FORBIDDEN_PATTERN =
	/Show on Roadmap|Initiative|Parked|Theme record|Kanban column|sprint/i;
const THEME_INITIATIVE_KEY_PATTERN = /theme|initiative|showOnRoadmap/i;

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

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: "create-payments",
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Solo SaaS",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	input: {
		idempotencyKey: string;
		projectId: string;
		title: string;
		type?: string;
	}
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
			type: input.type,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Work");
	}
	return created.work;
}

function workRef(id: string) {
	return { id, kind: "Work" as const };
}

function flatItems(view: Awaited<ReturnType<typeof listRoadmap>>) {
	if ("reason" in view) {
		throw new Error("expected Roadmap view");
	}
	return view.groups.flatMap((group) => group.items);
}

describe("Roadmap Horizon", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("uses English Roadmap, Now, Next, Later without a second membership flag", () => {
		const catalog = roadmapCatalog();
		expect(catalog.copy.roadmap).toBe("Roadmap");
		expect(catalog.horizons).toEqual(["Now", "Next", "Later"]);
		expect(catalog.presentations).toEqual([
			"Product direction",
			"All Work types",
		]);
		expect(catalog.innerMembership).toBe("derived");
		expect(catalog.writes).toEqual({
			backlogOrder: false,
			initiative: false,
			kanban: false,
			priorityCriterionValue: false,
			releaseCommitment: false,
			showOnRoadmap: false,
			startWork: false,
			status: false,
			targetDate: false,
			themeRecord: false,
		});
		expect(ROADMAP_HORIZONS).toEqual(["Now", "Next", "Later"]);
		expect(ROADMAP_PRESENTATIONS).toEqual([
			"Product direction",
			"All Work types",
		]);
		expect(ROADMAP_GROUP_FIELDS).toEqual(["Horizon", "Type"]);
		expect(ROADMAP_INNER_MEMBERSHIP).toBe("derived");
		expect(ROADMAP_WRITES.showOnRoadmap).toBe(false);
		expect(JSON.stringify(catalog.copy)).not.toMatch(FORBIDDEN_PATTERN);
		expect(JSON.stringify(ROADMAP_COPY)).not.toMatch(FORBIDDEN_PATTERN);
		expect(catalog).not.toHaveProperty("showOnRoadmapMembership");
		expect(catalog).not.toHaveProperty("initiative");
	});

	it("places a horizon without writing status, priority value, Backlog order, or Target date", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "intake",
			projectId: project.id,
			title: "Checkout receipt",
		});
		const dated = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "target",
			origin: "human",
			reappearDate: null,
			targetDate: "2026-10-01",
			workId: work.id,
		});
		if (dated.status !== "committed") {
			throw new Error("expected Target date");
		}
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "urgency",
			origin: "human",
			payload: { name: "Urgency", projectId: project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected criterion");
		}
		await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "rank",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: work.id,
			},
		});
		const sibling = await committedWork(prisma, actorId, {
			idempotencyKey: "payout",
			projectId: project.id,
			title: "Payout",
		});
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [sibling.id, work.id],
		});
		const orderBefore = (
			await listPreparedBacklog(prisma, project.id)
		).items.map((item) => item.id);
		const placed = await placeHorizon(prisma, {
			horizon: "Now",
			workId: work.id,
		});
		expect(placed).toMatchObject({
			placement: { horizon: "Now", workId: work.id },
			status: "committed",
			work: {
				horizon: "Now",
				id: work.id,
				status: "Not Started",
				targetDate: "2026-10-01",
			},
			writes: ROADMAP_WRITES,
		});
		expect(await getWork(prisma, work.id)).toMatchObject({
			status: "Not Started",
			targetDate: "2026-10-01",
		});
		expect(
			await listWorkPriorityValues(prisma, project.id, work.id)
		).toMatchObject([{ rank: "High" }]);
		expect(
			(await listPreparedBacklog(prisma, project.id)).items.map(
				(item) => item.id
			)
		).toEqual(orderBefore);
		expect(await getHorizonPlacement(prisma, work.id)).toMatchObject({
			horizon: "Now",
			workId: work.id,
			writes: ROADMAP_WRITES,
		});
	});

	it("does not start Work, mint a Target date, or treat Now as a Kanban or release commitment", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "research-now",
			projectId: project.id,
			title: "Receipt problem",
			type: "Research",
		});
		expect(work.status).toBe("Not Started");
		expect(work.targetDate).toBeNull();
		const placed = await placeHorizon(prisma, {
			horizon: "Now",
			workId: work.id,
		});
		expect(placed).toMatchObject({
			status: "committed",
			work: { status: "Not Started", targetDate: null },
			writes: {
				kanban: false,
				releaseCommitment: false,
				startWork: false,
				status: false,
				targetDate: false,
			},
		});
		const view = await listRoadmap(prisma, { projectId: project.id });
		expect(view).toMatchObject({
			copy: {
				later: "Later",
				next: "Next",
				now: "Now",
				roadmap: "Roadmap",
			},
			innerMembership: "derived",
			showOnRoadmap: false,
			writes: ROADMAP_WRITES,
		});
		if ("reason" in view) {
			throw new Error("expected Roadmap view");
		}
		expect(JSON.stringify(view.copy)).not.toMatch(FORBIDDEN_PATTERN);
		expect(
			view.groups.flatMap((group) => group.items.map((item) => item.type))
		).not.toContain("Initiative");
	});

	it("keeps inner scope derived and grouping as named-view metadata, not a Theme or status record", async () => {
		const { actorId, project } = await openPayments(prisma);
		const research = await committedWork(prisma, actorId, {
			idempotencyKey: "problem",
			projectId: project.id,
			title: "Chargeback problem",
			type: "Research",
		});
		await placeHorizon(prisma, { horizon: "Next", workId: research.id });
		const saved = await saveRoadmapNamedView(prisma, {
			groupField: "Horizon",
			horizonFilter: "Next",
			name: "Next only",
			presentation: "Product direction",
			projectId: project.id,
		});
		expect(saved).toMatchObject({
			status: "committed",
			view: {
				groupField: "Horizon",
				horizonFilter: "Next",
				name: "Next only",
				presentation: "Product direction",
			},
		});
		if (saved.status !== "committed") {
			throw new Error("expected named view");
		}
		const filtered = await listRoadmap(prisma, {
			namedViewId: saved.view.id,
			projectId: project.id,
		});
		if ("reason" in filtered) {
			throw new Error("expected Roadmap view");
		}
		expect(filtered.showOnRoadmap).toBe(false);
		expect(filtered.namedView).toMatchObject({
			groupField: "Horizon",
			horizonFilter: "Next",
		});
		expect(filtered.groups.map((group) => group.label)).toEqual([
			"Now",
			"Next",
			"Later",
		]);
		expect(filtered.groups[1]?.items.map((item) => item.id)).toEqual([
			research.id,
		]);
		expect(await getWork(prisma, research.id)).toMatchObject({
			status: "Not Started",
		});
		expect(await prisma.projectRoadmapNamedView.count()).toBe(1);
		expect(
			Object.keys(prisma).filter((key) =>
				THEME_INITIATIVE_KEY_PATTERN.test(key)
			)
		).toEqual([]);
	});

	it("shows Research as primary and origin-linked Feature as secondary without an Initiative record", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const research = await committedWork(prisma, actorId, {
			idempotencyKey: "problem-opportunity",
			projectId: project.id,
			title: "Guests drop at checkout",
			type: "Research",
		});
		const feature = await committedWork(prisma, actorId, {
			idempotencyKey: "wallet-feature",
			projectId: project.id,
			title: "Guest wallet",
			type: "Feature",
		});
		const strayTask = await committedWork(prisma, actorId, {
			idempotencyKey: "ops-task",
			projectId: project.id,
			title: "Rotate keys",
			type: "Task",
		});
		const origin = await createRelation(prisma, {
			actorId,
			from: workRef(research.id),
			idempotencyKey: "origin-link",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(feature.id),
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspaceId,
		});
		expect(origin.status).toBe("committed");
		const view = await listRoadmap(prisma, { projectId: project.id });
		const items = flatItems(view);
		expect(items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: research.id,
					openSourceRecord: "Open source record",
					problemOpportunity: "Guests drop at checkout",
					role: "Primary",
					type: "Research",
				}),
				expect.objectContaining({
					id: feature.id,
					originWorkId: research.id,
					role: "Secondary",
					type: "Feature",
				}),
			])
		);
		expect(items.map((item) => item.id)).not.toContain(strayTask.id);
		expect(items.map((item) => item.type)).not.toContain("Initiative");
		const allTypes = await listRoadmap(prisma, {
			presentation: "All Work types",
			projectId: project.id,
		});
		const allItems = flatItems(allTypes);
		expect(allItems.map((item) => item.id).sort()).toEqual(
			[research.id, feature.id, strayTask.id].sort()
		);
		expect(allItems.find((item) => item.id === strayTask.id)).toMatchObject({
			role: "Primary",
			type: "Task",
		});
		if ("reason" in allTypes) {
			throw new Error("expected Roadmap view");
		}
		expect(allTypes.presentation).toBe("All Work types");
		expect(allItems.map((item) => item.type)).not.toContain("Initiative");
	});

	it("does not write counterparts when a named-view filter is applied", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "later-work",
			projectId: project.id,
			title: "Receipt archive",
			type: "Research",
		});
		await placeHorizon(prisma, { horizon: "Later", workId: work.id });
		const statusBefore = (await getWork(prisma, work.id))?.status;
		const listed = await listRoadmap(prisma, {
			horizonFilter: "Later",
			projectId: project.id,
		});
		if ("reason" in listed) {
			throw new Error("expected Roadmap view");
		}
		expect(flatItems(listed).map((item) => item.id)).toEqual([work.id]);
		expect((await getWork(prisma, work.id))?.status).toBe(statusBefore);
		expect(listed.writes.status).toBe(false);
		expect(listed.writes.priorityCriterionValue).toBe(false);
		expect(listed.writes.backlogOrder).toBe(false);
	});
});
