/**
 * Roadmap Horizon seam — optional Now / Next / Later placement and
 * named-view filters tell the same Work story without writing
 * workflow status, priority-criterion values, or Backlog order;
 * horizon is not start, Target date, or a release commitment;
 * inner scope is derived (no Show on Roadmap membership). Default
 * Product direction shows Research as primary and origin-linked
 * Feature as secondary, without an Initiative record. Compact
 * blocker badges open blocked Work and the exact Active source
 * without a standing network or critical path. Unplanned
 * candidates are a live collapsed filter; placing on the plan
 * previews the date or horizon write and requires confirm without
 * writing status. Presentation Mode is a mode on the current
 * named view, not a content copy. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Roadmap: horizon/filters do not write status, priority values,
 * or Backlog order; blocker badge and unplanned candidates open
 * sources; Presentation Mode is not a second copy).
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
	addActiveBlockingRelation,
	markBlockerResolved,
} from "../../blockers/server/blockers";
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
	placeCandidate,
	placeHorizon,
	previewPlaceCandidate,
	saveRoadmapNamedView,
} from "./roadmap-horizon";
import {
	enterPresentationMode,
	exitPresentationMode,
	openBlockerBadge,
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
	const grouped = view.groups.flatMap((group) => group.items);
	const seen = new Set(grouped.map((item) => item.id));
	return [
		...grouped,
		...view.unplannedCandidates.items.filter((item) => !seen.has(item.id)),
	];
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
		expect(catalog.copy.unplaced).toBe("No horizon");
		expect(catalog.horizons).toEqual(["Now", "Next", "Later"]);
		expect(catalog.presentations).toEqual([
			"Product direction",
			"All Work types",
		]);
		expect(catalog.innerMembership).toBe("derived");
		expect(catalog.writes).toEqual({
			autoReschedule: false,
			backlogOrder: false,
			contentCopy: false,
			criticalPath: false,
			ganttExport: false,
			initiative: false,
			kanban: false,
			parked: false,
			pngExport: false,
			presentationRecord: false,
			priorityCriterionValue: false,
			publicHtml: false,
			publicStatusLabel: false,
			releaseCommitment: false,
			secondMembership: false,
			showOnRoadmap: false,
			slides: false,
			standingNetwork: false,
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
			plannedStart: null,
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
		expect(view.groups.map((group) => group.label)).toEqual([
			"Now",
			"Next",
			"Later",
			"No horizon",
		]);
		expect(view.groups[0]?.field).toBe("Horizon");
		expect(view.groups[0]?.items.map((item) => item.id)).toEqual([work.id]);
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
			"No horizon",
		]);
		expect(filtered.groups[1]?.items.map((item) => item.id)).toEqual([
			research.id,
		]);
		expect(await getWork(prisma, research.id)).toMatchObject({
			status: "Not Started",
		});
		expect(filtered.namedView?.name).toBe("Next only");
	});

	it("shows Research as primary and origin-linked Feature as secondary without an Initiative record", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const research = await committedWork(prisma, actorId, {
			idempotencyKey: "problem-opportunity",
			projectId: project.id,
			title: "Checkout research",
			type: "Research",
		});
		await prisma.work.update({
			data: { description: "Guests drop at checkout" },
			where: { id: research.id },
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
					expectedOutcome: null,
					id: research.id,
					problemOpportunity: "Guests drop at checkout",
					role: "Primary",
					title: "Checkout research",
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
		expect(
			allItems.map((item) => item.id).sort((a, b) => a.localeCompare(b))
		).toEqual(
			[research.id, feature.id, strayTask.id].sort((a, b) => a.localeCompare(b))
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
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "filter-urgency",
			origin: "human",
			payload: { name: "Urgency", projectId: project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected criterion");
		}
		await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "filter-rank",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "Low",
				workId: work.id,
			},
		});
		const sibling = await committedWork(prisma, actorId, {
			idempotencyKey: "filter-sibling",
			projectId: project.id,
			title: "Sibling",
			type: "Research",
		});
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [sibling.id, work.id],
		});
		const orderBefore = (
			await listPreparedBacklog(prisma, project.id)
		).items.map((item) => item.id);
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
		expect(
			await listWorkPriorityValues(prisma, project.id, work.id)
		).toMatchObject([{ rank: "Low" }]);
		expect(
			(await listPreparedBacklog(prisma, project.id)).items.map(
				(item) => item.id
			)
		).toEqual(orderBefore);
	});

	it("opens the blocked Work and exact Active source from a compact badge without a standing network or critical path", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "blocker-source",
			projectId: project.id,
			title: "Auth API",
			type: "Research",
		});
		const blocked = await committedWork(prisma, actorId, {
			idempotencyKey: "blocked-research",
			projectId: project.id,
			title: "Checkout wait",
			type: "Research",
		});
		const added = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(added.status).toBe("committed");
		const beforeCount = await prisma.typedRelation.count({
			where: { type: "Blocks" },
		});
		const view = await listRoadmap(prisma, { projectId: project.id });
		const items = flatItems(view);
		const badge = items.find((item) => item.id === blocked.id)?.blockerBadge;
		expect(badge).toEqual({
			blockedWorkId: blocked.id,
			copy: { openSourceRecord: "Open source record" },
			sources: [{ id: source.id, kind: "Work" }],
		});
		expect(
			items.find((item) => item.id === source.id)?.blockerBadge
		).toBeNull();
		expect(openBlockerBadge(badge)).toEqual({
			blockedWorkId: blocked.id,
			copy: { openSourceRecord: "Open source record" },
			sources: [{ id: source.id, kind: "Work" }],
			writes: {
				autoReschedule: false,
				blockingRelation: false,
				criticalPath: false,
				standingNetwork: false,
			},
		});
		if (added.status !== "committed") {
			throw new Error("expected committed blocker");
		}
		const resolved = await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-checkout",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(resolved.status).toBe("committed");
		const afterResolve = await listRoadmap(prisma, { projectId: project.id });
		expect(
			flatItems(afterResolve).find((item) => item.id === blocked.id)
				?.blockerBadge
		).toBeNull();
		expect(
			await prisma.typedRelation.count({ where: { type: "Blocks" } })
		).toBe(beforeCount);
		if ("reason" in view) {
			throw new Error("expected Roadmap view");
		}
		expect(view.writes).toMatchObject({
			autoReschedule: false,
			criticalPath: false,
			standingNetwork: false,
		});
	});

	it("lists Unplanned candidates as a live collapsed filter and places with previewed confirm without writing status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const candidate = await committedWork(prisma, actorId, {
			idempotencyKey: "unplanned-research",
			projectId: project.id,
			title: "Receipt problem",
			type: "Research",
		});
		const dated = await committedWork(prisma, actorId, {
			idempotencyKey: "dated-research",
			projectId: project.id,
			title: "Dated receipt",
			type: "Research",
		});
		const datedWork = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: dated.revision,
			idempotencyKey: "set-target",
			origin: "human",
			plannedStart: null,
			reappearDate: null,
			targetDate: "2026-10-01",
			workId: dated.id,
		});
		if (datedWork.status !== "committed") {
			throw new Error("expected Target date");
		}
		const placedHorizon = await committedWork(prisma, actorId, {
			idempotencyKey: "now-research",
			projectId: project.id,
			title: "Now receipt",
			type: "Research",
		});
		await placeHorizon(prisma, { horizon: "Now", workId: placedHorizon.id });
		const view = await listRoadmap(prisma, { projectId: project.id });
		if ("reason" in view) {
			throw new Error("expected Roadmap view");
		}
		expect(view.unplannedCandidates).toMatchObject({
			collapsed: true,
			copy: { unplannedCandidates: "Unplanned candidates" },
			membership: "live-filter",
			parked: false,
		});
		expect(view.unplannedCandidates.items.map((item) => item.id)).toEqual([
			candidate.id,
		]);
		expect(
			view.groups.flatMap((group) => group.items.map((item) => item.id))
		).not.toContain(candidate.id);
		const preview = await previewPlaceCandidate(prisma, {
			change: { field: "Horizon", horizon: "Next" },
			workId: candidate.id,
		});
		expect(preview).toMatchObject({
			confirmRequired: true,
			preview: { field: "Horizon", from: null, to: "Next" },
			status: "ready",
			workId: candidate.id,
			writes: {
				parked: false,
				secondMembership: false,
				status: false,
			},
		});
		expect(
			await placeCandidate(prisma, {
				change: { field: "Horizon", horizon: "Next" },
				confirmed: false,
				workId: candidate.id,
			})
		).toMatchObject({ reason: "confirm-required", status: "rejected" });
		const placed = await placeCandidate(prisma, {
			change: { field: "Horizon", horizon: "Next" },
			confirmed: true,
			workId: candidate.id,
		});
		expect(placed).toMatchObject({
			status: "committed",
			work: { horizon: "Next", id: candidate.id, status: "Not Started" },
			writes: {
				parked: false,
				secondMembership: false,
				status: false,
			},
		});
		expect(await getWork(prisma, candidate.id)).toMatchObject({
			status: "Not Started",
		});
		const afterPlace = await listRoadmap(prisma, { projectId: project.id });
		if ("reason" in afterPlace) {
			throw new Error("expected Roadmap view");
		}
		expect(afterPlace.unplannedCandidates.items.map((item) => item.id)).toEqual(
			[]
		);
		const dateCandidate = await committedWork(prisma, actorId, {
			idempotencyKey: "date-candidate",
			projectId: project.id,
			title: "Date candidate",
			type: "Research",
		});
		const datePreview = await previewPlaceCandidate(prisma, {
			change: { field: "Target date", targetDate: "2026-11-02" },
			workId: dateCandidate.id,
		});
		expect(datePreview).toMatchObject({
			confirmRequired: true,
			preview: { field: "Target date", from: null, to: "2026-11-02" },
			status: "ready",
		});
		const datedPlace = await placeCandidate(prisma, {
			actorId,
			baseRevision: dateCandidate.revision,
			change: { field: "Target date", targetDate: "2026-11-02" },
			confirmed: true,
			idempotencyKey: "place-target",
			workId: dateCandidate.id,
		});
		expect(datedPlace).toMatchObject({
			status: "committed",
			work: {
				id: dateCandidate.id,
				status: "Not Started",
				targetDate: "2026-11-02",
			},
			writes: { status: false },
		});
		expect(await getWork(prisma, dateCandidate.id)).toMatchObject({
			status: "Not Started",
			targetDate: "2026-11-02",
		});
	});

	it("enters Presentation Mode on the current named view without a content copy and restores position on exit", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "present-research",
			projectId: project.id,
			title: "Present receipt",
			type: "Research",
		});
		const saved = await saveRoadmapNamedView(prisma, {
			groupField: "Horizon",
			horizonFilter: null,
			name: "Direction",
			presentation: "Product direction",
			projectId: project.id,
		});
		if (saved.status !== "committed") {
			throw new Error("expected named view");
		}
		const entered = enterPresentationMode({
			namedViewId: saved.view.id,
			position: { selectedWorkId: work.id },
		});
		expect(entered).toMatchObject({
			configurationHidden: true,
			detailsReadOnly: true,
			editingHidden: true,
			mode: "Presentation Mode",
			namedViewId: saved.view.id,
			position: { selectedWorkId: work.id },
			writes: {
				contentCopy: false,
				ganttExport: false,
				pngExport: false,
				presentationRecord: false,
				publicHtml: false,
				publicStatusLabel: false,
				slides: false,
			},
		});
		const listed = await listRoadmap(prisma, {
			namedViewId: saved.view.id,
			presentationMode: true,
			projectId: project.id,
		});
		if ("reason" in listed) {
			throw new Error("expected Roadmap view");
		}
		expect(listed.presentationMode).toMatchObject({
			configurationHidden: true,
			detailsReadOnly: true,
			editingHidden: true,
			mode: "Presentation Mode",
			namedViewId: saved.view.id,
		});
		expect(listed.namedView?.name).toBe("Direction");
		expect(exitPresentationMode(entered)).toEqual({
			mode: null,
			namedViewId: saved.view.id,
			position: { selectedWorkId: work.id },
		});
		expect(roadmapCatalog().copy.presentationMode).toBe("Presentation Mode");
		expect(roadmapCatalog().copy.unplannedCandidates).toBe(
			"Unplanned candidates"
		);
	});
});
