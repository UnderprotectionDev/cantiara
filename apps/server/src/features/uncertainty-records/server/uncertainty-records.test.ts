/**
 * Uncertainty Records seam — Open Question is a Project ana kayıt
 * with question and context. Life Open, Answered, No longer
 * applicable. Answered accepts optional exact evidence or
 * rationale; missing evidence is visible and does not block.
 * Answered and No longer applicable keep the question, any
 * answer, and Kanıt bağı rows. No auto Decision, Risk, or Work.
 * Not Feedback or a research note. Not an Assumption.
 * docs/specs/41-uncertainty-records/spec.md and GitHub #304.
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
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { listWork } from "../../work-lifecycle/server/work-lifecycle";

import {
	createOpenQuestion,
	getOpenQuestion,
	listOpenQuestions,
	setOpenQuestionLife,
} from "./uncertainty-records";
import {
	ASSUMPTION_LIVES,
	OPEN_QUESTION_LIFE,
	OPEN_QUESTION_LIVES,
	RELATIONS_KIND_QUESTION,
	UNCERTAINTY_COPY,
	UNCERTAINTY_RECORD_KINDS,
} from "./uncertainty-records-model";

const DATABASE_URL = localTestDatabaseUrl();

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
	await prisma.openQuestion.deleteMany();
	await prisma.decision.deleteMany();
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
		expect(answered.openQuestion.autoConverted).toEqual({
			decision: false,
			risk: false,
			work: false,
		});
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
