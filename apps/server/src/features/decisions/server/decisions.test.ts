/**
 * Decisions seam — Project ana kayıt with title, decision
 * text, and rationale. Lives Valid, Superseded, Withdrawn.
 * Superseded is not a free status pick. Withdrawn is an
 * explicit dated action. Work close does not withdraw.
 * Missing imported life reads Valid. No alternative set,
 * voting, or automatic winner. Supersede another decision
 * previews then commits an acyclic single-successor chain.
 * docs/specs/38-decisions/spec.md and GitHub #275 #276 #277.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Karar ve belirsizlik).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	closeWork,
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";

import {
	createDecision,
	defaultPublicDecisionId,
	freezePublishedSnapshot,
	getDecision,
	ingestImportedDecision,
	listDecisions,
	previewClosedWorld,
	previewRemoveSupersession,
	previewSupersession,
	removeSupersession,
	resolvePublishedSnapshot,
	searchDecisions,
	setDecisionLife,
	supersedeDecisions,
	withdrawDecision,
} from "./decisions";
import {
	CLOSED_WORLD_ITEM_KIND,
	DECISION_LIFE,
	DECISIONS_COPY,
	importedDecisionLife,
	presentDecisionLife,
} from "./decisions-model";

const DATABASE_URL = localTestDatabaseUrl();

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
	await prisma.typedRelation.deleteMany();
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

async function committedDecision(
	prisma: PrismaClient,
	input: {
		actorId: string;
		decision: string;
		idempotencyKey: string;
		projectId: string;
		rationale: string;
		title: string;
	}
) {
	const created = await createDecision(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			decision: input.decision,
			projectId: input.projectId,
			rationale: input.rationale,
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.decision;
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
		expect(DECISIONS_COPY.supersedeAnotherDecision).toBe(
			"Supersede another decision"
		);
		expect(JSON.stringify(DECISIONS_COPY)).not.toMatch(VOTING_COPY);
		expect(DECISION_LIFE.superseded).toBe("Superseded");
	});

	it("previews then atomically supersedes without leaving two Valid Decisions", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const oldDecision = await committedDecision(prisma, {
			actorId,
			decision: "Use email login.",
			idempotencyKey: "create-old-login",
			projectId,
			rationale: "Email is familiar.",
			title: "Email login",
		});
		const successor = await committedDecision(prisma, {
			actorId,
			decision: "Use GitHub login.",
			idempotencyKey: "create-new-login",
			projectId,
			rationale: "One identity for the founder.",
			title: "GitHub login",
		});
		const preview = await previewSupersession(prisma, {
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
				transitionRationale: "GitHub covers the founder.",
			},
		});
		expect(preview.status).toBe("ok");
		if (preview.status !== "ok") {
			return;
		}
		expect(preview.preview.successor.title).toBe("GitHub login");
		expect(preview.preview.successor.rationale).toBe(
			"One identity for the founder."
		);
		expect(preview.preview.successor.life).toBe(DECISION_LIFE.valid);
		expect(preview.preview.successor.nextLife).toBe(DECISION_LIFE.valid);
		expect(preview.preview.superseded).toEqual([
			expect.objectContaining({
				id: oldDecision.id,
				life: DECISION_LIFE.valid,
				nextLife: DECISION_LIFE.superseded,
				rationale: "Email is familiar.",
				title: "Email login",
			}),
		]);
		expect(preview.preview.transitionRationale).toBe(
			"GitHub covers the founder."
		);
		expect(preview.preview.livesChanging).toEqual([
			{
				from: DECISION_LIFE.valid,
				id: oldDecision.id,
				title: "Email login",
				to: DECISION_LIFE.superseded,
			},
		]);
		const committed = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: successor.revision,
			idempotencyKey: "supersede-login",
			origin: "human",
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
				transitionRationale: "GitHub covers the founder.",
			},
		});
		expect(committed.status).toBe("committed");
		if (committed.status !== "committed") {
			return;
		}
		expect(committed.successor.life).toBe(DECISION_LIFE.valid);
		expect(committed.superseded).toEqual([
			expect.objectContaining({
				id: oldDecision.id,
				life: DECISION_LIFE.superseded,
			}),
		]);
		expect(await getDecision(prisma, oldDecision.id)).toEqual(
			expect.objectContaining({ life: DECISION_LIFE.superseded })
		);
		expect(await getDecision(prisma, successor.id)).toEqual(
			expect.objectContaining({ life: DECISION_LIFE.valid })
		);
		const replayed = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: successor.revision,
			idempotencyKey: "supersede-login",
			origin: "human",
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
				transitionRationale: "GitHub covers the founder.",
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			return;
		}
		expect(replayed.successor.id).toBe(successor.id);
		expect(replayed.superseded[0]?.life).toBe(DECISION_LIFE.superseded);
	});

	it("lets one Valid Decision fully replace several compatible old ones", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const first = await committedDecision(prisma, {
			actorId,
			decision: "Email.",
			idempotencyKey: "old-a",
			projectId,
			rationale: "A.",
			title: "A",
		});
		const second = await committedDecision(prisma, {
			actorId,
			decision: "Password.",
			idempotencyKey: "old-b",
			projectId,
			rationale: "B.",
			title: "B",
		});
		const successor = await committedDecision(prisma, {
			actorId,
			decision: "GitHub.",
			idempotencyKey: "new-ab",
			projectId,
			rationale: "Both.",
			title: "GitHub",
		});
		const committed = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: successor.revision,
			idempotencyKey: "replace-both",
			origin: "human",
			payload: {
				successorId: successor.id,
				supersededIds: [first.id, second.id],
				supersededRevisions: [
					{ id: first.id, revision: first.revision },
					{ id: second.id, revision: second.revision },
				],
			},
		});
		expect(committed.status).toBe("committed");
		if (committed.status !== "committed") {
			return;
		}
		expect(committed.superseded.map((row) => row.life)).toEqual([
			DECISION_LIFE.superseded,
			DECISION_LIFE.superseded,
		]);
		expect((await getDecision(prisma, first.id))?.life).toBe(
			DECISION_LIFE.superseded
		);
		expect((await getDecision(prisma, second.id))?.life).toBe(
			DECISION_LIFE.superseded
		);
		expect((await getDecision(prisma, successor.id))?.life).toBe(
			DECISION_LIFE.valid
		);
	});

	it("rejects self-link, cycle, and conflicting fork before apply", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const first = await committedDecision(prisma, {
			actorId,
			decision: "First.",
			idempotencyKey: "cycle-first",
			projectId,
			rationale: "One.",
			title: "First",
		});
		const second = await committedDecision(prisma, {
			actorId,
			decision: "Second.",
			idempotencyKey: "cycle-second",
			projectId,
			rationale: "Two.",
			title: "Second",
		});
		const third = await committedDecision(prisma, {
			actorId,
			decision: "Third.",
			idempotencyKey: "cycle-third",
			projectId,
			rationale: "Three.",
			title: "Third",
		});
		expect(
			await previewSupersession(prisma, {
				payload: {
					successorId: first.id,
					supersededIds: [first.id],
				},
			})
		).toEqual({ reason: "self-link", status: "rejected" });
		await prisma.typedRelation.create({
			data: {
				fromId: first.id,
				fromKind: "Decision",
				id: crypto.randomUUID(),
				revision: 1,
				toId: second.id,
				toKind: "Decision",
				type: RELATIONS_COPY.supersedes,
			},
		});
		expect(
			await previewSupersession(prisma, {
				payload: {
					successorId: second.id,
					supersededIds: [first.id],
				},
			})
		).toEqual({ reason: "cycle", status: "rejected" });
		expect(
			await supersedeDecisions(prisma, {
				actorId,
				baseRevision: second.revision,
				idempotencyKey: "cycle-apply",
				origin: "human",
				payload: {
					successorId: second.id,
					supersededIds: [first.id],
					supersededRevisions: [{ id: first.id, revision: first.revision }],
				},
			})
		).toEqual({ reason: "cycle", status: "rejected" });
		await prisma.typedRelation.deleteMany({
			where: { fromId: first.id, toId: second.id },
		});
		const firstReplace = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: second.revision,
			idempotencyKey: "first-replaces-second",
			origin: "human",
			payload: {
				successorId: second.id,
				supersededIds: [first.id],
				supersededRevisions: [{ id: first.id, revision: first.revision }],
			},
		});
		expect(firstReplace.status).toBe("committed");
		expect(
			await previewSupersession(prisma, {
				payload: {
					successorId: third.id,
					supersededIds: [first.id],
				},
			})
		).toEqual({ reason: "conflicting-fork", status: "rejected" });
		expect((await getDecision(prisma, first.id))?.life).toBe(
			DECISION_LIFE.superseded
		);
		expect((await getDecision(prisma, second.id))?.life).toBe(
			DECISION_LIFE.valid
		);
	});

	it("does not copy related Work or write Work status on supersession", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const oldDecision = await committedDecision(prisma, {
			actorId,
			decision: "Keep Postgres.",
			idempotencyKey: "pg-old",
			projectId,
			rationale: "Hosted Neon.",
			title: "Postgres",
		});
		const successor = await committedDecision(prisma, {
			actorId,
			decision: "Keep Postgres on Neon.",
			idempotencyKey: "pg-new",
			projectId,
			rationale: "Same store.",
			title: "Neon Postgres",
		});
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "pg-work",
			origin: "human",
			payload: { projectId, title: "Ship Neon" },
		});
		if (work.status !== "committed" && work.status !== "replayed") {
			throw new Error("expected work");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: "relate-work-decision",
			origin: "human",
			previewAcknowledged: true,
			to: { id: oldDecision.id, kind: "Decision" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		await prisma.typedRelation.create({
			data: {
				fromId: work.work.id,
				fromKind: "Work",
				id: crypto.randomUUID(),
				revision: 1,
				toId: oldDecision.id,
				toKind: "Decision",
				type: RELATIONS_COPY.evidence,
			},
		});
		expect((await getDecision(prisma, oldDecision.id))?.life).toBe(
			DECISION_LIFE.valid
		);
		const preview = await previewSupersession(prisma, {
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
			},
		});
		expect(preview.status).toBe("ok");
		if (preview.status === "ok") {
			expect(preview.preview.superseded[0]?.evidenceSummary).toEqual([
				"Ship Neon",
			]);
		}
		const committed = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: successor.revision,
			idempotencyKey: "supersede-pg",
			origin: "human",
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
			},
		});
		expect(committed.status).toBe("committed");
		const liveWork = await getWork(prisma, work.work.id);
		expect(liveWork?.status).toBe(WORK_STATUS.notStarted);
		const oldRelations = await listRelations(prisma, {
			record: { id: oldDecision.id, kind: "Decision" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			oldRelations.filter((row) => row.type === RELATIONS_COPY.related)
		).toHaveLength(1);
		const newRelations = await listRelations(prisma, {
			record: { id: successor.id, kind: "Decision" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			newRelations.filter((row) => row.type === RELATIONS_COPY.related)
		).toHaveLength(0);
		expect(
			newRelations.filter((row) => row.type === RELATIONS_COPY.supersedes)
		).toHaveLength(1);
	});

	it("previews remove and restores Valid without deleting the successor", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const oldDecision = await committedDecision(prisma, {
			actorId,
			decision: "Weekly.",
			idempotencyKey: "remove-old",
			projectId,
			rationale: "Cadence.",
			title: "Weekly",
		});
		const successor = await committedDecision(prisma, {
			actorId,
			decision: "Board cadence.",
			idempotencyKey: "remove-new",
			projectId,
			rationale: "Visible.",
			title: "Board",
		});
		const committed = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: successor.revision,
			idempotencyKey: "supersede-then-remove",
			origin: "human",
			payload: {
				successorId: successor.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
			},
		});
		if (committed.status !== "committed") {
			throw new Error("expected supersede");
		}
		expect(
			await removeSupersession(prisma, {
				actorId,
				baseRevision: committed.successor.revision,
				idempotencyKey: "remove-without-confirm",
				origin: "human",
				payload: {
					successorId: successor.id,
					supersededId: oldDecision.id,
				},
			})
		).toEqual({ reason: "preview-required", status: "rejected" });
		const preview = await previewRemoveSupersession(prisma, {
			payload: {
				successorId: successor.id,
				supersededId: oldDecision.id,
			},
		});
		expect(preview.status).toBe("ok");
		if (preview.status !== "ok") {
			return;
		}
		expect(preview.preview.wouldRestoreValid).toBe(true);
		expect(preview.preview.superseded.nextLife).toBe(DECISION_LIFE.valid);
		expect(preview.preview.successor.nextLife).toBe(DECISION_LIFE.valid);
		const removed = await removeSupersession(prisma, {
			actorId,
			baseRevision: committed.successor.revision,
			idempotencyKey: "remove-relation",
			origin: "human",
			payload: {
				confirm: true,
				successorId: successor.id,
				supersededId: oldDecision.id,
			},
		});
		expect(removed.status).toBe("committed");
		if (removed.status !== "committed") {
			return;
		}
		expect(removed.superseded.life).toBe(DECISION_LIFE.valid);
		expect(removed.successor.life).toBe(DECISION_LIFE.valid);
		expect(await getDecision(prisma, successor.id)).not.toBeNull();
		expect((await getDecision(prisma, oldDecision.id))?.life).toBe(
			DECISION_LIFE.valid
		);
	});

	it("puts Valid Decisions first and finds old or Withdrawn through the life filter", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const current = await committedDecision(prisma, {
			actorId,
			decision: "Use GitHub login.",
			idempotencyKey: "search-valid",
			projectId,
			rationale: "One identity.",
			title: "GitHub login",
		});
		const oldDecision = await committedDecision(prisma, {
			actorId,
			decision: "Use email login.",
			idempotencyKey: "search-old",
			projectId,
			rationale: "Email is familiar.",
			title: "Email login",
		});
		const withdrawn = await committedDecision(prisma, {
			actorId,
			decision: "Ship weekly.",
			idempotencyKey: "search-withdrawn",
			projectId,
			rationale: "Cadence.",
			title: "Weekly ship",
		});
		const withdrawnOutcome = await withdrawDecision(prisma, {
			actorId,
			baseRevision: withdrawn.revision,
			idempotencyKey: "withdraw-for-search",
			origin: "human",
			payload: { decisionId: withdrawn.id },
		});
		expect(withdrawnOutcome.status).toBe("committed");
		const replaced = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: current.revision,
			idempotencyKey: "supersede-for-search",
			origin: "human",
			payload: {
				successorId: current.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
			},
		});
		expect(replaced.status).toBe("committed");
		const listed = await listDecisions(prisma, projectId);
		expect(listed.map((item) => item.life)).toEqual([
			DECISION_LIFE.valid,
			DECISION_LIFE.superseded,
			DECISION_LIFE.withdrawn,
		]);
		expect(listed[0]?.title).toBe("GitHub login");
		const onlyValid = await listDecisions(prisma, projectId, {
			life: DECISION_LIFE.valid,
		});
		expect(onlyValid.map((item) => item.title)).toEqual(["GitHub login"]);
		const onlyOld = await listDecisions(prisma, projectId, {
			life: DECISION_LIFE.superseded,
		});
		expect(onlyOld.map((item) => item.title)).toEqual(["Email login"]);
		const onlyWithdrawn = await listDecisions(prisma, projectId, {
			life: DECISION_LIFE.withdrawn,
		});
		expect(onlyWithdrawn.map((item) => item.title)).toEqual(["Weekly ship"]);
		const searched = await searchDecisions(prisma, {
			projectId,
			text: "login",
		});
		expect(searched.map((item) => item.title)).toEqual([
			"GitHub login",
			"Email login",
		]);
		const searchedOld = await searchDecisions(prisma, {
			life: DECISION_LIFE.superseded,
			projectId,
			text: "login",
		});
		expect(searchedOld.map((item) => item.title)).toEqual(["Email login"]);
	});

	it("opens a Decision generation chain to the current Valid record, not event rows", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const oldest = await committedDecision(prisma, {
			actorId,
			decision: "Use email login.",
			idempotencyKey: "chain-oldest",
			projectId,
			rationale: "Email is familiar.",
			title: "Email login",
		});
		const middle = await committedDecision(prisma, {
			actorId,
			decision: "Use a password manager.",
			idempotencyKey: "chain-middle",
			projectId,
			rationale: "Fewer resets.",
			title: "Password manager",
		});
		const current = await committedDecision(prisma, {
			actorId,
			decision: "Use GitHub login.",
			idempotencyKey: "chain-current",
			projectId,
			rationale: "One identity.",
			title: "GitHub login",
		});
		const first = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: middle.revision,
			idempotencyKey: "chain-first-replace",
			origin: "human",
			payload: {
				successorId: middle.id,
				supersededIds: [oldest.id],
				supersededRevisions: [{ id: oldest.id, revision: oldest.revision }],
				transitionRationale: "Passwords were leaking.",
			},
		});
		expect(first.status).toBe("committed");
		const second = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: current.revision,
			idempotencyKey: "chain-second-replace",
			origin: "human",
			payload: {
				successorId: current.id,
				supersededIds: [middle.id],
				supersededRevisions: [
					{
						id: middle.id,
						revision:
							first.status === "committed" ? first.successor.revision : 0,
					},
				],
				transitionRationale: "GitHub covers the founder.",
			},
		});
		expect(second.status).toBe("committed");
		const events = await prisma.decisionEvent.findMany({
			where: { decisionId: { in: [oldest.id, middle.id, current.id] } },
		});
		expect(events.length).toBeGreaterThan(3);
		const loadedOld = await getDecision(prisma, oldest.id);
		expect(loadedOld?.chain.map((item) => item.title)).toEqual([
			"Email login",
			"Password manager",
			"GitHub login",
		]);
		expect(loadedOld?.chain.map((item) => item.id)).not.toEqual(
			expect.arrayContaining(events.map((event) => event.id))
		);
		expect(loadedOld?.currentDecision).toEqual({
			id: current.id,
			title: "GitHub login",
		});
		expect(loadedOld?.openCurrentDecisionId).toBe(current.id);
		expect(loadedOld?.contentReadOnly).toBe(true);
		expect(loadedOld?.transitionRationale).toBe("Passwords were leaking.");
		expect(loadedOld?.transitionOccurredAt).toMatch(ISO_INSTANT);
		const loadedCurrent = await getDecision(prisma, current.id);
		expect(loadedCurrent?.chain.map((item) => item.title)).toEqual([
			"Email login",
			"Password manager",
			"GitHub login",
		]);
		expect(loadedCurrent?.openCurrentDecisionId).toBe(current.id);
		expect(loadedCurrent?.contentReadOnly).toBe(false);
		expect(DECISIONS_COPY.openCurrentDecision).toBe("Open current decision");
		expect(DECISIONS_COPY.allDecisions).toBe("All Decisions");
	});

	it("previews old Decision, current Decision, and supersession as separate closed-world items and does not retarget an approved snapshot", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const oldDecision = await committedDecision(prisma, {
			actorId,
			decision: "Use email login.",
			idempotencyKey: "world-old",
			projectId,
			rationale: "Email is familiar.",
			title: "Email login",
		});
		const snapshot = freezePublishedSnapshot(oldDecision);
		expect(snapshot.includedDecisionId).toBe(oldDecision.id);
		const current = await committedDecision(prisma, {
			actorId,
			decision: "Use GitHub login.",
			idempotencyKey: "world-current",
			projectId,
			rationale: "One identity.",
			title: "GitHub login",
		});
		const replaced = await supersedeDecisions(prisma, {
			actorId,
			baseRevision: current.revision,
			idempotencyKey: "world-replace",
			origin: "human",
			payload: {
				successorId: current.id,
				supersededIds: [oldDecision.id],
				supersededRevisions: [
					{ id: oldDecision.id, revision: oldDecision.revision },
				],
			},
		});
		expect(replaced.status).toBe("committed");
		const preview = await previewClosedWorld(prisma, oldDecision.id);
		expect(preview.map((item) => item.kind)).toEqual([
			CLOSED_WORLD_ITEM_KIND.decision,
			CLOSED_WORLD_ITEM_KIND.decision,
			CLOSED_WORLD_ITEM_KIND.supersedes,
		]);
		expect(preview).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: oldDecision.id,
					kind: CLOSED_WORLD_ITEM_KIND.decision,
					title: "Email login",
				}),
				expect.objectContaining({
					id: current.id,
					kind: CLOSED_WORLD_ITEM_KIND.decision,
					title: "GitHub login",
				}),
				expect.objectContaining({
					fromId: current.id,
					kind: CLOSED_WORLD_ITEM_KIND.supersedes,
					toId: oldDecision.id,
				}),
			])
		);
		expect(new Set(preview.map((item) => item.id)).size).toBe(3);
		const liveOld = await getDecision(prisma, oldDecision.id);
		expect(liveOld).not.toBeNull();
		if (!liveOld) {
			return;
		}
		expect(resolvePublishedSnapshot(snapshot, liveOld)).toEqual({
			decisionId: oldDecision.id,
			redirected: false,
			silentlyUpdated: false,
		});
		expect(defaultPublicDecisionId(liveOld)).toBe(current.id);
	});
});
