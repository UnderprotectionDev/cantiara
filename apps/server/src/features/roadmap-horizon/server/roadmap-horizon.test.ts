/**
 * Roadmap Horizon seam — optional Now / Next / Later placement and
 * named-view filters tell the same Work story without writing
 * workflow status, priority-criterion values, or Backlog order;
 * horizon is not start, Target date, or a release commitment;
 * inner scope is derived (no Show on Roadmap membership). Default
 * Product direction shows Research as primary and origin-linked
 * Feature as secondary, without an Initiative record. Kilometre Taşı
 * is an intermediate outcome: Reach / Abandon does not close Work,
 * Closed Work does not auto-reach, and the record is not Focus Period,
 * Project Release, sprint, project stage, or Hedefe katkı. Compact
 * blocker badges open blocked Work and the exact Active source
 * without a standing network or critical path. Unplanned
 * candidates are a live collapsed filter; placing on the plan
 * previews the date or horizon write and requires confirm without
 * writing status. Presentation Mode is a mode on the current
 * named view, not a content copy. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Roadmap: horizon/filters do not write status, priority values,
 * or Backlog order; Milestone reach does not close Work; blocker
 * badge and unplanned candidates open sources; Presentation Mode
 * is not a second copy).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
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
	archiveWork,
	changeWorkStatus,
	closeWork,
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	applyNotNow,
	getNotNowTrail,
	listNotNowMarks,
	previewNotNow,
	previewReconsiderNotNow,
	reconsiderNotNow,
} from "./not-now-trail";
import {
	contributeToMilestone,
	createMilestone,
	getHorizonPlacement,
	getMilestone,
	listMilestones,
	listRoadmap,
	placeCandidate,
	placeHorizon,
	previewPlaceCandidate,
	saveRoadmapNamedView,
	setMilestoneStatus,
} from "./roadmap-horizon";
import {
	enterPresentationMode,
	exitPresentationMode,
	MILESTONE_COPY,
	MILESTONE_COUNTERPARTS,
	MILESTONE_STATUSES,
	MILESTONE_WRITES,
	NOT_NOW_WRITES,
	openBlockerBadge,
	ROADMAP_GROUP_FIELDS,
	ROADMAP_HORIZONS,
	ROADMAP_INNER_MEMBERSHIP,
	ROADMAP_PRESENTATIONS,
	ROADMAP_WRITES,
	roadmapCatalog,
} from "./roadmap-horizon-model";

const DATABASE_URL = localTestDatabaseUrl();

const FORBIDDEN_PATTERN =
	/Show on Roadmap|Initiative|Parked|Theme record|Kanban column|sprint/i;

const FORBIDDEN_MILESTONE_NOUNS =
	/sprint|Focus Period|Project Release|Hedefe katkı|Parked/i;

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
		expect(catalog.copy.notNow).toBe("Not now");
		expect(catalog.copy.reconsidering).toBe("Reconsidering");
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
		expect(catalog.copy.notNow).toBe("Not now");
		expect(catalog).not.toHaveProperty("showOnRoadmapMembership");
		expect(catalog).not.toHaveProperty("initiative");
		expect(catalog.milestone.copy).toEqual({
			abandon: "Abandon",
			abandoned: "Abandoned",
			contributesToMilestone: "Contributes to Milestone",
			create: "Create Milestone",
			description: "Description",
			empty: "No Milestone yet.",
			milestone: "Milestone",
			milestones: "Milestones",
			planned: "Planned",
			reach: "Reach",
			reached: "Reached",
			targetDate: "Target date",
			title: "Title",
		});
		expect(catalog.milestone.statuses).toEqual([
			"Planned",
			"Reached",
			"Abandoned",
		]);
		expect(catalog.milestone.counterparts).toEqual({
			focusPeriod: false,
			goalContribution: false,
			projectRelease: false,
			projectStage: false,
			sprint: false,
		});
		expect(catalog.milestone.writes).toEqual({
			autoReach: false,
			closeLinkedWork: false,
			focusPeriodWindow: false,
			goalContribution: false,
			releaseScope: false,
			workClosure: false,
			workStatus: false,
		});
		expect(JSON.stringify(catalog.milestone.copy)).not.toMatch(
			FORBIDDEN_MILESTONE_NOUNS
		);
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

	it("records Not now as a Work trail without writing status, horizon, or a Decision", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "defer",
			projectId: project.id,
			title: "Native wallet",
			type: "Feature",
		});
		await placeHorizon(prisma, { horizon: "Later", workId: work.id });
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "reach",
			origin: "human",
			payload: { name: "Reach", projectId: project.id },
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
				rank: "Low",
				workId: work.id,
			},
		});
		const sibling = await committedWork(prisma, actorId, {
			idempotencyKey: "sibling",
			projectId: project.id,
			title: "Sibling",
		});
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [sibling.id, work.id],
		});
		const dated = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: (await getWork(prisma, work.id))?.revision ?? 1,
			idempotencyKey: "dates",
			origin: "human",
			plannedStart: "2026-10-01",
			reappearDate: null,
			targetDate: "2026-11-01",
			workId: work.id,
		});
		if (dated.status !== "committed") {
			throw new Error("expected dates");
		}
		const orderBefore = (
			await listPreparedBacklog(prisma, project.id)
		).items.map((item) => item.id);
		const draft = {
			grounds: [{ id: "decision-1", kind: "Decision" as const }],
			linkedReviewLaterIds: ["reminder-1"],
			reason: "Demand is still a hunch",
			reevaluationCondition: "three users asked",
			workId: work.id,
		};
		const preview = await previewNotNow(prisma, draft);
		if ("status" in preview) {
			throw new Error("expected preview");
		}
		expect(preview).toMatchObject({
			conditionWatched: false,
			reason: "Demand is still a hunch",
			reevaluationCondition: "three users asked",
			replacesActive: false,
			reviewLater: {
				effect: "Keep Review later",
				ids: ["reminder-1"],
				silentDelete: false,
			},
			writes: NOT_NOW_WRITES,
		});
		expect(preview.grounds).toEqual([{ id: "decision-1", kind: "Decision" }]);
		expect(
			await applyNotNow(prisma, {
				...draft,
				actorId,
			})
		).toEqual({ reason: "preview-required", status: "rejected" });
		expect(
			await applyNotNow(prisma, {
				...draft,
				actorId,
				previewAcknowledged: true,
			})
		).toMatchObject({
			status: "committed",
			trail: {
				active: {
					actorId,
					grounds: [{ id: "decision-1", kind: "Decision" }],
					reason: "Demand is still a hunch",
					reevaluationCondition: "three users asked",
					state: "active",
				},
				autoReactivate: false,
				conditionWatched: false,
				decisionRecord: false,
				parked: false,
				reviewLater: { ids: ["reminder-1"], silentDelete: false },
				work: {
					horizon: "Later",
					id: work.id,
					plannedStart: "2026-10-01",
					status: "Not Started",
					targetDate: "2026-11-01",
				},
				writes: NOT_NOW_WRITES,
			},
		});
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		expect((await getHorizonPlacement(prisma, work.id))?.horizon).toBe("Later");
		expect(
			await listWorkPriorityValues(prisma, project.id, work.id)
		).toMatchObject([{ rank: "Low" }]);
		expect(
			(await listPreparedBacklog(prisma, project.id)).items.map(
				(item) => item.id
			)
		).toEqual(orderBefore);
		expect(await listNotNowMarks(prisma, project.id)).toEqual([
			{ reason: "Demand is still a hunch", workId: work.id },
		]);
		const listed = await listRoadmap(prisma, {
			presentation: "All Work types",
			projectId: project.id,
		});
		expect(
			flatItems(listed).find((item) => item.id === work.id)?.notNow
		).toEqual({ reason: "Demand is still a hunch" });
		const trail = await getNotNowTrail(prisma, work.id);
		expect(trail?.parked).toBe(false);
		expect(trail?.decisionRecord).toBe(false);
		expect(trail?.active?.reason).toBe("Demand is still a hunch");
	});

	it("keeps Not now history on Reconsidering or replace and does not silently drop Review later", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "history",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		await applyNotNow(prisma, {
			actorId,
			grounds: [],
			linkedReviewLaterIds: ["reminder-1"],
			previewAcknowledged: true,
			reason: "Wait for research",
			workId: work.id,
		});
		const replaced = await applyNotNow(prisma, {
			actorId,
			grounds: [{ id: "risk-1", kind: "Risk" as const }],
			previewAcknowledged: true,
			reason: "Wait for pricing",
			reevaluationCondition: "pricing page exists",
			workId: work.id,
		});
		if (replaced.status !== "committed") {
			throw new Error("expected replace");
		}
		expect(replaced.trail.active?.reason).toBe("Wait for pricing");
		expect(replaced.trail.history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					closeAction: "Not now",
					reason: "Wait for research",
					state: "closed",
				}),
			])
		);
		expect(replaced.trail.reviewLater.ids).toEqual(["reminder-1"]);
		const reconsiderPreview = await previewReconsiderNotNow(prisma, {
			workId: work.id,
		});
		if ("status" in reconsiderPreview) {
			throw new Error("expected reconsider preview");
		}
		expect(reconsiderPreview.reviewLater).toEqual({
			effect: "Keep Review later",
			ids: ["reminder-1"],
			silentDelete: false,
		});
		const kept = await reconsiderNotNow(prisma, {
			actorId,
			previewAcknowledged: true,
			workId: work.id,
		});
		if (kept.status !== "committed") {
			throw new Error("expected reconsider");
		}
		expect(kept.trail.active).toBeNull();
		expect(kept.trail.history.map((entry) => entry.reason)).toEqual([
			"Wait for research",
			"Wait for pricing",
		]);
		expect(kept.trail.history.at(-1)?.closeAction).toBe("Reconsidering");
		expect(kept.trail.reviewLater.ids).toEqual(["reminder-1"]);
		await applyNotNow(prisma, {
			actorId,
			grounds: [],
			previewAcknowledged: true,
			reason: "Pause again",
			workId: work.id,
		});
		const removed = await reconsiderNotNow(prisma, {
			actorId,
			previewAcknowledged: true,
			reviewLaterEffect: "Remove Review later",
			workId: work.id,
		});
		if (removed.status !== "committed") {
			throw new Error("expected remove");
		}
		expect(removed.trail.reviewLater.ids).toEqual([]);
		expect(removed.trail.reviewLater.silentDelete).toBe(false);
	});

	it("does not close Not now when Work is closed, archived, or moved, and does not watch the condition", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "survive",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		await applyNotNow(prisma, {
			actorId,
			grounds: [],
			previewAcknowledged: true,
			reason: "Not this quarter",
			reevaluationCondition: "three users asked",
			workId: work.id,
		});
		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: (await getWork(prisma, work.id))?.revision ?? 1,
			idempotencyKey: "progress",
			origin: "human",
			status: "In Progress",
			workId: work.id,
		});
		if (progressed.status !== "committed") {
			throw new Error("expected status");
		}
		expect((await getNotNowTrail(prisma, work.id))?.active?.reason).toBe(
			"Not this quarter"
		);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: progressed.work.revision,
			idempotencyKey: "close",
			origin: "human",
			reason: "Shipped elsewhere",
			result: "Completed",
			workId: work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected close");
		}
		const afterClose = await getNotNowTrail(prisma, work.id);
		expect(afterClose?.active?.state).toBe("active");
		expect(afterClose?.work.status).toBe("Closed");
		expect(afterClose?.autoReactivate).toBe(false);
		expect(afterClose?.conditionWatched).toBe(false);
		expect(
			await applyNotNow(prisma, {
				actorId,
				grounds: [],
				previewAcknowledged: true,
				reason: "Still not now",
				workId: work.id,
			})
		).toEqual({ reason: "work-not-open", status: "rejected" });
		const archived = await archiveWork(prisma, {
			actorId,
			baseRevision: closed.work.revision,
			idempotencyKey: "archive",
			origin: "human",
			workId: work.id,
		});
		if (archived.status !== "committed") {
			throw new Error("expected archive");
		}
		expect((await getNotNowTrail(prisma, work.id))?.active?.reason).toBe(
			"Not this quarter"
		);
		expect((await getWork(prisma, work.id))?.status).toBe("Closed");
	});

	it("creates a Milestone that stays Planned until an explicit Reach or Abandon", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createMilestone(prisma, {
			actorId,
			description: "Private beta with paying users",
			idempotencyKey: "ms-beta",
			projectId: project.id,
			targetDate: "2026-10-01",
			title: "Private beta",
		});
		expect(created).toMatchObject({
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Milestone");
		}
		expect(created.milestone).toMatchObject({
			copy: {
				abandoned: MILESTONE_COPY.abandoned,
				milestone: MILESTONE_COPY.milestone,
				planned: MILESTONE_COPY.planned,
				reached: MILESTONE_COPY.reached,
			},
			counterparts: MILESTONE_COUNTERPARTS,
			description: "Private beta with paying users",
			focusPeriodWindow: false,
			goalContribution: false,
			releaseScope: false,
			status: MILESTONE_COPY.planned,
			targetDate: "2026-10-01",
			title: "Private beta",
			writes: MILESTONE_WRITES,
		});
		expect(created.milestone.history).toEqual([
			{ previousStatus: null, status: MILESTONE_COPY.planned },
		]);
		expect(MILESTONE_STATUSES).toEqual(["Planned", "Reached", "Abandoned"]);
		const listed = await listMilestones(prisma, { projectId: project.id });
		expect(listed.map((row) => row.title)).toEqual(["Private beta"]);
	});

	it("reaches a Milestone without closing contributing Work", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "beta-work",
			projectId: project.id,
			title: "Checkout",
		});
		const created = await createMilestone(prisma, {
			actorId,
			idempotencyKey: "ms-reach",
			projectId: project.id,
			title: "Private beta",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Milestone");
		}
		const linked = await contributeToMilestone(prisma, {
			actorId,
			idempotencyKey: "link-beta",
			milestoneId: created.milestone.id,
			workId: work.id,
		});
		expect(linked).toMatchObject({ status: "committed" });
		if (linked.status !== "committed") {
			throw new Error("expected committed contribution");
		}
		expect(linked.relation.type).toBe(RELATIONS_COPY.contributesToMilestone);
		expect(linked.relation.type).not.toBe(RELATIONS_COPY.contributesToGoal);
		expect(linked.milestone.goalContribution).toBe(false);
		expect(linked.milestone.focusPeriodWindow).toBe(false);
		expect(linked.milestone.releaseScope).toBe(false);
		const statusBefore = (await getWork(prisma, work.id))?.status;
		expect(statusBefore).toBe("Not Started");
		const reached = await setMilestoneStatus(prisma, {
			actorId,
			idempotencyKey: "reach-beta",
			milestoneId: created.milestone.id,
			status: MILESTONE_COPY.reached,
		});
		expect(reached).toMatchObject({
			status: "committed",
		});
		if (reached.status !== "committed") {
			throw new Error("expected reached Milestone");
		}
		expect(reached.milestone.status).toBe("Reached");
		expect(reached.milestone.writes.closeLinkedWork).toBe(false);
		expect(reached.work).toEqual([
			{
				id: work.id,
				key: work.key,
				status: "Not Started",
				title: "Checkout",
			},
		]);
		expect((await getWork(prisma, work.id))?.status).toBe(statusBefore);
		expect((await getWork(prisma, work.id))?.closureResult).toBeNull();
		const after = await getMilestone(prisma, created.milestone.id, workspaceId);
		expect(after?.status).toBe("Reached");
		expect(after?.history).toEqual([
			{ previousStatus: null, status: "Planned" },
			{ previousStatus: "Planned", status: "Reached" },
		]);
	});

	it("does not auto-reach when every contributing Work is Closed", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "closed-one",
			projectId: project.id,
			title: "One",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "closed-two",
			projectId: project.id,
			title: "Two",
		});
		const created = await createMilestone(prisma, {
			actorId,
			idempotencyKey: "ms-closed",
			projectId: project.id,
			title: "Launch",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Milestone");
		}
		await contributeToMilestone(prisma, {
			actorId,
			idempotencyKey: "link-one",
			milestoneId: created.milestone.id,
			workId: first.id,
		});
		await contributeToMilestone(prisma, {
			actorId,
			idempotencyKey: "link-two",
			milestoneId: created.milestone.id,
			workId: second.id,
		});
		const closedFirst = await closeWork(prisma, {
			actorId,
			baseRevision: first.revision,
			idempotencyKey: "close-one",
			origin: "human",
			result: "Completed",
			workId: first.id,
		});
		const closedSecond = await closeWork(prisma, {
			actorId,
			baseRevision: second.revision,
			idempotencyKey: "close-two",
			origin: "human",
			result: "Completed",
			workId: second.id,
		});
		expect(closedFirst).toMatchObject({
			status: "committed",
			work: { status: "Closed" },
		});
		expect(closedSecond).toMatchObject({
			status: "committed",
			work: { status: "Closed" },
		});
		const listed = await listMilestones(prisma, { projectId: project.id });
		expect(listed).toHaveLength(1);
		expect(listed[0]?.status).toBe("Planned");
		expect(listed[0]?.writes.autoReach).toBe(false);
		expect(listed[0]?.contributingWork.map((row) => row.status)).toEqual([
			"Closed",
			"Closed",
		]);
		const abandoned = await setMilestoneStatus(prisma, {
			actorId,
			idempotencyKey: "abandon-launch",
			milestoneId: created.milestone.id,
			status: MILESTONE_COPY.abandoned,
		});
		if (abandoned.status !== "committed") {
			throw new Error("expected abandoned Milestone");
		}
		expect(abandoned.milestone.status).toBe("Abandoned");
		expect(abandoned.work.map((row) => row.status)).toEqual([
			"Closed",
			"Closed",
		]);
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
