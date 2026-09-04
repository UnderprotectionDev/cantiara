/**
 * Project Goals seam — Project-scoped Project Goal record with title,
 * description, optional Intended outcome and later Observed outcome /
 * learning. No open/closed life, Key Result, structured target/actual,
 * auto rollup, or progress percent. Starter configurations do not seed
 * a Goal. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje: Blank Project is not blocked on a Goal).
 */

import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDecision } from "../../decisions/server/decisions";
import { createProject } from "../../project-shell/server/project-shell";
import { STARTER_CONFIGURATIONS } from "../../project-shell/server/project-shell-model";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createMilestone,
	getMilestone,
} from "../../roadmap-horizon/server/roadmap-horizon";
import { MILESTONE_COPY } from "../../roadmap-horizon/server/roadmap-horizon-model";
import {
	changeWorkStatus,
	createWork,
	getWork,
	permanentlyDeleteWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createProjectGoals } from "./project-goals";
import {
	PROJECT_GOAL_COPY,
	PROJECT_GOAL_COUNTERPARTS,
	PROJECT_GOAL_MEASUREMENT,
	projectGoalCatalog,
} from "./project-goals-model";

const DATABASE_URL = localTestDatabaseUrl();

const FORBIDDEN_SURFACE =
	/Key Result|OKR|progress percent|health score|Milestone|Project Release|Open\/Closed/i;
const FORBIDDEN_SUMMARY = /progress percent|health score|On Track|success/i;
const FORBIDDEN_DETAIL =
	/progress percent|health score|success|completion status/i;

describe("Project Goal catalog", () => {
	it("exposes English Project Goal fields and no Key Result or percent", () => {
		expect(projectGoalCatalog()).toEqual({
			copy: PROJECT_GOAL_COPY,
			counterparts: PROJECT_GOAL_COUNTERPARTS,
			kind: "project-goal",
			measurement: PROJECT_GOAL_MEASUREMENT,
			optional: true,
		});
		expect(PROJECT_GOAL_COPY.projectGoal).toBe("Project Goal");
		expect(PROJECT_GOAL_COPY.intendedOutcome).toBe("Intended outcome");
		expect(PROJECT_GOAL_COPY.observedOutcome).toBe(
			"Observed outcome / learning"
		);
		expect(PROJECT_GOAL_COPY.contributesToGoal).toBe("Contributes to Goal");
		expect(PROJECT_GOAL_COPY.inGoal).toBe("In Goal");
		expect(PROJECT_GOAL_COPY.unavailable).toBe("Project Goal is unavailable.");
		expect(PROJECT_GOAL_COUNTERPARTS).toEqual({
			keyResult: false,
			milestone: false,
			projectRelease: false,
		});
		expect(PROJECT_GOAL_MEASUREMENT).toEqual({
			autoActuals: false,
			autoRollup: false,
			health: false,
			openClosedLife: false,
			progressPercent: false,
			projectArea: false,
		});
		expect(JSON.stringify(projectGoalCatalog().copy)).not.toMatch(
			FORBIDDEN_SURFACE
		);
	});
});

