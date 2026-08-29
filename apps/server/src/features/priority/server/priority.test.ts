/**
 * Prioritization seam — Project-scoped priority criteria with five
 * fixed ranks, Priority Map placement including Unevaluated, session
 * order versus Backlog, and no score/WSJF. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş yaşam döngüsü: optional criterion values; günlük planlama:
 * map/session view does not write Kanban status or Backlog order).
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
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	archivePrioritizationSession,
	closePrioritizationSession,
	createPrioritizationSession,
	createPriorityCriterion,
	listPrioritizationSessions,
	listPriorityCriteria,
	listWorkPriorityValues,
	readPriorityMap,
	relocatePriorityMapPoint,
	reopenPrioritizationSession,
	reorderPrioritizationSession,
	savePriorityMapPresentation,
	setPrioritizationSessionScope,
	setPriorityCriterionValue,
	trashPrioritizationSession,
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
const MAP_DASHBOARD_PATTERN = /quick wins|do first|dashboard|publish score/i;
const MAP_SCORE_PATTERN = /wsjf|quick wins|do first|dashboard|publish score/i;
const BACKLOG_ORDER_PATTERN = /\bbacklogOrder\b/;

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
		expect(PRIORITY_COPY.priorityMap).toBe("Priority Map");
		expect(PRIORITY_COPY.createPrioritizationSession).toBe(
			"Create Prioritization Session"
		);
		expect(catalog.independentManualRankViews).toEqual([
			"Create Prioritization Session",
		]);
		expect(PRIORITY_RANKS).toEqual(catalog.ranks);
		expect(JSON.stringify(catalog)).not.toMatch(SCORE_WSJF_PATTERN);
		expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(SCORE_WSJF_PATTERN);
		expect(catalog).not.toHaveProperty("autoFill");
		expect(catalog).not.toHaveProperty("wsjf");
		expect(catalog).not.toHaveProperty("score");
		expect(catalog).not.toHaveProperty("quadrantLabels");
		expect(JSON.stringify(catalog)).not.toMatch(MAP_DASHBOARD_PATTERN);
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

	it("opens a named Prioritization Session only from explicit create", async () => {
		const { actorId, project } = await openProject(prisma);
		const first = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-a",
			origin: "human",
			payload: { projectId: project.id, title: "Checkout" },
		});
		const second = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-b",
			origin: "human",
			payload: { projectId: project.id, title: "Refunds" },
		});
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected committed Work");
		}
		expect(
			await createPrioritizationSession(prisma, {
				actorId,
				idempotencyKey: "session-score",
				origin: "human",
				payload: {
					name: "August rank",
					projectId: project.id,
					score: 9,
					workIds: [first.work.id, second.work.id],
				},
			})
		).toEqual({ reason: "formula-not-supported", status: "rejected" });
		const created = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-open",
			origin: "human",
			payload: {
				name: "August rank",
				projectId: project.id,
				workIds: [second.work.id, first.work.id],
			},
		});
		expect(created).toMatchObject({
			session: {
				name: "August rank",
				projectId: project.id,
				writes: {
					backlogOrder: false,
					criterionValues: false,
					dailyFocus: false,
					decisionRecord: false,
					focusPeriod: false,
					roadmapHorizon: false,
					sessionScore: false,
					status: false,
				},
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed session");
		}
		expect(created.session.closedAt).toBeNull();
		expect(created.session.comparison.implicitSync).toBe(false);
		expect(created.session.comparison.sessionOrder).toEqual([
			second.work.id,
			first.work.id,
		]);
		expect(created.session.comparison.backlogOrder).toEqual([
			first.work.id,
			second.work.id,
		]);
		expect(created.session.cards.map((card) => card.title)).toEqual([
			"Refunds",
			"Checkout",
		]);
		expect(created.session.cards[0]).toMatchObject({
			evidence: {
				feedbackRecords: 0,
				uniqueCompanies: 0,
				uniqueContacts: 0,
			},
			riskCount: 0,
			sessionRank: 0,
			targetDate: null,
			workId: second.work.id,
		});
		expect(created.session.cards[0]?.backlogRank).toBe(1);
		expect(created.session.cards[1]?.backlogRank).toBe(0);
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.work.id, status: "Not Started", title: "Checkout" },
			{ id: second.work.id, status: "Not Started", title: "Refunds" },
		]);
		expect(await listPrioritizationSessions(prisma, project.id)).toEqual([
			created.session,
		]);
	});

	it("reorders only the session rank and never writes Backlog, status, or criterion values", async () => {
		const { actorId, project } = await openProject(prisma);
		const criterion = await createPriorityCriterion(
			prisma,
			createCriterionCommand(
				{ name: "Urgency", projectId: project.id },
				actorId
			)
		);
		if (criterion.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const first = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-a",
			origin: "human",
			payload: { projectId: project.id, title: "Checkout" },
		});
		const second = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-b",
			origin: "human",
			payload: { projectId: project.id, title: "Refunds" },
		});
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected committed Work");
		}
		await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "rank-a",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: first.work.id,
			},
		});
		const opened = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-open",
			origin: "human",
			payload: {
				name: "August rank",
				projectId: project.id,
				workIds: [first.work.id, second.work.id],
			},
		});
		if (opened.status !== "committed") {
			throw new Error("expected committed session");
		}
		const reordered = await reorderPrioritizationSession(prisma, {
			actorId,
			baseRevision: opened.session.revision,
			idempotencyKey: "session-reorder",
			origin: "human",
			payload: {
				sessionId: opened.session.id,
				workIds: [second.work.id, first.work.id],
			},
		});
		expect(reordered).toMatchObject({
			session: {
				comparison: {
					backlogOrder: [first.work.id, second.work.id],
					implicitSync: false,
					sessionOrder: [second.work.id, first.work.id],
				},
			},
			status: "committed",
		});
		if (reordered.status !== "committed") {
			throw new Error("expected committed reorder");
		}
		expect(reordered.session.cards.map((card) => card.workId)).toEqual([
			second.work.id,
			first.work.id,
		]);
		expect(
			reordered.session.cards.find((card) => card.workId === first.work.id)
		).toMatchObject({
			criterionValues: [
				{
					criterionId: criterion.definition.id,
					name: "Urgency",
					notEvaluated: false,
					rank: "High",
				},
			],
		});
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.work.id, status: "Not Started" },
			{ id: second.work.id, status: "Not Started" },
		]);
		expect(
			await listWorkPriorityValues(prisma, project.id, first.work.id)
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					criterionId: criterion.definition.id,
					rank: "High",
				}),
			])
		);
		const scoped = await setPrioritizationSessionScope(prisma, {
			actorId,
			baseRevision: reordered.session.revision,
			idempotencyKey: "session-scope",
			origin: "human",
			payload: {
				sessionId: opened.session.id,
				workIds: [second.work.id],
			},
		});
		expect(scoped).toMatchObject({
			session: {
				comparison: { sessionOrder: [second.work.id] },
			},
			status: "committed",
		});
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.work.id, status: "Not Started" },
			{ id: second.work.id, status: "Not Started" },
		]);
	});

	it("keeps a closed session as dated read-only context and does not erase it with a new session", async () => {
		const { actorId, project } = await openProject(prisma);
		const first = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-a",
			origin: "human",
			payload: { projectId: project.id, title: "Checkout" },
		});
		const second = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-b",
			origin: "human",
			payload: { projectId: project.id, title: "Refunds" },
		});
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const opened = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-open",
			origin: "human",
			payload: {
				name: "August rank",
				projectId: project.id,
				workIds: [first.work.id, second.work.id],
			},
		});
		if (opened.status !== "committed") {
			throw new Error("expected committed session");
		}
		const closed = await closePrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-close",
			origin: "human",
			payload: { sessionId: opened.session.id },
		});
		expect(closed).toMatchObject({ status: "committed" });
		if (closed.status !== "committed") {
			throw new Error("expected committed close");
		}
		expect(closed.session.closedAt).toEqual(expect.any(String));
		expect(closed.session.comparison.sessionOrder).toEqual([
			first.work.id,
			second.work.id,
		]);
		expect(
			await reorderPrioritizationSession(prisma, {
				actorId,
				baseRevision: closed.session.revision,
				idempotencyKey: "session-reorder-closed",
				origin: "human",
				payload: {
					sessionId: opened.session.id,
					workIds: [second.work.id, first.work.id],
				},
			})
		).toEqual({ reason: "session-closed", status: "rejected" });
		const later = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-later",
			origin: "human",
			payload: {
				name: "September rank",
				projectId: project.id,
				workIds: [second.work.id],
			},
		});
		expect(later).toMatchObject({ status: "committed" });
		const listed = await listPrioritizationSessions(prisma, project.id);
		expect(listed.map((session) => session.name)).toEqual([
			"August rank",
			"September rank",
		]);
		const reopened = await reopenPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-reopen",
			origin: "human",
			payload: { sessionId: opened.session.id },
		});
		expect(reopened).toMatchObject({
			session: { closedAt: null, name: "August rank" },
			status: "committed",
		});
	});

	it("archives or trashes a session without touching Work or Backlog order", async () => {
		const { actorId, project } = await openProject(prisma);
		const first = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-a",
			origin: "human",
			payload: { projectId: project.id, title: "Checkout" },
		});
		if (first.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const opened = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-open",
			origin: "human",
			payload: {
				name: "August rank",
				projectId: project.id,
				workIds: [first.work.id],
			},
		});
		if (opened.status !== "committed") {
			throw new Error("expected committed session");
		}
		const archived = await archivePrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-archive",
			origin: "human",
			payload: { sessionId: opened.session.id },
		});
		expect(archived).toMatchObject({ status: "committed" });
		if (archived.status !== "committed") {
			throw new Error("expected committed archive");
		}
		expect(archived.session.archivedAt).toEqual(expect.any(String));
		expect(await listPrioritizationSessions(prisma, project.id)).toEqual([]);
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.work.id, status: "Not Started", title: "Checkout" },
		]);
		const second = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-other",
			origin: "human",
			payload: {
				name: "Keep me",
				projectId: project.id,
				workIds: [first.work.id],
			},
		});
		if (second.status !== "committed") {
			throw new Error("expected committed session");
		}
		expect(
			await trashPrioritizationSession(prisma, {
				actorId,
				idempotencyKey: "session-trash",
				origin: "human",
				payload: { sessionId: second.session.id },
			})
		).toMatchObject({ status: "committed" });
		expect(await listPrioritizationSessions(prisma, project.id)).toEqual([]);
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.work.id, title: "Checkout" },
		]);
		expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(TRASH_UI_PATTERN);
		expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(SCORE_WSJF_PATTERN);
	});

	it("places Work on two ordered axes and keeps missing ranks in Unevaluated", async () => {
		const { actorId, project } = await openProject(prisma);
		const urgency = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Urgency",
			"create-urgency"
		);
		const reach = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Reach",
			"create-reach"
		);
		const plottedWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const missingWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Deferred intake",
			"create-deferred"
		);
		await setRank(
			prisma,
			actorId,
			urgency.id,
			plottedWork.id,
			"High",
			"set-urgency"
		);
		await setRank(
			prisma,
			actorId,
			reach.id,
			plottedWork.id,
			"Low",
			"set-reach"
		);
		const map = await readPriorityMap(prisma, {
			horizontalCriterionId: urgency.id,
			projectId: project.id,
			verticalCriterionId: reach.id,
		});
		expect(map.status).toBe("ok");
		if (map.status !== "ok") {
			throw new Error("expected map");
		}
		expect(map.view.horizontal.name).toBe("Urgency");
		expect(map.view.vertical.name).toBe("Reach");
		expect(map.view.ranks).toEqual(PRIORITY_RANKS);
		expect(map.view.plotted).toEqual([
			{
				evidence: null,
				horizontalRank: "High",
				key: plottedWork.key,
				title: "Checkout",
				verticalRank: "Low",
				workId: plottedWork.id,
			},
		]);
		expect(map.view.unevaluated).toEqual([
			{
				evidence: null,
				key: missingWork.key,
				missingAxes: ["horizontal", "vertical"],
				title: "Deferred intake",
				workId: missingWork.id,
			},
		]);
		expect(map.view).not.toHaveProperty("score");
		expect(map.view).not.toHaveProperty("order");
		expect(map.view).not.toHaveProperty("quadrantLabels");
		expect(JSON.stringify(map.view)).not.toMatch(MAP_SCORE_PATTERN);
	});

	it("shows Feedback and unique Contact/Company counts as context, not a score", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const urgency = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Urgency",
			"create-urgency"
		);
		const reach = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Reach",
			"create-reach"
		);
		const plottedWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		await setRank(
			prisma,
			actorId,
			urgency.id,
			plottedWork.id,
			"Medium",
			"set-urgency"
		);
		await setRank(
			prisma,
			actorId,
			reach.id,
			plottedWork.id,
			"High",
			"set-reach"
		);
		const feedbackId = crypto.randomUUID();
		const contactId = crypto.randomUUID();
		const companyId = crypto.randomUUID();
		await linkEvidence(
			prisma,
			actorId,
			workspaceId,
			feedbackId,
			plottedWork.id
		);
		await linkRelated(prisma, actorId, workspaceId, feedbackId, contactId);
		await linkBelongsToCompany(
			prisma,
			actorId,
			workspaceId,
			contactId,
			companyId
		);
		const map = await readPriorityMap(prisma, {
			horizontalCriterionId: urgency.id,
			projectId: project.id,
			verticalCriterionId: reach.id,
		});
		expect(map.status).toBe("ok");
		if (map.status !== "ok") {
			throw new Error("expected map");
		}
		expect(map.view.plotted[0]?.evidence).toEqual({
			feedbackCount: 1,
			uniqueCompanyCount: 1,
			uniqueContactCount: 1,
		});
		expect(map.view.plotted[0]).not.toHaveProperty("score");
		expect(JSON.stringify(map.view.plotted[0]?.evidence)).not.toMatch(
			SCORE_WSJF_PATTERN
		);
	});

	it("does not write Backlog order, Kanban status, or ranks when a point is relocated", async () => {
		const { actorId, project } = await openProject(prisma);
		const urgency = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Urgency",
			"create-urgency"
		);
		const reach = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Reach",
			"create-reach"
		);
		const plottedWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		await setRank(
			prisma,
			actorId,
			urgency.id,
			plottedWork.id,
			"High",
			"set-urgency"
		);
		await setRank(
			prisma,
			actorId,
			reach.id,
			plottedWork.id,
			"Low",
			"set-reach"
		);
		const before = await getWork(prisma, plottedWork.id);
		expect(before?.status).toBe("Not Started");
		expect(
			await relocatePriorityMapPoint(prisma, {
				actorId,
				idempotencyKey: "drag-point",
				origin: "human",
				payload: {
					horizontalRank: "Very high",
					projectId: project.id,
					verticalRank: "Very high",
					workId: plottedWork.id,
				},
			})
		).toEqual({ reason: "position-is-not-order", status: "rejected" });
		const after = await getWork(prisma, plottedWork.id);
		expect(after?.status).toBe("Not Started");
		expect(after).toEqual(before);
		expect(JSON.stringify(after)).not.toMatch(BACKLOG_ORDER_PATTERN);
		expect(
			await listWorkPriorityValues(prisma, project.id, plottedWork.id)
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					criterionId: urgency.id,
					rank: "High",
				}),
				expect.objectContaining({
					criterionId: reach.id,
					rank: "Low",
				}),
			])
		);
	});

	it("writes an explicit axis edit to the same criterion field", async () => {
		const { actorId, project } = await openProject(prisma);
		const urgency = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Urgency",
			"create-urgency"
		);
		const reach = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Reach",
			"create-reach"
		);
		const plottedWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		await setRank(
			prisma,
			actorId,
			urgency.id,
			plottedWork.id,
			"High",
			"set-urgency"
		);
		await setRank(
			prisma,
			actorId,
			reach.id,
			plottedWork.id,
			"Low",
			"set-reach"
		);
		const written = await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 1,
			idempotencyKey: "edit-from-map",
			origin: "human",
			payload: {
				criterionId: urgency.id,
				rank: "Very high",
				workId: plottedWork.id,
			},
		});
		expect(written).toMatchObject({
			status: "committed",
			value: { notEvaluated: false, rank: "Very high" },
		});
		const map = await readPriorityMap(prisma, {
			horizontalCriterionId: urgency.id,
			projectId: project.id,
			verticalCriterionId: reach.id,
		});
		if (map.status !== "ok") {
			throw new Error("expected map");
		}
		expect(map.view.plotted[0]?.horizontalRank).toBe("Very high");
		expect(map.view.plotted[0]?.verticalRank).toBe("Low");
	});

	it("saves map presentation without a second ranking truth", async () => {
		const { actorId, project } = await openProject(prisma);
		const urgency = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Urgency",
			"create-urgency"
		);
		const reach = await createNamedCriterion(
			prisma,
			actorId,
			project.id,
			"Reach",
			"create-reach"
		);
		const plottedWork = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		await setRank(
			prisma,
			actorId,
			urgency.id,
			plottedWork.id,
			"High",
			"set-urgency"
		);
		await setRank(
			prisma,
			actorId,
			reach.id,
			plottedWork.id,
			"Low",
			"set-reach"
		);
		const before = await getWork(prisma, plottedWork.id);
		const saved = await savePriorityMapPresentation(prisma, {
			actorId,
			idempotencyKey: "save-map",
			origin: "human",
			payload: {
				horizontalCriterionId: urgency.id,
				projectId: project.id,
				verticalCriterionId: reach.id,
			},
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected saved presentation");
		}
		expect(saved.presentation).toEqual({
			horizontalCriterionId: urgency.id,
			projectId: project.id,
			verticalCriterionId: reach.id,
		});
		expect(saved.presentation).not.toHaveProperty("order");
		expect(saved.presentation).not.toHaveProperty("score");
		expect(await getWork(prisma, plottedWork.id)).toEqual(before);
		const map = await readPriorityMap(prisma, {
			horizontalCriterionId: urgency.id,
			projectId: project.id,
			verticalCriterionId: reach.id,
		});
		if (map.status !== "ok") {
			throw new Error("expected map");
		}
		expect(map.view.plotted[0]?.horizontalRank).toBe("High");
		expect(
			await listWorkPriorityValues(prisma, project.id, plottedWork.id)
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ rank: "High" }),
				expect.objectContaining({ rank: "Low" }),
			])
		);
	});
});

async function createNamedCriterion(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	name: string,
	idempotencyKey: string
) {
	const outcome = await createPriorityCriterion(
		prisma,
		createCriterionCommand({ idempotencyKey, name, projectId }, actorId)
	);
	if (outcome.status !== "committed") {
		throw new Error("expected committed criterion");
	}
	return outcome.definition;
}

async function createNamedWork(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string,
	idempotencyKey: string
) {
	const outcome = await createWork(prisma, {
		actorId,
		idempotencyKey,
		origin: "human",
		payload: { projectId, title },
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed Work");
	}
	return outcome.work;
}

async function setRank(
	prisma: PrismaClient,
	actorId: string,
	criterionId: string,
	workId: string,
	rank: "Very low" | "Low" | "Medium" | "High" | "Very high",
	idempotencyKey: string
) {
	const outcome = await setPriorityCriterionValue(prisma, {
		actorId,
		baseRevision: 0,
		idempotencyKey,
		origin: "human",
		payload: { criterionId, rank, workId },
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed rank");
	}
}

async function linkEvidence(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	feedbackId: string,
	workId: string
) {
	const outcome = await createRelation(prisma, {
		actorId,
		from: { id: feedbackId, kind: "Feedback" },
		idempotencyKey: `evidence-${feedbackId}`,
		origin: "human",
		previewAcknowledged: true,
		to: { id: workId, kind: "Work" },
		type: RELATIONS_COPY.evidence,
		viewerWorkspaceId: workspaceId,
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed evidence relation");
	}
}

async function linkRelated(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	feedbackId: string,
	contactId: string
) {
	const outcome = await createRelation(prisma, {
		actorId,
		from: { id: feedbackId, kind: "Feedback" },
		idempotencyKey: `related-${feedbackId}-${contactId}`,
		origin: "human",
		previewAcknowledged: true,
		to: { id: contactId, kind: "Contact" },
		type: RELATIONS_COPY.related,
		viewerWorkspaceId: workspaceId,
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed related relation");
	}
}

async function linkBelongsToCompany(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	contactId: string,
	companyId: string
) {
	const outcome = await createRelation(prisma, {
		actorId,
		from: { id: contactId, kind: "Contact" },
		idempotencyKey: `company-${contactId}`,
		origin: "human",
		previewAcknowledged: true,
		to: { id: companyId, kind: "Company" },
		type: RELATIONS_COPY.belongsToCompany,
		viewerWorkspaceId: workspaceId,
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed company relation");
	}
}
