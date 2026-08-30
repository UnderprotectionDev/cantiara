/**
 * Record Actions seam — closed catalog of field and membership
 * steps, named single-target definition, Start Work example,
 * forbidden-step counterparts, and trash ineffectiveness.
 * Bulk Editing is a counterpart, not this catalog.
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_ACTOR } from "../../mutation-core/server/mutation-shared";
import { createProject } from "../../project-shell/server/project-shell";
import {
	changeWorkStatus,
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	defineRecordAction,
	listRecordActions,
	resolveRecordAction,
	trashRecordAction,
} from "./record-actions";
import {
	FORBIDDEN_RECORD_ACTION_STEP_KINDS,
	RECORD_ACTION_COPY,
	RECORD_ACTION_STEP_KINDS,
	recordActionsCatalog,
	START_WORK_STEPS,
} from "./record-actions-model";
import {
	applyRecordAction,
	previewRecordAction,
	undoRecordAction,
} from "./record-actions-run";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FORBIDDEN_SURFACE =
	/javascript|free script|outbound HTTP|webhook marketplace|macro marketplace|bulk edit|multi-record button|createRecord|githubMutation/i;

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

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: "create-payments",
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

describe("Record Actions", () => {
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

	it("exposes English Record Action copy and a closed field catalog without script or GitHub steps", () => {
		const catalog = recordActionsCatalog();
		expect(catalog.copy.recordAction).toBe("Record Action");
		expect(catalog.copy.startWork).toBe("Start Work");
		expect(RECORD_ACTION_COPY.recordAction).toBe("Record Action");
		expect(RECORD_ACTION_COPY.startWork).toBe("Start Work");
		expect(catalog.stepKinds).toEqual(RECORD_ACTION_STEP_KINDS);
		expect(catalog.stepKinds).toEqual([
			"setWorkStatus",
			"dailyFocusMembership",
			"setExistingField",
		]);
		expect(catalog.runActor).toBe(MUTATION_ACTOR.user);
		expect(catalog.targetKind).toBe("Work");
		expect(catalog.examples.startWork.name).toBe("Start Work");
		expect(catalog.examples.startWork.steps).toEqual([
			{ kind: "setWorkStatus", status: WORK_STATUS.inProgress },
			{ kind: "dailyFocusMembership", operation: "add" },
		]);
		expect(FORBIDDEN_RECORD_ACTION_STEP_KINDS).toEqual([
			"javascript",
			"http",
			"createRecord",
			"githubMutation",
			"bulkEdit",
		]);
		for (const forbidden of FORBIDDEN_RECORD_ACTION_STEP_KINDS) {
			expect(catalog.stepKinds).not.toContain(forbidden);
		}
		expect(JSON.stringify(catalog.stepKinds)).not.toMatch(FORBIDDEN_SURFACE);
	});

	it("defines Start Work as status In Progress plus Daily Focus membership on one Work", async () => {
		const { actorId, project } = await openPayments(prisma);
		const outcome = await defineRecordAction(prisma, {
			actorId,
			idempotencyKey: "start-work",
			origin: "human",
			payload: {
				name: RECORD_ACTION_COPY.startWork,
				projectId: project.id,
				steps: [...START_WORK_STEPS],
				targetKind: "Work",
			},
		});
		expect(outcome.status).toBe("committed");
		if (outcome.status !== "committed") {
			throw new Error("expected committed Record Action");
		}
		expect(outcome.action.name).toBe("Start Work");
		expect(outcome.action.actor).toBe("User");
		expect(outcome.action.targetKind).toBe("Work");
		expect(outcome.action.steps).toEqual([
			{ kind: "setWorkStatus", status: "In Progress" },
			{ kind: "dailyFocusMembership", operation: "add" },
		]);
		const listed = await listRecordActions(prisma, project.id);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.name).toBe("Start Work");
		const resolved = await resolveRecordAction(prisma, {
			recordActionId: outcome.action.id,
			targetRecordId: "work-one",
		});
		expect(resolved).toEqual({
			resolved: {
				actor: "User",
				definition: outcome.action,
				targetKind: "Work",
				targetRecordId: "work-one",
			},
			status: "ok",
		});
	});

	it("rejects JavaScript, HTTP, new record, and GitHub mutation steps", async () => {
		const { actorId, project } = await openPayments(prisma);
		const outcomes = await Promise.all(
			(["javascript", "http", "createRecord", "githubMutation"] as const).map(
				(kind) =>
					defineRecordAction(prisma, {
						actorId,
						idempotencyKey: `forbidden-${kind}`,
						origin: "human",
						payload: {
							name: "Unsafe",
							projectId: project.id,
							steps: [{ kind }],
						},
					})
			)
		);
		expect(outcomes).toEqual([
			{ reason: "forbidden-step", status: "rejected" },
			{ reason: "forbidden-step", status: "rejected" },
			{ reason: "forbidden-step", status: "rejected" },
			{ reason: "forbidden-step", status: "rejected" },
		]);
	});

	it("rejects a combined action aimed at more than one record", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			await defineRecordAction(prisma, {
				actorId,
				idempotencyKey: "multi",
				origin: "human",
				payload: {
					name: RECORD_ACTION_COPY.startWork,
					projectId: project.id,
					steps: [...START_WORK_STEPS],
					targetRecordIds: ["work-a", "work-b"],
				},
			})
		).toEqual({ reason: "multi-target", status: "rejected" });
		const defined = await defineRecordAction(prisma, {
			actorId,
			idempotencyKey: "single",
			origin: "human",
			payload: {
				name: RECORD_ACTION_COPY.startWork,
				projectId: project.id,
				steps: [...START_WORK_STEPS],
			},
		});
		if (defined.status !== "committed") {
			throw new Error("expected committed Record Action");
		}
		expect(
			await resolveRecordAction(prisma, {
				recordActionId: defined.action.id,
				targetRecordId: "work-a",
				targetRecordIds: ["work-a", "work-b"],
			})
		).toEqual({ reason: "multi-target", status: "rejected" });
	});

	it("does not treat bulk field editing as a named combined action", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			await defineRecordAction(prisma, {
				actorId,
				idempotencyKey: "bulk",
				origin: "human",
				payload: {
					name: "Status sweep",
					projectId: project.id,
					steps: [{ kind: "bulkEdit" }],
				},
			})
		).toEqual({ reason: "bulk-edit-not-allowed", status: "rejected" });
		expect(recordActionsCatalog().copy.bulkEditNotAllowed).toBe(
			"Bulk field editing is not a named Record Action. Multi-record field updates stay Bulk Editing."
		);
	});

	it("keeps a trashed Record Action from being effective", async () => {
		const { actorId, project } = await openPayments(prisma);
		const defined = await defineRecordAction(prisma, {
			actorId,
			idempotencyKey: "start-work",
			origin: "human",
			payload: {
				name: RECORD_ACTION_COPY.startWork,
				projectId: project.id,
				steps: [...START_WORK_STEPS],
			},
		});
		if (defined.status !== "committed") {
			throw new Error("expected committed Record Action");
		}
		const trashed = await trashRecordAction(prisma, {
			actorId,
			idempotencyKey: "trash-start",
			origin: "human",
			payload: { recordActionId: defined.action.id },
		});
		expect(trashed.status).toBe("committed");
		expect(await listRecordActions(prisma, project.id)).toEqual([]);
		expect(
			await resolveRecordAction(prisma, {
				recordActionId: defined.action.id,
				targetRecordId: "work-one",
			})
		).toEqual({ reason: "trashed-not-effective", status: "rejected" });
	});

	it("does not apply a Record Action until the founder explicitly starts it", async () => {
		const { actorId, project } = await openPayments(prisma);
		const action = await committedAction(prisma, actorId, project.id);
		const work = await committedWork(prisma, actorId, project.id, "Alpha");
		expect(work.status).toBe("Not Started");
		expect(
			await applyRecordAction(prisma, {
				actorId,
				baseRevision: work.revision,
				idempotencyKey: "silent",
				origin: "human",
				payload: {
					recordActionId: action.id,
					targetRecordId: work.id,
				},
			})
		).toEqual({ reason: "explicit-start-required", status: "rejected" });
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		const previewed = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		expect(previewed.preview.copy).toEqual({
			apply: "Apply",
			finalizing: "Finalizing",
			preview: "Preview",
			start: "Start",
		});
	});

	it("applies the previewed Start Work diff atomically and replays the same key", async () => {
		const { actorId, project } = await openPayments(prisma);
		const action = await committedAction(prisma, actorId, project.id);
		const work = await committedWork(prisma, actorId, project.id, "Alpha");
		const previewed = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(previewed.preview.fields).toEqual([
			{
				from: "Not Started",
				id: "status",
				label: "Set Work status",
				to: "In Progress",
			},
			{
				from: "Not in Daily Focus",
				id: "dailyFocusMembership",
				label: "Add to Daily Focus",
				to: "In Daily Focus",
			},
		]);
		expect(previewed.preview.actor).toBe("User");
		const applied = await applyRecordAction(prisma, {
			actorId,
			baseRevision: previewed.preview.baseRevision,
			idempotencyKey: "apply-start",
			origin: "human",
			payload: {
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				recordActionId: action.id,
				targetRecordId: work.id,
			},
		});
		expect(applied.status).toBe("committed");
		if (applied.status !== "committed") {
			throw new Error("expected committed apply");
		}
		expect(applied.run.fields).toEqual(previewed.preview.fields);
		expect(applied.run.actor).toBe("User");
		expect(applied.ui).toEqual({
			cancelAvailable: false,
			label: "Finalizing",
		});
		expect(applied.run.undo).toBe("Undo");
		expect((await getWork(prisma, work.id))?.status).toBe("In Progress");
		const after = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		expect(after).toMatchObject({
			preview: { fields: [] },
			status: "ok",
		});
		const replayed = await applyRecordAction(prisma, {
			actorId,
			baseRevision: previewed.preview.baseRevision,
			idempotencyKey: "apply-start",
			origin: "human",
			payload: {
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				recordActionId: action.id,
				targetRecordId: work.id,
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			throw new Error("expected replayed apply");
		}
		expect(replayed.run.fields).toEqual(previewed.preview.fields);
		expect(replayed.ui.label).toBe("Finalizing");
		expect(
			await applyRecordAction(prisma, {
				actorId,
				baseRevision: previewed.preview.baseRevision,
				idempotencyKey: "apply-start",
				origin: "human",
				payload: {
					previewAcknowledged: true,
					previewFingerprint: "other",
					recordActionId: action.id,
					targetRecordId: work.id,
				},
			})
		).toEqual({ conflict: "Conflict", status: "conflict" });
	});

	it("rejects a stale base revision and a failing combination without a partial write", async () => {
		const { actorId, project } = await openPayments(prisma);
		const action = await committedAction(prisma, actorId, project.id);
		const work = await committedWork(prisma, actorId, project.id, "Alpha");
		const previewed = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const changed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "status-blocked",
			origin: "human",
			status: "Blocked",
			workId: work.id,
		});
		expect(changed.status).toBe("committed");
		expect(
			await applyRecordAction(prisma, {
				actorId,
				baseRevision: previewed.preview.baseRevision,
				idempotencyKey: "stale-apply",
				origin: "human",
				payload: {
					previewAcknowledged: true,
					previewFingerprint: previewed.preview.fingerprint,
					recordActionId: action.id,
					targetRecordId: work.id,
				},
			})
		).toMatchObject({
			currentValueLabel: "Current value",
			status: "stale",
		});
		expect((await getWork(prisma, work.id))?.status).toBe("Blocked");
		const closed = await defineRecordAction(prisma, {
			actorId,
			idempotencyKey: "close-combo",
			origin: "human",
			payload: {
				name: "Close combo",
				projectId: project.id,
				steps: [
					{ kind: "setWorkStatus", status: "Closed" },
					{ kind: "dailyFocusMembership", operation: "add" },
				],
			},
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed combo");
		}
		const live = await getWork(prisma, work.id);
		if (!live) {
			throw new Error("expected work");
		}
		expect(
			await previewRecordAction(prisma, {
				actorId,
				recordActionId: closed.action.id,
				targetRecordId: work.id,
			})
		).toEqual({ reason: "close-step-required", status: "rejected" });
		expect(
			await applyRecordAction(prisma, {
				actorId,
				baseRevision: live.revision,
				idempotencyKey: "fail-close",
				origin: "human",
				payload: {
					previewAcknowledged: true,
					recordActionId: closed.action.id,
					targetRecordId: work.id,
				},
			})
		).toEqual({ reason: "close-step-required", status: "rejected" });
		expect((await getWork(prisma, work.id))?.status).toBe("Blocked");
		const stillPreview = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (stillPreview.status !== "ok") {
			throw new Error("expected remaining Start Work preview");
		}
		expect(stillPreview.preview.fields).toEqual([
			{
				from: "Blocked",
				id: "status",
				label: "Set Work status",
				to: "In Progress",
			},
			{
				from: "Not in Daily Focus",
				id: "dailyFocusMembership",
				label: "Add to Daily Focus",
				to: "In Daily Focus",
			},
		]);
	});

	it("rolls back status when Daily Focus membership write is injected to fail", async () => {
		const { actorId, project } = await openPayments(prisma);
		const action = await committedAction(prisma, actorId, project.id);
		const work = await committedWork(prisma, actorId, project.id, "Alpha");
		const previewed = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const failing = prisma.$extends({
			query: {
				dailyFocusMembership: {
					create() {
						throw new Error("injected-failure");
					},
				},
			},
		});
		await expect(
			applyRecordAction(failing as unknown as PrismaClient, {
				actorId,
				baseRevision: previewed.preview.baseRevision,
				idempotencyKey: "inject-fail",
				origin: "human",
				payload: {
					previewAcknowledged: true,
					previewFingerprint: previewed.preview.fingerprint,
					recordActionId: action.id,
					targetRecordId: work.id,
				},
			})
		).rejects.toThrow("injected-failure");
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		const after = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (after.status !== "ok") {
			throw new Error("expected preview after rollback");
		}
		expect(after.preview.fields).toEqual(previewed.preview.fields);
	});

	it("undoes the whole combination or refuses a later attributed write", async () => {
		const { actorId, project } = await openPayments(prisma);
		const action = await committedAction(prisma, actorId, project.id);
		const work = await committedWork(prisma, actorId, project.id, "Alpha");
		const previewed = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const applied = await applyRecordAction(prisma, {
			actorId,
			baseRevision: previewed.preview.baseRevision,
			idempotencyKey: "apply-for-undo",
			origin: "human",
			payload: {
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				recordActionId: action.id,
				targetRecordId: work.id,
			},
		});
		if (applied.status !== "committed") {
			throw new Error("expected committed apply");
		}
		const undone = await undoRecordAction(prisma, {
			actorId,
			baseRevision: applied.run.revision,
			idempotencyKey: "undo-start",
			origin: "human",
			payload: { runId: applied.run.id },
		});
		expect(undone.status).toBe("committed");
		if (undone.status !== "committed") {
			throw new Error("expected undo");
		}
		expect(undone.run.fields).toEqual([
			{
				from: "In Progress",
				id: "status",
				label: "Set Work status",
				to: "Not Started",
			},
			{
				from: "In Daily Focus",
				id: "dailyFocusMembership",
				label: "Add to Daily Focus",
				to: "Not in Daily Focus",
			},
		]);
		expect(undone.ui.label).toBe("Finalizing");
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		const restoredPreview = await previewRecordAction(prisma, {
			actorId,
			recordActionId: action.id,
			targetRecordId: work.id,
		});
		if (restoredPreview.status !== "ok") {
			throw new Error("expected restored preview");
		}
		expect(restoredPreview.preview.fields).toEqual(previewed.preview.fields);
		const second = await applyRecordAction(prisma, {
			actorId,
			baseRevision: restoredPreview.preview.baseRevision,
			idempotencyKey: "apply-again",
			origin: "human",
			payload: {
				previewAcknowledged: true,
				previewFingerprint: restoredPreview.preview.fingerprint,
				recordActionId: action.id,
				targetRecordId: work.id,
			},
		});
		if (second.status !== "committed") {
			throw new Error("expected second apply");
		}
		const later = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: second.run.revision,
			idempotencyKey: "later-status",
			origin: "human",
			status: "Blocked",
			workId: work.id,
		});
		expect(later.status).toBe("committed");
		const live = await getWork(prisma, work.id);
		expect(
			await undoRecordAction(prisma, {
				actorId,
				baseRevision: live?.revision ?? 0,
				idempotencyKey: "undo-later",
				origin: "human",
				payload: { runId: second.run.id },
			})
		).toEqual({
			explanation:
				"Undo stopped because a later write changed an attributed field.",
			reason: "later-write",
			status: "rejected",
		});
		expect((await getWork(prisma, work.id))?.status).toBe("Blocked");
	});
});

async function committedAction(
	prisma: PrismaClient,
	actorId: string,
	projectId: string
) {
	const outcome = await defineRecordAction(prisma, {
		actorId,
		idempotencyKey: `define-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: RECORD_ACTION_COPY.startWork,
			projectId,
			steps: [...START_WORK_STEPS],
		},
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed Record Action");
	}
	return outcome.action;
}

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: `work-${crypto.randomUUID()}`,
		origin: "human",
		payload: { projectId, title },
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Work");
	}
	return created.work;
}
