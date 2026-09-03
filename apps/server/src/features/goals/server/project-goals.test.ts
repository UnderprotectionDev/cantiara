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
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { STARTER_CONFIGURATIONS } from "../../project-shell/server/project-shell-model";
import { createProjectGoals } from "./project-goals";
import {
	PROJECT_GOAL_COPY,
	PROJECT_GOAL_COUNTERPARTS,
	PROJECT_GOAL_MEASUREMENT,
	projectGoalCatalog,
} from "./project-goals-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FORBIDDEN_SURFACE =
	/Key Result|OKR|progress percent|health score|Milestone|Project Release|Open\/Closed/i;

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
		expect(await surface().get(created.goal.id)).toEqual(created.goal);
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
});
