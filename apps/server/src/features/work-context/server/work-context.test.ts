/**
 * Work Context Card seam — five prepared layouts × four Starter
 * Configurations, progressive `Add Context`, and no create or status
 * gate. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş bağlamı: type × starter matrix).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../../project-shell/server/project-shell";
import { STARTER_CONFIGURATIONS } from "../../project-shell/server/project-shell-model";
import {
	changeWorkStatus,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_TYPES } from "../../work-lifecycle/server/work-lifecycle-model";
import { presentWorkContextCard, revealPreparedSection } from "./work-context";
import { WORK_CONTEXT_COPY } from "./work-context-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const PREPARED_BY_TYPE = {
	Bug: [
		"Observed/Expected Behavior",
		"Affected Releases",
		"Evidence",
		"GitHub & Tests",
	],
	Feature: [
		"Problem/Opportunity",
		"Expected Outcome",
		"Evidence & Decisions",
		"Risks & Open Questions",
		"Included Work",
		"GitHub & Tests",
		"Target Release",
	],
	Improvement: [
		"Current Situation",
		"Expected Outcome",
		"Evidence",
		"GitHub & Tests",
	],
	Research: [
		"Research Question",
		"Sources & Evidence",
		"Decisions",
		"Related Work",
	],
	Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

const DASHBOARD_PATTERN = /dashboard|readiness score|wsjf|free query/i;

describe("Work Context Card", () => {
	it("uses the same prepared layout for each Work type in every Starter Configuration", () => {
		const cards = WORK_TYPES.flatMap((workType) =>
			STARTER_CONFIGURATIONS.map((starterConfiguration) => ({
				card: presentWorkContextCard({
					starterConfiguration,
					workType,
				}),
				starterConfiguration,
				workType,
			}))
		);
		expect(cards).toHaveLength(20);
		for (const { card, workType } of cards) {
			expect(card.preparedSections).toEqual(PREPARED_BY_TYPE[workType]);
			expect(card.initiallyVisibleFields).toEqual([
				"Title",
				"Type",
				"Status",
				"Planning",
			]);
			expect(card.visiblePreparedSections).toEqual([]);
			expect(card.addContext).toEqual({
				label: "Add Context",
				remainingSections: PREPARED_BY_TYPE[workType],
			});
			expect(card.gates).toEqual({
				create: false,
				statusTransition: false,
			});
		}
		for (const workType of WORK_TYPES) {
			const layouts = STARTER_CONFIGURATIONS.map(
				(starterConfiguration) =>
					presentWorkContextCard({ starterConfiguration, workType })
						.preparedSections
			);
			expect(new Set(layouts.map((sections) => sections.join("|"))).size).toBe(
				1
			);
		}
	});

	it("opens a hidden prepared section with Add Context and never treats emptiness as a gate", () => {
		const closed = presentWorkContextCard({
			starterConfiguration: "Solo SaaS",
			workType: "Feature",
		});
		const revealed = revealPreparedSection(
			closed,
			WORK_CONTEXT_COPY.problemOpportunity
		);
		expect(revealed.visiblePreparedSections).toEqual(["Problem/Opportunity"]);
		expect(revealed.addContext.remainingSections[0]).toBe("Expected Outcome");
		expect(revealed.gates).toEqual({
			create: false,
			statusTransition: false,
		});
		expect(WORK_CONTEXT_COPY.addContext).toBe("Add Context");
		expect(JSON.stringify(WORK_CONTEXT_COPY)).not.toMatch(DASHBOARD_PATTERN);
	});
});

describe("Work Context Card counterparts", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
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
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("creates and moves status with every prepared section empty", async () => {
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
		const createdProject = await createProject(prisma, {
			actorId: user.id,
			idempotencyKey: "create-mobile",
			origin: "human",
			payload: {
				name: "Mobile",
				starterConfiguration: "Mobile Application",
			},
			workspaceId: workspace.id,
		});
		if (createdProject.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const card = presentWorkContextCard({
			starterConfiguration: createdProject.project.starterConfiguration,
			workType: "Bug",
		});
		expect(card.visiblePreparedSections).toEqual([]);
		expect(card.gates.create).toBe(false);
		expect(card.gates.statusTransition).toBe(false);
		const created = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-bug",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Crash on launch",
				type: "Bug",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const progressed = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: created.work.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: "In Progress",
			workId: created.work.id,
		});
		expect(progressed).toMatchObject({
			status: "committed",
			work: { status: "In Progress" },
		});
	});
});
