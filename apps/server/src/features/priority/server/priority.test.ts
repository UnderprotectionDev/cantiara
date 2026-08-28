/**
 * Prioritization seam — Project-scoped priority criteria with five
 * fixed ranks, empty outside those ranks, and no score/WSJF. Synthetic
 * fixture for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş yaşam döngüsü: optional criterion values, not a scalar priority).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listCustomFields } from "../../custom-fields/server/custom-fields";
import {
	copyProjectStructure,
	createProject,
	getProject,
} from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	createPriorityCriterion,
	listPriorityCriteria,
	listWorkPriorityValues,
	setPriorityCriterionValue,
	trashPriorityCriterion,
	updatePriorityCriterion,
} from "./priority";
import {
	emptyRankExplanations,
	PRIORITY_COPY,
	PRIORITY_RANKS,
	priorityCatalog,
} from "./priority-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"; // pragma: allowlist secret

const SCORE_WSJF_PATTERN = /wsjf|auto-?sort|auto-?fill|single score|weighting/i;
const SCALAR_PRIORITY_PATTERN = /\bpriority\b/;
const TRASH_UI_PATTERN = /restore from trash/i;

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

async function openProject(
	prisma: PrismaClient,
	starterConfiguration: "Blank Project" | "Solo SaaS" = "Blank Project"
) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${starterConfiguration}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration,
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

function createCriterionCommand(
	input: {
		description?: string;
		idempotencyKey?: string;
		name?: string;
		projectId: string;
		rankExplanations?: Record<string, string>;
	},
	actorId: string
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey ?? "create-criterion",
		origin: "human" as const,
		payload: {
			description: input.description,
			name: input.name,
			projectId: input.projectId,
			rankExplanations: input.rankExplanations,
		},
	};
}

describe("Prioritization", () => {
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

	it("exposes the closed English rank contract without score or WSJF", () => {
		const catalog = priorityCatalog();
		expect(catalog.ranks).toEqual([
			"Very low",
			"Low",
			"Medium",
			"High",
			"Very high",
		]);
		expect(catalog.preparedCriterion).toBe("Evidence strength");
		expect(PRIORITY_COPY.unevaluated).toBe("Unevaluated");
		expect(PRIORITY_COPY.priorityMetrics).toBe("Priority metrics");
		expect(PRIORITY_RANKS).toEqual(catalog.ranks);
		expect(JSON.stringify(catalog)).not.toMatch(SCORE_WSJF_PATTERN);
		expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(SCORE_WSJF_PATTERN);
		expect(catalog).not.toHaveProperty("autoFill");
		expect(catalog).not.toHaveProperty("wsjf");
		expect(catalog).not.toHaveProperty("score");
	});

	it("creates a Project-scoped criterion with name, description, and five rank explanations", async () => {
		const { actorId, project } = await openProject(prisma);
		const outcome = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					description: "How urgent the Work is",
					name: "Urgency",
					projectId: project.id,
					rankExplanations: {
						High: "Soon",
						Low: "Later",
						Medium: "This month",
						"Very high": "Now",
						"Very low": "Someday",
					},
				},
				actorId
			)
		);
		expect(outcome).toMatchObject({
			definition: {
				description: "How urgent the Work is",
				enabled: true,
				name: "Urgency",
				preparedKind: null,
				projectId: project.id,
				rankExplanations: {
					High: "Soon",
					Low: "Later",
					Medium: "This month",
					"Very high": "Now",
					"Very low": "Someday",
				},
			},
			status: "committed",
		});
		if (outcome.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		expect(outcome.definition.id).not.toBe("Urgency");
		expect(await listPriorityCriteria(prisma, project.id)).toEqual([
			outcome.definition,
		]);
		expect(JSON.stringify(outcome.definition)).not.toMatch(SCORE_WSJF_PATTERN);
	});

	it("rejects a missing name and a scoring formula", async () => {
		const { actorId, project } = await openProject(prisma);
		expect(
			await createPriorityCriterion(
				prisma,
				createCriterionCommand(
					{
						idempotencyKey: "missing-name",
						name: "  ",
						projectId: project.id,
					},
					actorId
				)
			)
		).toEqual({ reason: "missing-name", status: "rejected" });
		expect(
			await createPriorityCriterion(prisma, {
				actorId,
				idempotencyKey: "formula",
				origin: "human",
				payload: {
					formula: "impact * confidence",
					name: "Score",
					projectId: project.id,
				},
			})
		).toEqual({ reason: "formula-not-supported", status: "rejected" });
		expect(await listPriorityCriteria(prisma, project.id)).toEqual([]);
	});

	it("keeps same-named criteria in two Projects as separate identities", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const second = await createProject(prisma, {
			actorId,
			idempotencyKey: "second-project",
			origin: "human",
			payload: {
				name: "Billing",
				starterConfiguration: "Blank Project",
			},
			workspaceId,
		});
		if (second.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const first = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					idempotencyKey: "first-urgency",
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		const other = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					idempotencyKey: "second-urgency",
					name: "Urgency",
					projectId: second.project.id,
				},
				actorId
			)
		);
		expect(first.status).toBe("committed");
		expect(other.status).toBe("committed");
		if (first.status !== "committed" || other.status !== "committed") {
			throw new Error("expected committed criteria");
		}
		expect(first.definition.id).not.toBe(other.definition.id);
		expect(first.definition.projectId).toBe(project.id);
		expect(other.definition.projectId).toBe(second.project.id);
	});

	it("leaves Work unevaluated until a founder picks one of the five ranks", async () => {
		const { actorId, project } = await openProject(prisma);
		const createdCriterion = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		if (createdCriterion.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const createdWork = await createWork(prisma, {
			actorId,
			idempotencyKey: "create-work",
			origin: "human",
			payload: { projectId: project.id, title: "Intake checkout" },
		});
		if (createdWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const work = await getWork(prisma, createdWork.work.id);
		expect(work).not.toHaveProperty("priority");
		expect(JSON.stringify(work)).not.toMatch(SCALAR_PRIORITY_PATTERN);
		const unset = await listWorkPriorityValues(
			prisma,
			project.id,
			createdWork.work.id
		);
		expect(unset).toEqual([
			{
				criterionId: createdCriterion.definition.id,
				enabled: true,
				name: "Urgency",
				notEvaluated: true,
				rank: null,
				rankExplanations: emptyRankExplanations(),
				revision: 0,
				workId: createdWork.work.id,
			},
		]);
		const written = await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "set-high",
			origin: "human",
			payload: {
				criterionId: createdCriterion.definition.id,
				rank: "High",
				workId: createdWork.work.id,
			},
		});
		expect(written).toMatchObject({
			status: "committed",
			value: {
				notEvaluated: false,
				rank: "High",
			},
		});
		expect(
			await setPriorityCriterionValue(prisma, {
				actorId,
				baseRevision: 1,
				idempotencyKey: "set-bogus",
				origin: "human",
				payload: {
					criterionId: createdCriterion.definition.id,
					rank: "Critical",
					workId: createdWork.work.id,
				},
			})
		).toEqual({ reason: "unknown-rank", status: "rejected" });
		const cleared = await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 1,
			idempotencyKey: "clear-rank",
			origin: "human",
			payload: {
				criterionId: createdCriterion.definition.id,
				rank: null,
				workId: createdWork.work.id,
			},
		});
		expect(cleared).toMatchObject({
			status: "committed",
			value: { notEvaluated: true, rank: null },
		});
	});

	it("does not treat a criterion as a Custom field", async () => {
		const { actorId, project } = await openProject(prisma);
		await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		expect(await listCustomFields(prisma, project.id)).toEqual([]);
		expect(await listPriorityCriteria(prisma, project.id)).toHaveLength(1);
	});

	it("ships Evidence strength default-off on opinionated starters and never auto-fills it", async () => {
		const blank = await openProject(prisma, "Blank Project");
		expect(blank.project.priorityMetricDefinitions).toEqual([]);
		expect(await listPriorityCriteria(prisma, blank.project.id)).toEqual([]);
		const opinionated = await openProject(prisma, "Solo SaaS");
		const prepared = await listPriorityCriteria(prisma, opinionated.project.id);
		expect(prepared).toHaveLength(1);
		expect(prepared[0]).toMatchObject({
			enabled: false,
			name: "Evidence strength",
			preparedKind: "Evidence strength",
		});
		expect(opinionated.project.priorityMetricDefinitions).toEqual([
			{
				enabled: false,
				id: prepared[0]?.id,
				name: "Evidence strength",
				preparedKind: "Evidence strength",
			},
		]);
		const createdWork = await createWork(prisma, {
			actorId: opinionated.actorId,
			idempotencyKey: "create-work",
			origin: "human",
			payload: {
				projectId: opinionated.project.id,
				title: "Intake checkout",
			},
		});
		if (createdWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		expect(
			await listWorkPriorityValues(
				prisma,
				opinionated.project.id,
				createdWork.work.id
			)
		).toEqual([]);
		const enabled = await updatePriorityCriterion(prisma, {
			actorId: opinionated.actorId,
			baseRevision: prepared[0]?.revision ?? 1,
			idempotencyKey: "enable-evidence",
			origin: "human",
			payload: {
				criterionId: prepared[0]?.id ?? "",
				enabled: true,
			},
		});
		expect(enabled).toMatchObject({
			definition: { enabled: true },
			status: "committed",
		});
		const values = await listWorkPriorityValues(
			prisma,
			opinionated.project.id,
			createdWork.work.id
		);
		expect(values).toEqual([
			expect.objectContaining({
				name: "Evidence strength",
				notEvaluated: true,
				rank: null,
			}),
		]);
		expect(JSON.stringify(values)).not.toMatch(SCORE_WSJF_PATTERN);
	});

	it("stops using a trashed definition without exposing trash UI copy", async () => {
		const { actorId, project } = await openProject(prisma);
		const created = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const createdWork = await createWork(prisma, {
			actorId,
			idempotencyKey: "create-work",
			origin: "human",
			payload: { projectId: project.id, title: "Intake checkout" },
		});
		if (createdWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const trashed = await trashPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "trash-urgency",
			origin: "human",
			payload: { criterionId: created.definition.id },
		});
		expect(trashed.status).toBe("committed");
		expect(await listPriorityCriteria(prisma, project.id)).toEqual([]);
		expect(
			await listWorkPriorityValues(prisma, project.id, createdWork.work.id)
		).toEqual([]);
		expect(
			await setPriorityCriterionValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "set-after-trash",
				origin: "human",
				payload: {
					criterionId: created.definition.id,
					rank: "High",
					workId: createdWork.work.id,
				},
			})
		).toEqual({ reason: "criterion-not-effective", status: "rejected" });
		expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(TRASH_UI_PATTERN);
	});

	it("edits rank explanations on an existing Project criterion", async () => {
		const { actorId, project } = await openProject(prisma);
		const created = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const updated = await updatePriorityCriterion(prisma, {
			actorId,
			baseRevision: created.definition.revision,
			idempotencyKey: "edit-explanations",
			origin: "human",
			payload: {
				criterionId: created.definition.id,
				description: "How soon",
				rankExplanations: {
					High: "Soon",
					Low: "Later",
					Medium: "This month",
					"Very high": "Now",
					"Very low": "Someday",
				},
			},
		});
		expect(updated).toMatchObject({
			definition: {
				description: "How soon",
				name: "Urgency",
				rankExplanations: {
					High: "Soon",
					Low: "Later",
					Medium: "This month",
					"Very high": "Now",
					"Very low": "Someday",
				},
			},
			status: "committed",
		});
	});

	it("copies criterion definitions as independent identities", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{
					name: "Urgency",
					projectId: project.id,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const copied = await copyProjectStructure(prisma, {
			actorId,
			idempotencyKey: "copy-north",
			origin: "human",
			payload: {
				name: "North",
				sourceProjectId: project.id,
			},
			workspaceId,
		});
		expect(copied.status).toBe("committed");
		if (copied.status !== "committed") {
			throw new Error("expected committed copy");
		}
		const cloned = await listPriorityCriteria(prisma, copied.project.id);
		expect(cloned).toHaveLength(1);
		expect(cloned[0]?.name).toBe("Urgency");
		expect(cloned[0]?.id).not.toBe(created.definition.id);
		expect(cloned[0]?.projectId).toBe(copied.project.id);
		expect(copied.project.priorityMetricDefinitions).toEqual([
			{
				enabled: true,
				id: cloned[0]?.id,
				name: "Urgency",
				preparedKind: null,
			},
		]);
		const source = await getProject(prisma, project.id);
		expect(source?.priorityMetricDefinitions[0]?.id).toBe(
			created.definition.id
		);
	});
});