describe("Project Goal", () => {
	let actorId: string;
	let prisma: PrismaClient;
	let pool: Pool;
	let workspaceId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		actorId = crypto.randomUUID();
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		const user = await prisma.user.create({
			data: {
				email: `${actorId}@example.com`,
				emailVerified: true,
				id: actorId,
				name: "Founder",
			},
		});
		const workspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Solo",
				ownerId: user.id,
			},
		});
		workspaceId = workspace.id;
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany({
			where: { actorId },
		});
		await prisma.typedRelation.deleteMany();
		await prisma.projectGoal.deleteMany({
			where: { project: { workspaceId } },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function surface() {
		return createProjectGoals({
			accountId: actorId,
			prisma,
			workspaceId,
		});
	}

	async function openProject(
		name: string,
		starterConfiguration: (typeof STARTER_CONFIGURATIONS)[number] = "Blank Project"
	) {
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `create-${name}-${actorId}`,
			origin: "human",
			payload: {
				name,
				starterConfiguration,
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		return created.project;
	}

	it("creates a Project-scoped Goal with title and description and no open/closed life", async () => {
		const project = await openProject("Atlas");
		const created = await surface().create({
			description: "Ship the first founder workspace.",
			idempotencyKey: crypto.randomUUID(),
			projectId: project.id,
			title: "Reach İlk Proje",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project Goal");
		}
		expect(created.goal).toMatchObject({
			copy: PROJECT_GOAL_COPY,
			description: "Ship the first founder workspace.",
			intendedOutcome: null,
			observedOutcome: null,
			projectId: project.id,
			title: "Reach İlk Proje",
		});
		expect(created.goal).not.toHaveProperty("status");
		expect(created.goal).not.toHaveProperty("progressPercent");
		expect(created.goal).not.toHaveProperty("keyResults");
		expect(created.goal).not.toHaveProperty("measurement");
		const listed = await surface().list(project.id);
		expect(listed).toEqual([created.goal]);
		const detail = await surface().get(created.goal.id);
		expect(detail).toMatchObject({
			...created.goal,
			contributions: [],
			liveSummary: {
				relatedOpen: [],
				statusMix: [],
			},
		});
		expect(detail).not.toHaveProperty("progressPercent");
		expect(JSON.stringify(detail)).not.toMatch(FORBIDDEN_DETAIL);
	});

	it("keeps Intended outcome and Observed outcome / learning as user-typed optional fields", async () => {
		const project = await openProject("Atlas");
		const created = await surface().create({
			description: "Keep evaluation with the founder.",
			idempotencyKey: crypto.randomUUID(),
			intendedOutcome: "A living Project Goal record.",
			projectId: project.id,
			title: "Record the aimed-for result",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project Goal");
		}
		expect(created.goal.intendedOutcome).toBe("A living Project Goal record.");
		expect(created.goal.observedOutcome).toBeNull();
		const updated = await surface().update({
			description: "Keep evaluation with the founder.",
			goalId: created.goal.id,
			idempotencyKey: crypto.randomUUID(),
			intendedOutcome: "A living Project Goal record.",
			observedOutcome: "Blank Project opened without a Goal.",
			title: "Record the aimed-for result",
		});
		if (updated.status !== "committed") {
			throw new Error("expected committed Project Goal update");
		}
		expect(updated.goal.observedOutcome).toBe(
			"Blank Project opened without a Goal."
		);
		expect(updated.goal).not.toHaveProperty("progressPercent");
		expect(updated.goal).not.toHaveProperty("health");
	});

	it("rejects a Goal without title or description", async () => {
		const project = await openProject("Atlas");
		const untitled = await surface().create({
			description: "Missing title.",
			idempotencyKey: crypto.randomUUID(),
			projectId: project.id,
			title: "   ",
		});
		expect(untitled).toEqual({
			reason: PROJECT_GOAL_COPY.titleRequired,
			status: "invalid",
		});
		const undescribed = await surface().create({
			description: "",
			idempotencyKey: crypto.randomUUID(),
			projectId: project.id,
			title: "Reach İlk Proje",
		});
		expect(undescribed).toEqual({
			reason: PROJECT_GOAL_COPY.descriptionRequired,
			status: "invalid",
		});
	});

	it("opens every starter configuration without seeding a Project Goal", async () => {
		const projects = await Promise.all(
			STARTER_CONFIGURATIONS.map((starterConfiguration) =>
				openProject(starterConfiguration, starterConfiguration)
			)
		);
		const lists = await Promise.all(
			projects.map((project) => surface().list(project.id))
		);
		expect(lists).toEqual([[], [], [], []]);
	});

	it("creates a Project Goal through SQL when bun --hot lacks the Project Goal delegate", async () => {
		const project = await openProject("Atlas");
		const stale = withoutProjectGoalDelegate(prisma);
		const created = await createProjectGoals({
			accountId: actorId,
			prisma: stale,
			workspaceId,
		}).create({
			description: "Ship the first founder workspace.",
			idempotencyKey: crypto.randomUUID(),
			intendedOutcome: "A living Project Goal record.",
			projectId: project.id,
			title: "Reach İlk Proje",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project Goal");
		}
		expect(created.goal.title).toBe("Reach İlk Proje");
		expect(created.goal.intendedOutcome).toBe("A living Project Goal record.");
		const listed = await createProjectGoals({
			accountId: actorId,
			prisma: stale,
			workspaceId,
		}).list(project.id);
		expect(listed).toEqual([created.goal]);
	});

	it("accepts Contributes to Goal from Research, Feature, Milestone, and Project Release", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const research = await committedWork(project.id, "Map founder jobs", {
			type: "Research",
		});
		const feature = await committedWork(project.id, "Overview Goals", {
			type: "Feature",
		});
		const milestone = await committedMilestone(project.id, "Private beta");
		const releaseId = crypto.randomUUID();
		const linkedResearch = await surface().contributeToGoal({
			from: { id: research.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		const linkedFeature = await surface().contributeToGoal({
			from: { id: feature.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		const linkedMilestone = await surface().contributeToGoal({
			from: { id: milestone.id, kind: "Milestone" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		const linkedRelease = await surface().contributeToGoal({
			from: { id: releaseId, kind: "Project Release" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		expect(linkedResearch.status).toBe("committed");
		expect(linkedFeature.status).toBe("committed");
		expect(linkedMilestone.status).toBe("committed");
		expect(linkedRelease.status).toBe("committed");
		const detail = await surface().get(goal.id);
		expect(detail?.contributions.map((row) => row.from.kind).sort()).toEqual([
			"Milestone",
			"Project Release",
			"Work",
			"Work",
		]);
		expect(
			detail?.contributions.every(
				(row) => row.type === RELATIONS_COPY.contributesToGoal
			)
		).toBe(true);
		expect(detail).not.toHaveProperty("progressPercent");
	});

	it("rejects Decision, evidence, Test, Experiment/Validation, and research session as Contributes to Goal", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				decision: "Goals stay light records.",
				projectId: project.id,
				rationale: "No Key Result.",
				title: "No Key Result",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected Decision");
		}
		const rejected = await Promise.all([
			surface().contributeToGoal({
				from: { id: decision.decision.id, kind: "Decision" },
				goalId: goal.id,
				idempotencyKey: crypto.randomUUID(),
			}),
			surface().contributeToGoal({
				from: { id: crypto.randomUUID(), kind: "Document" },
				goalId: goal.id,
				idempotencyKey: crypto.randomUUID(),
			}),
			surface().contributeToGoal({
				from: { id: crypto.randomUUID(), kind: "Test" },
				goalId: goal.id,
				idempotencyKey: crypto.randomUUID(),
			}),
			surface().contributeToGoal({
				from: { id: crypto.randomUUID(), kind: "Experiment/Validation" },
				goalId: goal.id,
				idempotencyKey: crypto.randomUUID(),
			}),
			surface().contributeToGoal({
				from: { id: crypto.randomUUID(), kind: "User Research Session" },
				goalId: goal.id,
				idempotencyKey: crypto.randomUUID(),
			}),
		]);
		expect(
			rejected.every(
				(row) => row.status === "rejected" && row.reason === "ends-not-allowed"
			)
		).toBe(true);
		expect((await surface().get(goal.id))?.contributions).toEqual([]);
	});

	it("does not count Related as Contributes to Goal", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const feature = await committedWork(project.id, "Overview Goals", {
			type: "Feature",
		});
		const related = await createRelation(prisma, {
			actorId,
			from: { id: feature.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: goal.id, kind: "Project Goal" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const riskId = crypto.randomUUID();
		const questionId = crypto.randomUUID();
		await prisma.typedRelation.create({
			data: {
				fromId: riskId,
				fromKind: "Risk",
				id: crypto.randomUUID(),
				revision: 1,
				toId: goal.id,
				toKind: "Project Goal",
				type: RELATIONS_COPY.related,
			},
		});
		await prisma.typedRelation.create({
			data: {
				fromId: questionId,
				fromKind: "Question",
				id: crypto.randomUUID(),
				revision: 1,
				toId: goal.id,
				toKind: "Project Goal",
				type: RELATIONS_COPY.related,
			},
		});
		const detail = await surface().get(goal.id);
		expect(detail?.contributions).toEqual([]);
		expect(detail?.liveSummary.statusMix).toEqual([]);
		expect(
			detail?.liveSummary.relatedOpen.map((row) => row.kind).sort()
		).toEqual(["Question", "Risk"]);
		expect(
			detail?.liveSummary.relatedOpen.every((row) => row.contributes === false)
		).toBe(true);
	});

	it("does not write Work status, planning, Milestone life, or Goal life when membership changes", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const research = await committedWork(project.id, "Map founder jobs", {
			type: "Research",
		});
		const milestone = await committedMilestone(project.id, "Private beta");
		await surface().contributeToGoal({
			from: { id: research.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		await surface().contributeToGoal({
			from: { id: milestone.id, kind: "Milestone" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		const work = await getWork(prisma, research.id);
		expect(work?.status).toBe("Not Started");
		expect(work?.plannedStart).toBeNull();
		expect(work?.targetDate).toBeNull();
		expect(
			(await prisma.work.findUnique({ where: { id: research.id } }))?.horizon
		).toBeNull();
		expect((await getMilestone(prisma, milestone.id))?.status).toBe(
			MILESTONE_COPY.planned
		);
		const detail = await surface().get(goal.id);
		expect(detail).not.toHaveProperty("status");
		expect(detail).not.toHaveProperty("progressPercent");
		expect(detail).not.toHaveProperty("health");
		const relationId = detail?.contributions[0]?.id;
		if (!relationId) {
			throw new Error("expected contribution");
		}
		await surface().removeContribution({
			idempotencyKey: crypto.randomUUID(),
			relationId,
		});
		expect((await getWork(prisma, research.id))?.status).toBe("Not Started");
		expect((await getMilestone(prisma, milestone.id))?.status).toBe(
			MILESTONE_COPY.planned
		);
	});

	it("summarizes contributing Research, Feature, and Milestone status without percent or health", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const research = await committedWork(project.id, "Map founder jobs", {
			type: "Research",
		});
		const feature = await committedWork(project.id, "Overview Goals", {
			type: "Feature",
		});
		const task = await committedWork(project.id, "Fix seed copy", {
			type: "Task",
		});
		const milestone = await committedMilestone(project.id, "Private beta");
		await changeWorkStatus(prisma, {
			actorId,
			baseRevision: feature.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			status: "In Progress",
			workId: feature.id,
		});
		await surface().contributeToGoal({
			from: { id: research.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		await surface().contributeToGoal({
			from: { id: feature.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		await surface().contributeToGoal({
			from: { id: task.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		await surface().contributeToGoal({
			from: { id: milestone.id, kind: "Milestone" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		const detail = await surface().get(goal.id);
		expect(detail?.liveSummary.statusMix).toEqual([
			{
				id: research.id,
				kind: "Work",
				openSourceRecord: true,
				status: "Not Started",
				title: "Map founder jobs",
				workType: "Research",
			},
			{
				id: feature.id,
				kind: "Work",
				openSourceRecord: true,
				status: "In Progress",
				title: "Overview Goals",
				workType: "Feature",
			},
			{
				id: milestone.id,
				kind: "Milestone",
				openSourceRecord: true,
				status: MILESTONE_COPY.planned,
				title: "Private beta",
			},
		]);
		expect(detail?.contributions).toHaveLength(4);
		expect(JSON.stringify(detail?.liveSummary)).not.toMatch(FORBIDDEN_SUMMARY);
		expect(detail?.liveSummary.copy.openSourceRecord).toBe(
			"Open source record"
		);
		expect(detail?.liveSummary.copy.contributesToGoal).toBe(
			"Contributes to Goal"
		);
	});

	it("keeps a historical Contributes to Goal bind after the member is deleted", async () => {
		const project = await openProject("Atlas");
		const goal = await committedGoal(project.id, "Reach İlk Proje");
		const research = await committedWork(project.id, "Map founder jobs", {
			type: "Research",
		});
		await surface().contributeToGoal({
			from: { id: research.id, kind: "Work" },
			goalId: goal.id,
			idempotencyKey: crypto.randomUUID(),
		});
		await permanentlyDeleteWork(prisma, research.id);
		const detail = await surface().get(goal.id);
		expect(detail?.contributions).toHaveLength(1);
		expect(detail?.contributions[0]).toMatchObject({
			from: {
				id: research.id,
				kind: "Work",
				status: "broken",
			},
			type: RELATIONS_COPY.contributesToGoal,
		});
		expect(detail?.contributions[0]?.from).not.toHaveProperty("title");
		expect(detail?.liveSummary.statusMix).toEqual([]);
	});

	async function committedGoal(projectId: string, title: string) {
		const created = await surface().create({
			description: "Ship the first founder workspace.",
			idempotencyKey: crypto.randomUUID(),
			projectId,
			title,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project Goal");
		}
		return created.goal;
	}

	async function committedWork(
		projectId: string,
		title: string,
		payload: { type: "Feature" | "Research" | "Task" }
	) {
		const created = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId, title, type: payload.type },
		});
		if (created.status !== "committed" && created.status !== "replayed") {
			throw new Error("expected committed Work");
		}
		return created.work;
	}

	async function committedMilestone(projectId: string, title: string) {
		const created = await createMilestone(prisma, {
			actorId,
			description: "Intermediate outcome",
			idempotencyKey: crypto.randomUUID(),
			projectId,
			title,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Milestone");
		}
		return created.milestone;
	}
});

function withoutProjectGoalDelegate(db: PrismaClient): PrismaClient {
	return new Proxy(db, {
		get(target, prop, receiver) {
			if (prop === "projectGoal") {
				return;
			}
			const value = Reflect.get(target, prop, receiver);
			if (prop === "$transaction" && typeof value === "function") {
				return (arg: unknown, options?: unknown) => {
					if (typeof arg === "function") {
						return value.call(
							target,
							(tx: PrismaClient) =>
								(arg as (client: PrismaClient) => unknown)(
									withoutProjectGoalDelegate(tx)
								),
							options
						);
					}
					return value.call(target, arg, options);
				};
			}
			return typeof value === "function"
				? (value as (...args: never[]) => unknown).bind(target)
				: value;
		},
	}) as PrismaClient;
}
