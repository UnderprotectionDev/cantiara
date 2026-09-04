/**
 * Uncertainty Records seam — Assumption is a Project ana kayıt
 * distinct from Open Question. Lives Open, Confirmed, Refuted,
 * No longer applicable. Confirmed/Refuted accept optional exact
 * evidence or rationale; missing evidence is visible and does
 * not block. No longer applicable does not require new evidence
 * and does not strip existing Kanıt bağı or the statement.
 * Refutation does not write Decision, Risk, or Work life.
 * No Based on / Basis for. No Refuted Assumption Review.
 * Not a Validation Record or Research Session.
 * docs/specs/41-uncertainty-records/spec.md and GitHub #303.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Karar ve belirsizlik).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDecision, getDecision } from "../../decisions/server/decisions";
import { DECISION_LIFE } from "../../decisions/server/decisions-model";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import {
	parseRelationType,
	RELATION_TYPES,
	RELATIONS_COPY,
} from "../../relations/server/relations-catalog";
import {
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";

import {
	createAssumption,
	createOpenQuestion,
	getAssumption,
	getOpenQuestion,
	listAssumptions,
	listOpenQuestions,
	listRefutedAssumptionReview,
	setAssumptionLife,
	setOpenQuestionLife,
} from "./uncertainty-records";
import {
	ASSUMPTION_LIFE,
	ASSUMPTION_LIVES,
	firstProductUncertaintySurfaces,
	OPEN_QUESTION_LIFE,
	OPEN_QUESTION_LIVES,
	RELATIONS_KIND_QUESTION,
	UNCERTAINTY_COPY,
	UNCERTAINTY_RECORD_KINDS,
} from "./uncertainty-records-model";

const DATABASE_URL = localTestDatabaseUrl();

const FUTURE_COPY = /Based on|Basis for|Refuted Assumption Review/i;
const FEEDBACK_OR_RESEARCH =
	/feedback|research note|research session|facilitator|channel/i;
const REVIEW_QUEUE = /Refuted Assumption Review|Based on|Basis for/;

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
	await prisma.openQuestionEvent.deleteMany();
	await prisma.openQuestion.deleteMany();
	await prisma.assumptionEvent.deleteMany();
	await prisma.assumption.deleteMany();
	await prisma.decisionEvent.deleteMany();
	await prisma.decision.deleteMany();
	await prisma.documentVersion.deleteMany();
	await prisma.document.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.work.deleteMany();
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
		idempotencyKey: `create-payments-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

async function committedAssumption(
	prisma: PrismaClient,
	input: {
		actorId: string;
		idempotencyKey: string;
		projectId: string;
		rationale: string;
		statement: string;
	}
) {
	const created = await createAssumption(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId: input.projectId,
			rationale: input.rationale,
			statement: input.statement,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.assumption;
}

async function projectDocument(
	prisma: PrismaClient,
	input: { projectId: string; title: string; workspaceId: string }
) {
	return await prisma.document.create({
		data: {
			body: "Interview notes.",
			id: crypto.randomUUID(),
			projectId: input.projectId,
			revision: 1,
			scopeKind: "project",
			title: input.title,
			type: "General",
			workspaceId: input.workspaceId,
		},
	});
}

async function committedQuestion(
	prisma: PrismaClient,
	input: {
		actorId: string;
		context: string;
		idempotencyKey: string;
		projectId: string;
		question: string;
		title: string;
	}
) {
	const created = await createOpenQuestion(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			context: input.context,
			projectId: input.projectId,
			question: input.question,
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.openQuestion;
}

describe("Uncertainty Records", () => {
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

	it("creates an Assumption as a Project record that is Open", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const outcome = await createAssumption(prisma, {
			actorId,
			idempotencyKey: "create-checkout-assumption",
			origin: "human",
			payload: {
				projectId,
				rationale: "Saw drop-off on the form.",
				statement: "Checkout needs guest flow.",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			return;
		}
		expect(outcome.assumption.recordKind).toBe(UNCERTAINTY_COPY.assumption);
		expect(outcome.assumption.recordKind).not.toBe("Open Question");
		expect(outcome.assumption.recordKind).not.toBe("Experiment/Validation");
		expect(outcome.assumption.recordKind).not.toBe("User Research Session");
		expect(outcome.assumption.recordKind).not.toBe("Question");
		expect(outcome.assumption.statement).toBe("Checkout needs guest flow.");
		expect(outcome.assumption.rationale).toBe("Saw drop-off on the form.");
		expect(outcome.assumption.life).toBe(ASSUMPTION_LIFE.open);
		expect(outcome.assumption.projectId).toBe(projectId);
		expect(outcome.assumption.evidenceMissing).toBe(false);
		const listed = await listAssumptions(prisma, projectId);
		expect(listed).toEqual([outcome.assumption]);
	});

	it("confirms without evidence, keeps missing evidence visible, and does not block", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-then-confirm",
			projectId,
			rationale: "Early bet.",
			statement: "Teams want English UI.",
		});
		const confirmed = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "confirm-without-evidence",
			origin: "human",
			payload: {
				assumptionId: created.id,
				life: ASSUMPTION_LIFE.confirmed,
			},
		});
		expect(confirmed.status).toBe("committed");
		if (confirmed.status !== "committed") {
			return;
		}
		expect(confirmed.assumption.life).toBe(ASSUMPTION_LIFE.confirmed);
		expect(confirmed.assumption.evidenceMissing).toBe(true);
		expect(confirmed.assumption.evidence).toEqual([]);
		expect(confirmed.assumption.statement).toBe("Teams want English UI.");
	});

	it("refutes with optional rationale and exact evidence", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-then-refute",
			projectId,
			rationale: "Guess.",
			statement: "Users prefer email login.",
		});
		const notes = await projectDocument(prisma, {
			projectId,
			title: "Login interviews",
			workspaceId,
		});
		const refuted = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "refute-with-evidence",
			origin: "human",
			payload: {
				assumptionId: created.id,
				evidence: { fromId: notes.id, fromKind: "Document" },
				life: ASSUMPTION_LIFE.refuted,
				rationale: "Interviews chose GitHub.",
			},
		});
		expect(refuted.status).toBe("committed");
		if (refuted.status !== "committed") {
			return;
		}
		expect(refuted.assumption.life).toBe(ASSUMPTION_LIFE.refuted);
		expect(refuted.assumption.outcomeRationale).toBe(
			"Interviews chose GitHub."
		);
		expect(refuted.assumption.evidenceMissing).toBe(false);
		expect(refuted.assumption.evidence).toEqual([
			{
				fromId: notes.id,
				fromKind: "Document",
				id: expect.any(String),
			},
		]);
		const relations = await listRelations(prisma, {
			record: { id: created.id, kind: "Assumption" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			relations.filter((row) => row.type === RELATIONS_COPY.evidence)
		).toHaveLength(1);
	});

	it("keeps evidence and statement when moving to No longer applicable", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-keep-evidence",
			projectId,
			rationale: "For v1.",
			statement: "We need a mobile app this quarter.",
		});
		const notes = await projectDocument(prisma, {
			projectId,
			title: "Scope notes",
			workspaceId,
		});
		const confirmed = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "confirm-with-evidence",
			origin: "human",
			payload: {
				assumptionId: created.id,
				evidence: { fromId: notes.id, fromKind: "Document" },
				life: ASSUMPTION_LIFE.confirmed,
				rationale: "Interviews agreed.",
			},
		});
		if (confirmed.status !== "committed") {
			throw new Error("expected confirm");
		}
		const retired = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: confirmed.assumption.revision,
			idempotencyKey: "retire-assumption",
			origin: "human",
			payload: {
				assumptionId: created.id,
				life: ASSUMPTION_LIFE.noLongerApplicable,
			},
		});
		expect(retired.status).toBe("committed");
		if (retired.status !== "committed") {
			return;
		}
		expect(retired.assumption.life).toBe(ASSUMPTION_LIFE.noLongerApplicable);
		expect(retired.assumption.statement).toBe(
			"We need a mobile app this quarter."
		);
		expect(retired.assumption.rationale).toBe("For v1.");
		expect(retired.assumption.evidence).toHaveLength(1);
		expect(retired.assumption.evidenceMissing).toBe(false);
		const live = await getAssumption(prisma, created.id);
		expect(live?.evidence).toHaveLength(1);
	});

	it("does not attach new evidence on No longer applicable", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-nla-evidence",
			projectId,
			rationale: "Old bet.",
			statement: "We will ship widgets.",
		});
		const notes = await projectDocument(prisma, {
			projectId,
			title: "Later notes",
			workspaceId,
		});
		const retired = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "nla-with-evidence",
			origin: "human",
			payload: {
				assumptionId: created.id,
				evidence: { fromId: notes.id, fromKind: "Document" },
				life: ASSUMPTION_LIFE.noLongerApplicable,
			},
		});
		expect(retired.status).toBe("committed");
		if (retired.status !== "committed") {
			return;
		}
		expect(retired.assumption.life).toBe(ASSUMPTION_LIFE.noLongerApplicable);
		expect(retired.assumption.evidence).toEqual([]);
		const live = await getAssumption(prisma, created.id);
		expect(live?.life).toBe(ASSUMPTION_LIFE.noLongerApplicable);
		expect(live?.evidence).toEqual([]);
	});

	it("does not write related Decision or Work life when refuting", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const assumption = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-linked-assumption",
			projectId,
			rationale: "Auth bet.",
			statement: "Password login is enough.",
		});
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-auth-decision",
			origin: "human",
			payload: {
				decision: "Use GitHub login.",
				projectId,
				rationale: "One identity.",
				title: "GitHub login",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected decision");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "create-auth-work",
			origin: "human",
			payload: { projectId, title: "Ship GitHub login" },
		});
		if (work.status !== "committed" && work.status !== "replayed") {
			throw new Error("expected work");
		}
		const relatedDecision = await createRelation(prisma, {
			actorId,
			from: { id: decision.decision.id, kind: "Decision" },
			idempotencyKey: "relate-decision-assumption",
			origin: "human",
			previewAcknowledged: true,
			to: { id: assumption.id, kind: "Assumption" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(relatedDecision.status).toBe("committed");
		const relatedWork = await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: "relate-work-assumption",
			origin: "human",
			previewAcknowledged: true,
			to: { id: assumption.id, kind: "Assumption" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(relatedWork.status).toBe("committed");
		const workCount = (await listWork(prisma, projectId)).length;
		const refuted = await setAssumptionLife(prisma, {
			actorId,
			baseRevision: assumption.revision,
			idempotencyKey: "refute-linked",
			origin: "human",
			payload: {
				assumptionId: assumption.id,
				life: ASSUMPTION_LIFE.refuted,
				rationale: "GitHub is the identity.",
			},
		});
		expect(refuted.status).toBe("committed");
		if (refuted.status !== "committed") {
			return;
		}
		expect(refuted.assumption.recordKind).toBe(UNCERTAINTY_COPY.assumption);
		expect((await getDecision(prisma, decision.decision.id))?.life).toBe(
			DECISION_LIFE.valid
		);
		expect((await getWork(prisma, work.work.id))?.status).toBe(
			WORK_STATUS.notStarted
		);
		expect((await listWork(prisma, projectId)).length).toBe(workCount);
	});

	it("has no Based on relation and no Refuted Assumption Review", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const assumption = await committedAssumption(prisma, {
			actorId,
			idempotencyKey: "create-review-check",
			projectId,
			rationale: "Bet.",
			statement: "SSO later.",
		});
		expect(firstProductUncertaintySurfaces()).toEqual({
			basedOn: false,
			basisFor: false,
			refutedAssumptionReview: false,
		});
		expect(listRefutedAssumptionReview()).toEqual({
			present: false,
			rows: [],
		});
		expect(RELATION_TYPES).not.toContain("Based on");
		expect(RELATION_TYPES).not.toContain("Basis for");
		expect(parseRelationType("Based on")).toBeNull();
		const basedOn = await createRelation(prisma, {
			actorId,
			from: { id: assumption.id, kind: "Assumption" },
			idempotencyKey: "based-on",
			origin: "human",
			previewAcknowledged: true,
			to: { id: assumption.id, kind: "Decision" },
			type: "Based on",
			viewerWorkspaceId: workspaceId,
		});
		expect(basedOn.status).toBe("rejected");
		if (basedOn.status === "rejected") {
			expect(basedOn.reason).toBe("unknown-relation-type");
		}
		expect(JSON.stringify(UNCERTAINTY_COPY)).not.toMatch(FUTURE_COPY);
		const live = await getAssumption(prisma, assumption.id);
		expect(live?.life).toBe(ASSUMPTION_LIFE.open);
	});
});

describe("Uncertainty Records — Open Question", () => {
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

	it("creates an Open Question as a Project record that is Open", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const outcome = await createOpenQuestion(prisma, {
			actorId,
			idempotencyKey: "create-retry-question",
			origin: "human",
			payload: {
				context: "Checkout retries after a 5xx.",
				projectId,
				question: "Who owns retries?",
				title: "Retry owner",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			return;
		}
		expect(outcome.openQuestion.recordKind).toBe(UNCERTAINTY_COPY.openQuestion);
		expect(outcome.openQuestion.recordKind).not.toBe(
			UNCERTAINTY_COPY.assumption
		);
		expect(outcome.openQuestion.title).toBe("Retry owner");
		expect(outcome.openQuestion.question).toBe("Who owns retries?");
		expect(outcome.openQuestion.context).toBe("Checkout retries after a 5xx.");
		expect(outcome.openQuestion.life).toBe(OPEN_QUESTION_LIFE.open);
		expect(outcome.openQuestion.answer).toBe("");
		expect(outcome.openQuestion.projectId).toBe(projectId);
		expect(JSON.stringify(outcome.openQuestion)).not.toMatch(
			FEEDBACK_OR_RESEARCH
		);
		const listed = await listOpenQuestions(prisma, projectId);
		expect(listed).toEqual([outcome.openQuestion]);
	});

	it("answers with optional rationale, keeps the question, and shows missing evidence", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedQuestion(prisma, {
			actorId,
			context: "PCI scope.",
			idempotencyKey: "create-then-answer",
			projectId,
			question: "Do we store PAN?",
			title: "PAN storage",
		});
		const answered = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "answer-without-evidence",
			origin: "human",
			payload: {
				answer: "No. Tokens only.",
				life: OPEN_QUESTION_LIFE.answered,
				openQuestionId: created.id,
				rationale: "Payment provider tokens the card.",
			},
		});
		expect(answered.status).toBe("committed");
		if (answered.status !== "committed") {
			return;
		}
		expect(answered.openQuestion.life).toBe(OPEN_QUESTION_LIFE.answered);
		expect(answered.openQuestion.question).toBe("Do we store PAN?");
		expect(answered.openQuestion.answer).toBe("No. Tokens only.");
		expect(answered.openQuestion.rationale).toBe(
			"Payment provider tokens the card."
		);
		expect(answered.openQuestion.evidenceMissing).toBe(true);
		expect(answered.openQuestion.evidence).toEqual([]);
		const live = await getOpenQuestion(prisma, created.id);
		expect(live?.question).toBe("Do we store PAN?");
		expect(live?.evidenceMissing).toBe(true);
	});

	it("answers with exact evidence without blocking when evidence is present", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedQuestion(prisma, {
			actorId,
			context: "Auth.",
			idempotencyKey: "create-with-evidence",
			projectId,
			question: "Is GitHub the only login?",
			title: "Login identity",
		});
		const answered = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "answer-with-evidence",
			origin: "human",
			payload: {
				answer: "Yes for the founder.",
				evidence: { sourceId: "doc-auth-note", sourceKind: "Document" },
				life: OPEN_QUESTION_LIFE.answered,
				openQuestionId: created.id,
			},
		});
		expect(answered.status).toBe("committed");
		if (answered.status !== "committed") {
			return;
		}
		expect(answered.openQuestion.evidenceMissing).toBe(false);
		expect(answered.openQuestion.evidence).toEqual([
			{
				id: expect.any(String),
				sourceId: "doc-auth-note",
				sourceKind: "Document",
				type: UNCERTAINTY_COPY.evidence,
			},
		]);
		expect(answered.openQuestion.question).toBe("Is GitHub the only login?");
		const relations = await listRelations(prisma, {
			record: { id: created.id, kind: RELATIONS_KIND_QUESTION },
			viewerWorkspaceId: "unused",
		});
		expect(relations.map((row) => row.type)).toEqual([RELATIONS_COPY.evidence]);
	});

	it("marks No longer applicable without new evidence and without stripping history", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedQuestion(prisma, {
			actorId,
			context: "Legacy checkout.",
			idempotencyKey: "create-then-nla",
			projectId,
			question: "Do we keep the old cart?",
			title: "Old cart",
		});
		const answered = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "answer-first",
			origin: "human",
			payload: {
				answer: "Keep it through the cutover.",
				evidence: { sourceId: "doc-cutover", sourceKind: "Document" },
				life: OPEN_QUESTION_LIFE.answered,
				openQuestionId: created.id,
				rationale: "Cutover needs a fallback.",
			},
		});
		if (answered.status !== "committed") {
			throw new Error("expected answer");
		}
		const closed = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: answered.openQuestion.revision,
			idempotencyKey: "no-longer-applicable",
			origin: "human",
			payload: {
				life: OPEN_QUESTION_LIFE.noLongerApplicable,
				openQuestionId: created.id,
			},
		});
		expect(closed.status).toBe("committed");
		if (closed.status !== "committed") {
			return;
		}
		expect(closed.openQuestion.life).toBe(
			OPEN_QUESTION_LIFE.noLongerApplicable
		);
		expect(closed.openQuestion.question).toBe("Do we keep the old cart?");
		expect(closed.openQuestion.answer).toBe("Keep it through the cutover.");
		expect(closed.openQuestion.rationale).toBe("Cutover needs a fallback.");
		expect(closed.openQuestion.evidence).toHaveLength(1);
		expect(closed.openQuestion.evidenceMissing).toBe(false);
		const again = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: closed.openQuestion.revision,
			idempotencyKey: "nla-ignores-new-evidence",
			origin: "human",
			payload: {
				evidence: { sourceId: "doc-extra", sourceKind: "Document" },
				life: OPEN_QUESTION_LIFE.noLongerApplicable,
				openQuestionId: created.id,
				rationale: "Should not overwrite.",
			},
		});
		expect(again.status).toBe("committed");
		if (again.status !== "committed") {
			return;
		}
		expect(again.openQuestion.rationale).toBe("Cutover needs a fallback.");
		expect(again.openQuestion.evidence).toHaveLength(1);
	});

	it("does not auto-create Decision, Risk, or Work, and does not write a related Decision life", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const workBefore = await listWork(prisma, projectId);
		const created = await committedQuestion(prisma, {
			actorId,
			context: "Scope.",
			idempotencyKey: "create-no-convert",
			projectId,
			question: "Is PCI in scope?",
			title: "PCI scope",
		});
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: "related-decision",
			origin: "human",
			payload: {
				decision: "Stay on tokens.",
				projectId,
				rationale: "Less PCI surface.",
				title: "Tokens",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected decision");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: created.id, kind: RELATIONS_KIND_QUESTION },
			idempotencyKey: "relate-question-decision",
			origin: "human",
			previewAcknowledged: true,
			to: { id: decision.decision.id, kind: "Decision" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const answered = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "answer-no-convert",
			origin: "human",
			payload: {
				answer: "Yes for card data.",
				life: OPEN_QUESTION_LIFE.answered,
				openQuestionId: created.id,
			},
		});
		expect(answered.status).toBe("committed");
		if (answered.status !== "committed") {
			return;
		}
		expect(await listWork(prisma, projectId)).toEqual(workBefore);
		const liveDecision = await getDecision(prisma, decision.decision.id);
		expect(liveDecision?.life).toBe(DECISION_LIFE.valid);
		expect(JSON.stringify(answered.openQuestion)).not.toMatch(REVIEW_QUEUE);
	});

	it("keeps Open Question and Assumption as two types with distinct lives", async () => {
		expect(UNCERTAINTY_RECORD_KINDS).toEqual([
			UNCERTAINTY_COPY.assumption,
			UNCERTAINTY_COPY.openQuestion,
		]);
		expect(OPEN_QUESTION_LIVES).toEqual([
			OPEN_QUESTION_LIFE.open,
			OPEN_QUESTION_LIFE.answered,
			OPEN_QUESTION_LIFE.noLongerApplicable,
		]);
		expect(OPEN_QUESTION_LIVES).not.toContain(UNCERTAINTY_COPY.confirmed);
		expect(OPEN_QUESTION_LIVES).not.toContain(UNCERTAINTY_COPY.refuted);
		expect(ASSUMPTION_LIVES).not.toContain(OPEN_QUESTION_LIFE.answered);
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedQuestion(prisma, {
			actorId,
			context: "Type split.",
			idempotencyKey: "create-type-split",
			projectId,
			question: "Is this an Assumption?",
			title: "Type split",
		});
		expect(created.recordKind).toBe(UNCERTAINTY_COPY.openQuestion);
		const rejected = await setOpenQuestionLife(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "confirm-as-assumption",
			origin: "human",
			payload: {
				life: UNCERTAINTY_COPY.confirmed as (typeof OPEN_QUESTION_LIVES)[number],
				openQuestionId: created.id,
			},
		});
		expect(rejected).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
		const still = await getOpenQuestion(prisma, created.id);
		expect(still?.life).toBe(OPEN_QUESTION_LIFE.open);
		expect(still?.recordKind).toBe(UNCERTAINTY_COPY.openQuestion);
	});
});
