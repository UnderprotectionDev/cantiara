/**
 * Decisions seam — Project ana kayıt with title, decision
 * text, and rationale. Lives Valid, Superseded, Withdrawn.
 * Superseded is not a free status pick. Withdrawn is an
 * explicit dated action. Work close does not withdraw.
 * Missing imported life reads Valid. No alternative set,
 * voting, or automatic winner.
 * docs/specs/38-decisions/spec.md and GitHub #275.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Karar ve belirsizlik).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	closeWork,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { CLOSURE_RESULT } from "../../work-lifecycle/server/work-lifecycle-model";

import {
	createDecision,
	getDecision,
	ingestImportedDecision,
	listDecisions,
	setDecisionLife,
	withdrawDecision,
} from "./decisions";
import {
	DECISION_LIFE,
	DECISIONS_COPY,
	importedDecisionLife,
	presentDecisionLife,
} from "./decisions-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
const VOTING_COPY = /vote|voting|score|winner|alternative set/i;

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

describe("Decisions", () => {
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

	it("creates a Decision as a Project record that is Valid", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const outcome = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-auth-decision",
			origin: "human",
			payload: {
				decision: "Use GitHub login.",
				projectId,
				rationale: "One identity for the founder.",
				title: "GitHub login",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			return;
		}
		expect(outcome.decision.recordKind).toBe(DECISIONS_COPY.decision);
		expect(outcome.decision.title).toBe("GitHub login");
		expect(outcome.decision.decision).toBe("Use GitHub login.");
		expect(outcome.decision.rationale).toBe("One identity for the founder.");
		expect(outcome.decision.life).toBe(DECISION_LIFE.valid);
		expect(outcome.decision.projectId).toBe(projectId);
		const listed = await listDecisions(prisma, projectId);
		expect(listed).toEqual([outcome.decision]);
	});

	it("withdraws with optional dated rationale without a successor", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-then-withdraw",
			origin: "human",
			payload: {
				decision: "Ship weekly.",
				projectId,
				rationale: "Cadence.",
				title: "Weekly ship",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		const withdrawn = await withdrawDecision(prisma, {
			actorId,
			baseRevision: created.decision.revision,
			idempotencyKey: "withdraw-weekly",
			origin: "human",
			payload: {
				decisionId: created.decision.id,
				rationale: "Cadence moved to the board.",
			},
		});
		expect(withdrawn.status).toBe("committed");
		if (withdrawn.status !== "committed") {
			return;
		}
		expect(withdrawn.decision.life).toBe(DECISION_LIFE.withdrawn);
		expect(withdrawn.decision.withdrawnRationale).toBe(
			"Cadence moved to the board."
		);
		expect(withdrawn.decision.withdrawnAt).toMatch(ISO_INSTANT);
		const loaded = await getDecision(prisma, withdrawn.decision.id);
		expect(loaded?.life).toBe(DECISION_LIFE.withdrawn);
	});

	it("rejects unrelated Superseded as a direct life pick", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-no-supersede",
			origin: "human",
			payload: {
				decision: "Keep Postgres.",
				projectId,
				rationale: "Hosted Neon.",
				title: "Postgres",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		const rejected = await setDecisionLife(prisma, {
			actorId,
			baseRevision: created.decision.revision,
			idempotencyKey: "pick-superseded",
			origin: "human",
			payload: {
				decisionId: created.decision.id,
				life: DECISION_LIFE.superseded,
			},
		});
		expect(rejected).toEqual({
			reason: "superseded-requires-relation",
			status: "rejected",
		});
		const loaded = await getDecision(prisma, created.decision.id);
		expect(loaded?.life).toBe(DECISION_LIFE.valid);
	});

	it("does not withdraw a Decision when related Work closes", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createDecision(prisma, {
			actorId,
			idempotencyKey: "create-kept-decision",
			origin: "human",
			payload: {
				decision: "Auth stays GitHub.",
				projectId,
				rationale: "Founder login.",
				title: "GitHub login",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected create");
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
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: work.work.revision,
			idempotencyKey: "close-auth-work",
			origin: "human",
			reason: "Shipped.",
			result: CLOSURE_RESULT.completed,
			workId: work.work.id,
		});
		expect(closed.status).toBe("committed");
		const loaded = await getDecision(prisma, created.decision.id);
		expect(loaded?.life).toBe(DECISION_LIFE.valid);
	});

	it("reads missing imported life as Valid", async () => {
		expect(presentDecisionLife(null)).toBe(DECISION_LIFE.valid);
		expect(presentDecisionLife(undefined)).toBe(DECISION_LIFE.valid);
		expect(presentDecisionLife("")).toBe(DECISION_LIFE.valid);
		const { actorId, projectId } = await openPayments(prisma);
		const ingested = await ingestImportedDecision(prisma, {
			actorId,
			idempotencyKey: "import-without-life",
			origin: "human",
			payload: {
				decision: "Keep the board.",
				life: null,
				projectId,
				rationale: "Imported row.",
				title: "Board",
			},
		});
		expect(ingested.status).toBe("committed");
		if (ingested.status !== "committed") {
			return;
		}
		expect(ingested.decision.life).toBe(DECISION_LIFE.valid);
		const barred = await ingestImportedDecision(prisma, {
			actorId,
			idempotencyKey: "import-superseded-without-relation",
			origin: "human",
			payload: {
				decision: "Keep the board.",
				life: DECISION_LIFE.superseded,
				projectId,
				rationale: "Imported row.",
				title: "Board copy",
			},
		});
		expect(barred.status).toBe("committed");
		if (barred.status !== "committed") {
			return;
		}
		expect(barred.decision.life).toBe(DECISION_LIFE.valid);
		expect(importedDecisionLife(DECISION_LIFE.superseded)).toBe(
			DECISION_LIFE.valid
		);
	});

	it("has English Decision, Valid, and Withdrawn labels and no voting", () => {
		expect(DECISIONS_COPY.decision).toBe("Decision");
		expect(DECISIONS_COPY.valid).toBe("Valid");
		expect(DECISIONS_COPY.withdrawn).toBe("Withdrawn");
		expect(DECISIONS_COPY.withdraw).toBe("Withdraw");
		expect(DECISIONS_COPY.decisionText).toBe("Decision text");
		expect(DECISIONS_COPY.rationale).toBe("Rationale");
		expect(JSON.stringify(DECISIONS_COPY)).not.toMatch(VOTING_COPY);
		expect(DECISION_LIFE.superseded).toBe("Superseded");
	});
});
