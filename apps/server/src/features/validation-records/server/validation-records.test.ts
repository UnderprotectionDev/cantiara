/**
 * Validation Records seam — Project ana kayıt with method, result,
 * and Related Assumption / Open Question / Decision context.
 * Relating does not write Assumption or Decision life and does not
 * mint a Decision. No survey, timed voting, or continuous feedback
 * loop. docs/specs/42-validation-records/spec.md and GitHub #305.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Karar ve belirsizlik).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	createDecision,
	getDecision,
	listDecisions,
} from "../../decisions/server/decisions";
import { DECISION_LIFE } from "../../decisions/server/decisions-model";
import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

import {
	createValidationRecord,
	getValidationRecord,
	listValidationRecords,
	relateValidationContext,
} from "./validation-records";
import {
	VALIDATION_RECORD_KIND,
	VALIDATION_RECORDS_COPY,
	VALIDATION_RECORDS_COUNTERPARTS,
	VALIDATION_RELATION_KIND,
	validationRecordsCatalog,
} from "./validation-records-model";

const DATABASE_URL = localTestDatabaseUrl();

const FORBIDDEN_SURFACE =
	/survey|timed vot|continuous feedback|vote|voting|poll/i;

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
	await prisma.validationRecord.deleteMany();
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

describe("Validation Records catalog", () => {
	it("exposes English Validation Record fields and no survey or vote", () => {
		const catalog = validationRecordsCatalog();
		expect(catalog.kind).toBe("Validation Record");
		expect(catalog.copy.validationRecord).toBe("Validation Record");
		expect(catalog.copy.method).toBe("Method");
		expect(catalog.copy.result).toBe("Result");
		expect(catalog.copy.assumption).toBe("Assumption");
		expect(catalog.copy.openQuestion).toBe("Open Question");
		expect(catalog.copy.decision).toBe("Decision");
		expect(catalog.copy.related).toBe("Related");
		expect(catalog.relationKind).toBe("Experiment/Validation");
		expect(catalog.counterparts).toEqual(VALIDATION_RECORDS_COUNTERPARTS);
		expect(VALIDATION_RECORDS_COUNTERPARTS.survey).toBe(false);
		expect(VALIDATION_RECORDS_COUNTERPARTS.timedVoting).toBe(false);
		expect(VALIDATION_RECORDS_COUNTERPARTS.continuousFeedbackLoop).toBe(false);
		expect(VALIDATION_RECORDS_COUNTERPARTS.writesAssumptionLife).toBe(false);
		expect(VALIDATION_RECORDS_COUNTERPARTS.writesDecisionLife).toBe(false);
		expect(JSON.stringify(catalog.copy)).not.toMatch(FORBIDDEN_SURFACE);
		expect(JSON.stringify(VALIDATION_RECORDS_COPY)).not.toMatch(
			FORBIDDEN_SURFACE
		);
	});
});

describe("Validation Records", () => {
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

	it("creates a Validation Record with method and result", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await createValidationRecord(prisma, {
			actorId,
			idempotencyKey: "create-pricing-check",
			origin: "human",
			payload: {
				method: "Five customer calls about checkout drop-off.",
				projectId,
				result: "Four of five said guest checkout was the missing step.",
				title: "Guest checkout check",
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.validationRecord.recordKind).toBe(VALIDATION_RECORD_KIND);
		expect(created.validationRecord.recordKind).not.toBe("Test Session");
		expect(created.validationRecord.recordKind).not.toBe(
			"User Research Session"
		);
		expect(created.validationRecord.method).toBe(
			"Five customer calls about checkout drop-off."
		);
		expect(created.validationRecord.result).toBe(
			"Four of five said guest checkout was the missing step."
		);
		expect(created.validationRecord.relatedContext).toEqual([]);
		const listed = await listValidationRecords(prisma, projectId, workspaceId);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.title).toBe("Guest checkout check");
		const loaded = await getValidationRecord(
			prisma,
			created.validationRecord.id,
			workspaceId
		);
		expect(loaded?.method).toBe(created.validationRecord.method);
		expect(await listDecisions(prisma, projectId)).toHaveLength(0);
	});

	it("replays the same create command without a second record", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const command = {
			actorId,
			idempotencyKey: "replay-check",
			origin: "human" as const,
			payload: {
				method: "Street intercept.",
				projectId,
				result: "Price felt high.",
				title: "Price intercept",
			},
			viewerWorkspaceId: workspaceId,
		};
		const first = await createValidationRecord(prisma, command);
		const second = await createValidationRecord(prisma, command);
		expect(first.status).toBe("committed");
		expect(second.status).toBe("replayed");
		if (first.status !== "committed" || second.status !== "replayed") {
			throw new Error("expected replay");
		}
		expect(second.validationRecord.id).toBe(first.validationRecord.id);
		expect(
			await listValidationRecords(prisma, projectId, workspaceId)
		).toHaveLength(1);
	});

	it("relates to a Decision without writing Decision life or minting another Decision", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-decision",
			origin: "human",
			payload: {
				decision: "Keep guest checkout.",
				projectId,
				rationale: "Support asked for it.",
				title: "Guest checkout",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected decision");
		}
		const record = await createValidationRecord(prisma, {
			actorId,
			idempotencyKey: "create-validation",
			origin: "human",
			payload: {
				method: "Support ticket review.",
				projectId,
				result: "Guest checkout came up in twelve tickets.",
				title: "Support review",
			},
			viewerWorkspaceId: workspaceId,
		});
		if (record.status !== "committed") {
			throw new Error("expected validation");
		}
		const related = await relateValidationContext(prisma, {
			actorId,
			idempotencyKey: "relate-decision",
			origin: "human",
			payload: {
				related: { id: decision.decision.id, kind: "Decision" },
				validationRecordId: record.validationRecord.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		if (related.status !== "committed") {
			throw new Error("expected relate");
		}
		expect(related.validationRecord.relatedContext).toEqual([
			{
				id: decision.decision.id,
				kind: "Decision",
				title: "Guest checkout",
			},
		]);
		const liveDecision = await getDecision(prisma, decision.decision.id);
		expect(liveDecision?.life).toBe(DECISION_LIFE.valid);
		expect(await listDecisions(prisma, projectId)).toHaveLength(1);
		const relations = await listRelations(prisma, {
			record: {
				id: record.validationRecord.id,
				kind: VALIDATION_RELATION_KIND,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(
			relations.filter((row) => row.type === RELATIONS_COPY.related)
		).toHaveLength(1);
	});

	it("relates to Assumption and Open Question without minting a Decision", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const record = await createValidationRecord(prisma, {
			actorId,
			idempotencyKey: "create-assumption-check",
			origin: "human",
			payload: {
				method: "Landing-page copy test outside the product.",
				projectId,
				result: "The claim did not land.",
				title: "Copy claim",
			},
			viewerWorkspaceId: workspaceId,
		});
		if (record.status !== "committed") {
			throw new Error("expected validation");
		}
		const assumptionId = crypto.randomUUID();
		const questionId = crypto.randomUUID();
		const toAssumption = await relateValidationContext(prisma, {
			actorId,
			idempotencyKey: "relate-assumption",
			origin: "human",
			payload: {
				related: { id: assumptionId, kind: "Assumption" },
				validationRecordId: record.validationRecord.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(toAssumption.status).toBe("committed");
		const toQuestion = await relateValidationContext(prisma, {
			actorId,
			idempotencyKey: "relate-question",
			origin: "human",
			payload: {
				related: { id: questionId, kind: "Question" },
				validationRecordId: record.validationRecord.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(toQuestion.status).toBe("committed");
		if (toQuestion.status !== "committed") {
			throw new Error("expected relate");
		}
		expect(
			toQuestion.validationRecord.relatedContext.map((item) => item.kind)
		).toEqual(["Assumption", "Question"]);
		expect(await listDecisions(prisma, projectId)).toHaveLength(0);
	});
});
