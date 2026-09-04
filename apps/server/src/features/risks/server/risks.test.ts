/**
 * Risks seam — Project ana kayıt with title, description,
 * impact, probability, and response/mitigation. Status is
 * Open, Mitigating, Occurred, Resolved, or Accepted, only
 * via explicit action. Accepted keeps the known Risk with
 * rationale. Not a Bug, Test Gap, or Production Incident.
 * Impact and probability are not a priority score.
 * docs/specs/40-risks/spec.md and GitHub #301.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Karar ve belirsizlik).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";

import { createRisk, getRisk, listRisks, setRiskStatus } from "./risks";
import { FOREIGN_RECORD_KINDS, RISK_STATUS, RISKS_COPY } from "./risks-model";

const DATABASE_URL = localTestDatabaseUrl();

const SCORE_COPY = /priority score|wsjf|risk score|health verdict/i;

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
	await prisma.risk.deleteMany();
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

async function committedRisk(
	prisma: PrismaClient,
	input: {
		actorId: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
) {
	const created = await createRisk(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			description: "Login depends on GitHub.",
			impact: "Founder cannot sign in.",
			probability: "Likely during an outage.",
			projectId: input.projectId,
			response: "Keep a backup identity path.",
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.risk;
}

describe("Risks", () => {
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

	it("creates a Risk as a Project record that is Open", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const outcome = await createRisk(prisma, {
			actorId,
			idempotencyKey: "create-github-outage",
			origin: "human",
			payload: {
				description: "GitHub outage during login.",
				impact: "Founder cannot sign in.",
				probability: "Rare but blocking.",
				projectId,
				response: "Document a backup path.",
				title: "GitHub outage during login",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			return;
		}
		expect(outcome.risk.recordKind).toBe(RISKS_COPY.risk);
		expect(outcome.risk.title).toBe("GitHub outage during login");
		expect(outcome.risk.description).toBe("GitHub outage during login.");
		expect(outcome.risk.impact).toBe("Founder cannot sign in.");
		expect(outcome.risk.probability).toBe("Rare but blocking.");
		expect(outcome.risk.response).toBe("Document a backup path.");
		expect(outcome.risk.status).toBe(RISK_STATUS.open);
		expect(outcome.risk.projectId).toBe(projectId);
		expect(outcome.risk.acceptanceRationale).toBeNull();
		const listed = await listRisks(prisma, projectId);
		expect(listed).toEqual([outcome.risk]);
		const loaded = await getRisk(prisma, outcome.risk.id);
		expect(loaded).toEqual(outcome.risk);
		expect(loaded?.status).toBe(RISK_STATUS.open);
	});

	it("changes status only through the explicit set-status action", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedRisk(prisma, {
			actorId,
			idempotencyKey: "create-then-status",
			projectId,
			title: "Provider outage",
		});
		expect(created.status).toBe(RISK_STATUS.open);
		const mitigating = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "set-mitigating",
			origin: "human",
			payload: {
				riskId: created.id,
				status: RISK_STATUS.mitigating,
			},
		});
		expect(mitigating.status).toBe("committed");
		if (mitigating.status !== "committed") {
			return;
		}
		expect(mitigating.risk.status).toBe(RISK_STATUS.mitigating);
		const occurred = await setRiskStatus(prisma, {
			actorId,
			baseRevision: mitigating.risk.revision,
			idempotencyKey: "set-occurred",
			origin: "human",
			payload: {
				riskId: created.id,
				status: RISK_STATUS.occurred,
			},
		});
		expect(occurred.status).toBe("committed");
		if (occurred.status !== "committed") {
			return;
		}
		expect(occurred.risk.status).toBe(RISK_STATUS.occurred);
		const resolved = await setRiskStatus(prisma, {
			actorId,
			baseRevision: occurred.risk.revision,
			idempotencyKey: "set-resolved",
			origin: "human",
			payload: {
				riskId: created.id,
				status: RISK_STATUS.resolved,
			},
		});
		expect(resolved.status).toBe("committed");
		if (resolved.status !== "committed") {
			return;
		}
		expect(resolved.risk.status).toBe(RISK_STATUS.resolved);
		const accepted = await setRiskStatus(prisma, {
			actorId,
			baseRevision: resolved.risk.revision,
			idempotencyKey: "set-accepted",
			origin: "human",
			payload: {
				rationale: "Keep shipping with a known outage.",
				riskId: created.id,
				status: RISK_STATUS.accepted,
			},
		});
		expect(accepted.status).toBe("committed");
		if (accepted.status !== "committed") {
			return;
		}
		expect(accepted.risk.status).toBe(RISK_STATUS.accepted);
		expect(accepted.risk.recordKind).toBe(RISKS_COPY.risk);
		const reopened = await setRiskStatus(prisma, {
			actorId,
			baseRevision: accepted.risk.revision,
			idempotencyKey: "set-open",
			origin: "human",
			payload: {
				riskId: created.id,
				status: RISK_STATUS.open,
			},
		});
		expect(reopened.status).toBe("committed");
		if (reopened.status !== "committed") {
			return;
		}
		expect(reopened.risk.status).toBe(RISK_STATUS.open);
		const barred = await setRiskStatus(prisma, {
			actorId,
			baseRevision: reopened.risk.revision,
			idempotencyKey: "set-closed",
			origin: "human",
			payload: {
				riskId: created.id,
				status: "Closed" as never,
			},
		});
		expect(barred).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
	});

	it("keeps an Accepted Risk as a known record with rationale", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await committedRisk(prisma, {
			actorId,
			idempotencyKey: "create-to-accept",
			projectId,
			title: "Single region",
		});
		const missingRationale = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "accept-without-rationale",
			origin: "human",
			payload: {
				riskId: created.id,
				status: RISK_STATUS.accepted,
			},
		});
		expect(missingRationale).toEqual({
			reason: "rationale-required",
			status: "rejected",
		});
		const accepted = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "accept-with-rationale",
			origin: "human",
			payload: {
				rationale: "Capacity is enough for one founder.",
				riskId: created.id,
				status: RISK_STATUS.accepted,
			},
		});
		expect(accepted.status).toBe("committed");
		if (accepted.status !== "committed") {
			return;
		}
		expect(accepted.risk.status).toBe(RISK_STATUS.accepted);
		expect(accepted.risk.acceptanceRationale).toBe(
			"Capacity is enough for one founder."
		);
		expect(accepted.risk.id).toBe(created.id);
		expect(accepted.risk.recordKind).toBe(RISKS_COPY.risk);
		const listed = await listRisks(prisma, projectId);
		expect(listed.map((item) => item.id)).toEqual([created.id]);
		expect(listed[0]?.status).toBe(RISK_STATUS.accepted);
	});

	it("does not mix Risk with Bug, Test Gap, or Production Incident", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const outcomes = await Promise.all(
			FOREIGN_RECORD_KINDS.map((kind) =>
				createRisk(prisma, {
					actorId,
					idempotencyKey: `create-as-${kind}`,
					origin: "human",
					payload: {
						description: "Outage.",
						impact: "High.",
						kind,
						probability: "High.",
						projectId,
						response: "Watch.",
						title: kind,
					},
				})
			)
		);
		expect(outcomes).toEqual([
			{ reason: "invalid-command", status: "rejected" },
			{ reason: "invalid-command", status: "rejected" },
			{ reason: "invalid-command", status: "rejected" },
		]);
		const created = await committedRisk(prisma, {
			actorId,
			idempotencyKey: "create-plain-risk",
			projectId,
			title: "Provider outage",
		});
		expect(created.recordKind).toBe(RISKS_COPY.risk);
		expect(FOREIGN_RECORD_KINDS).not.toContain(created.recordKind);
	});

	it("does not turn impact or probability into a priority score", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createRisk(prisma, {
			actorId,
			idempotencyKey: "create-high-impact",
			origin: "human",
			payload: {
				description: "Outage.",
				impact: "Very high",
				probability: "Very high",
				projectId,
				response: "Watch.",
				title: "Outage",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.risk.impact).toBe("Very high");
		expect(created.risk.probability).toBe("Very high");
		expect(created.risk).not.toHaveProperty("score");
		expect(created.risk).not.toHaveProperty("priorityScore");
		expect(JSON.stringify(created.risk)).not.toMatch(SCORE_COPY);
		expect(JSON.stringify(RISKS_COPY)).not.toMatch(SCORE_COPY);
		expect(RISKS_COPY.risk).toBe("Risk");
		expect(RISKS_COPY.open).toBe("Open");
		expect(RISKS_COPY.mitigating).toBe("Mitigating");
		expect(RISKS_COPY.occurred).toBe("Occurred");
		expect(RISKS_COPY.resolved).toBe("Resolved");
		expect(RISKS_COPY.accepted).toBe("Accepted");
		expect(RISKS_COPY.impact).toBe("Impact");
		expect(RISKS_COPY.probability).toBe("Probability");
		expect(RISKS_COPY.responseMitigation).toBe("Response/mitigation");
	});
});
