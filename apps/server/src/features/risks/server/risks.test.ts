/**
 * Risks seam — Project ana kayıt with title, description,
 * impact, probability, and response/mitigation. Status is
 * Open, Mitigating, Occurred, Resolved, or Accepted, only
 * via explicit action. Accepted keeps the known Risk with
 * rationale. Not a Bug, Test Gap, or Production Incident.
 * Impact and probability are not a priority score.
 * docs/specs/40-risks/spec.md and GitHub #301.
 * counterparts: related Work still open, Release not failed,
 * `open-risk` only on the two events.
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFocusPeriod } from "../../focus-period/server/focus-period";
import { FOCUS_PERIOD_STATUS } from "../../focus-period/server/focus-period-model";
import {
	createProject,
	getProject,
} from "../../project-shell/server/project-shell";
import { PROJECT_LIFECYCLE } from "../../project-shell/server/project-shell-model";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import { ACTION_REQUIRED_SIGNAL_IDS } from "../../workspace-overview/server/workspace-overview";

import {
	createRisk,
	getRisk,
	listOpenRiskSignals,
	listRiskRelatedRecords,
	listRisks,
	relateRisk,
	risksCounterparts,
	setRiskStatus,
} from "./risks";
import {
	FOREIGN_RECORD_KINDS,
	OPEN_RISK_SIGNAL_ID,
	OPEN_RISK_SIGNAL_SECTION,
	OPEN_RISK_SOURCE_EVENT,
	RISK_RELATED_KIND,
	RISK_STATUS,
	RISKS_COPY,
	RISKS_COUNTERPARTS,
} from "./risks-model";

const DATABASE_URL = localTestDatabaseUrl();

const SCORE_COPY = /priority score|wsjf|risk score|health verdict/i;
const HEALTH_VERDICT = /health verdict|project health|risk score/i;
const FAILED_RELEASE = "Failed";
const START_INSTANT = new Date("2026-09-07T21:00:00.000Z");
const BEFORE_START = new Date("2026-09-01T12:00:00.000Z");

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
	await prisma.risk.deleteMany();
	await prisma.focusPeriodMembership.deleteMany();
	await prisma.focusPeriod.deleteMany();
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

async function committedWork(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string; title: string }
) {
	const created = await createWork(prisma, {
		actorId: input.actorId,
		idempotencyKey: `create-work-${input.title}-${crypto.randomUUID()}`,
		origin: "human",
		payload: { projectId: input.projectId, title: input.title },
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected work");
	}
	return created.work;
}

async function openFocusPeriod(
	prisma: PrismaClient,
	input: {
		actorId: string;
		now: Date;
		purpose: string;
		workspaceId: string;
	}
) {
	const surface = createFocusPeriod({
		accountId: input.actorId,
		clock: { now: () => input.now },
		prisma,
		workspaceId: input.workspaceId,
	});
	const created = await surface.create({
		endDate: "2026-09-21",
		idempotencyKey: `focus-${input.purpose}-${crypto.randomUUID()}`,
		purpose: input.purpose,
		startDate: "2026-09-08",
	});
	if (created.status !== "committed") {
		throw new Error("expected focus period");
	}
	const viewed = await surface.get(created.period.id);
	if (!viewed) {
		throw new Error("expected focus period view");
	}
	return viewed;
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

	it("does not write related Work, Project Release, or Project life on Accepted, Occurred, or Resolved", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await committedRisk(prisma, {
			actorId,
			idempotencyKey: "create-isolated",
			projectId,
			title: "GitHub outage",
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Backup login",
		});
		const relatedWork = await createRelation(prisma, {
			actorId,
			from: { id: work.id, kind: "Work" },
			idempotencyKey: "relate-work-risk",
			origin: "human",
			previewAcknowledged: true,
			to: { id: created.id, kind: "Risk" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(relatedWork.status).toBe("committed");
		const linkedRelease = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-release",
			origin: "human",
			payload: {
				inPublishPrep: true,
				kind: RISK_RELATED_KIND.projectRelease,
				releaseStatus: "In publish prep",
				riskId: created.id,
				targetId: "release-payments",
			},
		});
		expect(linkedRelease.status).toBe("committed");
		const workCount = (await listWork(prisma, projectId)).length;
		const occurred = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.revision,
			idempotencyKey: "occur-isolated",
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
		expect((await getWork(prisma, work.id))?.status).toBe(
			WORK_STATUS.notStarted
		);
		expect((await getProject(prisma, projectId))?.lifecycleStatus).toBe(
			PROJECT_LIFECYCLE.active
		);
		expect(
			(await listRiskRelatedRecords(prisma, created.id))[0]?.releaseStatus
		).toBe("In publish prep");
		const resolved = await setRiskStatus(prisma, {
			actorId,
			baseRevision: occurred.risk.revision,
			idempotencyKey: "resolve-isolated",
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
		const accepted = await setRiskStatus(prisma, {
			actorId,
			baseRevision: resolved.risk.revision,
			idempotencyKey: "accept-isolated",
			origin: "human",
			payload: {
				rationale: "Ship with a known outage.",
				riskId: created.id,
				status: RISK_STATUS.accepted,
			},
		});
		expect(accepted.status).toBe("committed");
		if (accepted.status !== "committed") {
			return;
		}
		expect((await getWork(prisma, work.id))?.status).toBe(
			WORK_STATUS.notStarted
		);
		expect((await getWork(prisma, work.id))?.closureResult).toBeNull();
		expect((await listWork(prisma, projectId)).length).toBe(workCount);
		expect((await getProject(prisma, projectId))?.lifecycleStatus).toBe(
			PROJECT_LIFECYCLE.active
		);
		const related = await listRiskRelatedRecords(prisma, created.id);
		expect(related).toHaveLength(1);
		expect(related[0]?.releaseStatus).toBe("In publish prep");
		expect(related[0]?.releaseStatus).not.toBe(FAILED_RELEASE);
		expect(risksCounterparts()).toEqual(RISKS_COUNTERPARTS);
		expect(RISKS_COUNTERPARTS.acceptIsPublishGate).toBe(false);
		expect(RISKS_COUNTERPARTS.autoWorkClose).toBe(false);
	});

	it("produces open-risk when a Risk enters Open, with source event, impact, and probability", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createRisk(prisma, {
			actorId,
			idempotencyKey: "create-open-signal",
			origin: "human",
			payload: {
				description: "Login depends on GitHub.",
				impact: "Founder cannot sign in.",
				probability: "Likely during an outage.",
				projectId,
				response: "Keep a backup identity path.",
				title: "GitHub outage during login",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.emissions).toHaveLength(1);
		expect(created.emissions[0]).toMatchObject({
			followUpWork: false,
			healthVerdict: false,
			impact: "Founder cannot sign in.",
			probability: "Likely during an outage.",
			riskId: created.risk.id,
			section: OPEN_RISK_SIGNAL_SECTION,
			signalId: OPEN_RISK_SIGNAL_ID,
			sourceEventKind: OPEN_RISK_SOURCE_EVENT.enteredOpen,
		});
		expect(created.emissions[0]?.sourceEventId).toEqual(expect.any(String));
		expect(ACTION_REQUIRED_SIGNAL_IDS).toContain(OPEN_RISK_SIGNAL_ID);
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toEqual(
			created.emissions
		);
		const replayed = await createRisk(prisma, {
			actorId,
			idempotencyKey: "create-open-signal",
			origin: "human",
			payload: {
				description: "Login depends on GitHub.",
				impact: "Founder cannot sign in.",
				probability: "Likely during an outage.",
				projectId,
				response: "Keep a backup identity path.",
				title: "GitHub outage during login",
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			return;
		}
		expect(replayed.emissions).toEqual(created.emissions);
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(1);
		const accepted = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.risk.revision,
			idempotencyKey: "accept-then-reopen",
			origin: "human",
			payload: {
				rationale: "Known outage.",
				riskId: created.risk.id,
				status: RISK_STATUS.accepted,
			},
		});
		expect(accepted.status).toBe("committed");
		if (accepted.status !== "committed") {
			return;
		}
		expect(accepted.emissions).toEqual([]);
		const reopened = await setRiskStatus(prisma, {
			actorId,
			baseRevision: accepted.risk.revision,
			idempotencyKey: "reopen-open-signal",
			origin: "human",
			payload: {
				riskId: created.risk.id,
				status: RISK_STATUS.open,
			},
		});
		expect(reopened.status).toBe("committed");
		if (reopened.status !== "committed") {
			return;
		}
		expect(reopened.emissions).toHaveLength(1);
		expect(reopened.emissions[0]?.sourceEventKind).toBe(
			OPEN_RISK_SOURCE_EVENT.enteredOpen
		);
		expect(reopened.emissions[0]?.sourceEventId).not.toBe(
			created.emissions[0]?.sourceEventId
		);
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(2);
		expect(JSON.stringify(reopened.emissions)).not.toMatch(HEALTH_VERDICT);
		expect((await listWork(prisma, projectId)).length).toBe(0);
	});

	it("produces open-risk when an Open Risk is related to a publish-prep Project Release or an active Focus Period", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await committedRisk(prisma, {
			actorId,
			idempotencyKey: "create-for-relate-signal",
			projectId,
			title: "GitHub outage",
		});
		expect(await listOpenRiskSignals(prisma, created.id)).toHaveLength(1);
		const release = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-publish-prep",
			origin: "human",
			payload: {
				inPublishPrep: true,
				kind: RISK_RELATED_KIND.projectRelease,
				releaseStatus: "In publish prep",
				riskId: created.id,
				targetId: "release-v1",
			},
		});
		expect(release.status).toBe("committed");
		if (release.status !== "committed") {
			return;
		}
		expect(release.emissions).toHaveLength(1);
		expect(release.emissions[0]).toMatchObject({
			impact: created.impact,
			probability: created.probability,
			riskId: created.id,
			signalId: OPEN_RISK_SIGNAL_ID,
			sourceEventId: release.related.id,
			sourceEventKind: OPEN_RISK_SOURCE_EVENT.relatedToPublishPrepRelease,
		});
		const active = await openFocusPeriod(prisma, {
			actorId,
			now: START_INSTANT,
			purpose: "Ship login",
			workspaceId,
		});
		expect(active.status).toBe(FOCUS_PERIOD_STATUS.active);
		const focus = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-active-focus",
			origin: "human",
			payload: {
				kind: RISK_RELATED_KIND.focusPeriod,
				riskId: created.id,
				targetId: active.id,
			},
		});
		expect(focus.status).toBe("committed");
		if (focus.status !== "committed") {
			return;
		}
		expect(focus.emissions).toHaveLength(1);
		expect(focus.emissions[0]?.sourceEventKind).toBe(
			OPEN_RISK_SOURCE_EVENT.relatedToActiveFocusPeriod
		);
		expect(await listOpenRiskSignals(prisma, created.id)).toHaveLength(3);
	});

	it("does not produce open-risk from time, Mitigating, high impact or probability, or Project-only presence", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await createRisk(prisma, {
			actorId,
			idempotencyKey: "create-high-for-negatives",
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
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(1);
		const listedAgain = await listOpenRiskSignals(prisma, created.risk.id);
		expect(listedAgain).toHaveLength(1);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Watch the outage",
		});
		const relatedWork = await createRelation(prisma, {
			actorId,
			from: { id: work.id, kind: "Work" },
			idempotencyKey: "relate-work-only",
			origin: "human",
			previewAcknowledged: true,
			to: { id: created.risk.id, kind: "Risk" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(relatedWork.status).toBe("committed");
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(1);
		const mitigating = await setRiskStatus(prisma, {
			actorId,
			baseRevision: created.risk.revision,
			idempotencyKey: "set-mitigating-no-signal",
			origin: "human",
			payload: {
				riskId: created.risk.id,
				status: RISK_STATUS.mitigating,
			},
		});
		expect(mitigating.status).toBe("committed");
		if (mitigating.status !== "committed") {
			return;
		}
		expect(mitigating.emissions).toEqual([]);
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(1);
		const prepWhileMitigating = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-prep-while-mitigating",
			origin: "human",
			payload: {
				inPublishPrep: true,
				kind: RISK_RELATED_KIND.projectRelease,
				riskId: created.risk.id,
				targetId: "release-not-open",
			},
		});
		expect(prepWhileMitigating.status).toBe("committed");
		if (prepWhileMitigating.status !== "committed") {
			return;
		}
		expect(prepWhileMitigating.emissions).toEqual([]);
		const notPrep = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-not-prep",
			origin: "human",
			payload: {
				inPublishPrep: false,
				kind: RISK_RELATED_KIND.projectRelease,
				riskId: created.risk.id,
				targetId: "release-shipped",
			},
		});
		expect(notPrep.status).toBe("committed");
		if (notPrep.status !== "committed") {
			return;
		}
		expect(notPrep.emissions).toEqual([]);
		const planned = await openFocusPeriod(prisma, {
			actorId,
			now: BEFORE_START,
			purpose: "Later window",
			workspaceId,
		});
		expect(planned.status).toBe(FOCUS_PERIOD_STATUS.planned);
		const plannedLink = await relateRisk(prisma, {
			actorId,
			idempotencyKey: "relate-planned-focus",
			origin: "human",
			payload: {
				kind: RISK_RELATED_KIND.focusPeriod,
				riskId: created.risk.id,
				targetId: planned.id,
			},
		});
		expect(plannedLink.status).toBe("committed");
		if (plannedLink.status !== "committed") {
			return;
		}
		expect(plannedLink.emissions).toEqual([]);
		expect(await listOpenRiskSignals(prisma, created.risk.id)).toHaveLength(1);
		expect(RISKS_COUNTERPARTS.followUpWork).toBe(false);
		expect(RISKS_COUNTERPARTS.healthVerdict).toBe(false);
	});
});
