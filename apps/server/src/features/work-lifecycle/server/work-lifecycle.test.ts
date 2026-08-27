/**
 * Work Lifecycle seam — create with title only, immutable
 * `{shortCode}-{n}` key, no reuse, five English types, Feature
 * impact preview, and the same main record from Draft finalize
 * or capture convert. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş yaşam döngüsü: identity allocation, no reuse, type matrix).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createProject,
	getProject,
	updateShortCode,
} from "../../project-shell/server/project-shell";
import {
	applyPlanningMembership,
	changeWorkStatus,
	changeWorkType,
	closeWork,
	convertCaptureToWork,
	createWork,
	finalizeDraft,
	getWork,
	listWork,
	listWorkLifecycleHistory,
	permanentlyDeleteWork,
	previewClose,
	previewRecreate,
	previewWorkTypeChange,
	recreateWork,
	reopenWork,
	updateWorkTitle,
} from "./work-lifecycle";
import { DEFAULT_WORK_TYPE } from "./work-lifecycle-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const HIERARCHY_PATTERN = /epic|subtask|parentId|parentWork/i;
const MOVE_PATTERN = /moveWork|changeProject|reassignProject/i;
const ARCHIVE_PATTERN = /archiv/i;
const ENGLISH_WORK_TYPES = [
	"Feature",
	"Bug",
	"Task",
	"Research",
	"Improvement",
] as const;
const FEATURE_IMPACT_COPY = {
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	primarySpec: "Primary spec",
} as const;

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

async function openSecondProject(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	name: string
) {
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${name.toLowerCase()}`,
		origin: "human",
		payload: {
			name,
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return created.project;
}

function createCommand(
	input: {
		idempotencyKey?: string;
		projectId: string;
		source?: "create" | "draft-finalize" | "capture-convert";
		title?: string;
		type?: string;
	},
	actorId: string
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			projectId: input.projectId,
			source: input.source,
			title: input.title,
			type: input.type,
		},
	};
}

describe("Work Lifecycle", () => {
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

	it("opens Work from a title as Not Started with PAY-1 separate from the internal id", async () => {
		const { actorId, project } = await openPayments(prisma);
		const outcome = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "create-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		expect(outcome).toMatchObject({
			status: "committed",
			work: {
				closureResult: null,
				key: "PAY-1",
				number: 1,
				projectId: project.id,
				status: "Not Started",
				title: "Intake checkout",
				type: DEFAULT_WORK_TYPE,
			},
		});
		if (outcome.status !== "committed") {
			throw new Error("expected committed Work");
		}
		expect(outcome.work.id).not.toBe("PAY-1");
		expect(outcome.work.id).not.toBe(outcome.work.key);
		expect(await getWork(prisma, outcome.work.id)).toEqual(outcome.work);
		expect(await listWork(prisma, project.id)).toEqual([outcome.work]);
		expect(JSON.stringify(outcome.work)).not.toMatch(HIERARCHY_PATTERN);
		expect(JSON.stringify(outcome.work)).not.toMatch(MOVE_PATTERN);
	});

	it("requires a title and a closed type catalog", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			await createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "missing-title",
						projectId: project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "missing-title",
			status: "rejected",
		});
		expect(
			await createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "epic",
						projectId: project.id,
						title: "Nested",
						type: "Epic",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-work-type",
			status: "rejected",
		});
		expect(
			await createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "subtask",
						projectId: project.id,
						title: "Nested",
						type: "Subtask",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-work-type",
			status: "rejected",
		});
		expect(await listWork(prisma, project.id)).toEqual([]);
	});

	it("allocates unique keys under concurrency and does not reuse a deleted number", async () => {
		const { actorId, project } = await openPayments(prisma);
		const [first, second] = await Promise.all([
			createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "concurrent-a",
						projectId: project.id,
						title: "A",
					},
					actorId
				)
			),
			createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "concurrent-b",
						projectId: project.id,
						title: "B",
					},
					actorId
				)
			),
		]);
		expect(first.status).toBe("committed");
		expect(second.status).toBe("committed");
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected concurrent Work");
		}
		const keys = [first.work.key, second.work.key].sort();
		expect(keys).toEqual(["PAY-1", "PAY-2"]);
		expect(first.work.id).not.toBe(second.work.id);
		const discarded = first.work.number === 2 ? first.work : second.work;
		await permanentlyDeleteWork(prisma, discarded.id);
		const third = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "after-delete",
					projectId: project.id,
					title: "C",
				},
				actorId
			)
		);
		expect(third).toMatchObject({
			status: "committed",
			work: { key: "PAY-3", number: 3, title: "C" },
		});
		if (third.status !== "committed") {
			throw new Error("expected third Work");
		}
		expect(
			await listWork(prisma, project.id).then((rows) =>
				rows.map((row) => row.key)
			)
		).toEqual(keys.filter((key) => key !== discarded.key).concat("PAY-3"));
	});

	it("locks the Project Shell Short code on first Work and keeps Project scope", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(project.shortCodeLocked).toBe(false);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "lock-short-code",
					projectId: project.id,
					title: "Checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const locked = await getProject(prisma, project.id);
		expect(locked).toMatchObject({
			shortCode: "PAY",
			shortCodeLocked: true,
		});
		expect(
			await updateShortCode(prisma, {
				actorId,
				baseRevision: locked?.revision ?? project.revision,
				idempotencyKey: "too-late",
				origin: "human",
				projectId: project.id,
				shortCode: "BILL",
			})
		).toEqual({
			reason: "short-code-locked",
			status: "rejected",
		});
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "rename-title",
			origin: "human",
			title: "Checkout v2",
			workId: created.work.id,
		});
		expect(renamed).toMatchObject({
			status: "committed",
			work: {
				id: created.work.id,
				key: "PAY-1",
				projectId: project.id,
				title: "Checkout v2",
			},
		});
		expect(created).not.toHaveProperty("moveWork");
		expect(JSON.stringify(created.work)).not.toMatch(MOVE_PATTERN);
	});

	it("creates each English type and lets non-Feature types change freely", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await Promise.all(
			ENGLISH_WORK_TYPES.map(async (type) => {
				const outcome = await createWork(
					prisma,
					createCommand(
						{
							idempotencyKey: `type-${type}`,
							projectId: project.id,
							title: type,
							type,
						},
						actorId
					)
				);
				expect(outcome).toMatchObject({
					status: "committed",
					work: {
						status: "Not Started",
						title: type,
						type,
					},
				});
				if (outcome.status !== "committed") {
					throw new Error("expected typed Work");
				}
				expect(JSON.stringify(outcome.work)).not.toMatch(HIERARCHY_PATTERN);
				return outcome.work;
			})
		);
		expect(created.map((work) => work.key).sort()).toEqual([
			"PAY-1",
			"PAY-2",
			"PAY-3",
			"PAY-4",
			"PAY-5",
		]);
		const task = created.find((work) => work.type === "Task");
		if (!task) {
			throw new Error("expected Task");
		}
		const toBug = await changeWorkType(prisma, {
			actorId,
			baseRevision: task.revision,
			idempotencyKey: "task-to-bug",
			origin: "human",
			type: "Bug",
			workId: task.id,
		});
		expect(toBug).toMatchObject({
			status: "committed",
			work: { id: task.id, key: task.key, type: "Bug" },
		});
		if (toBug.status !== "committed") {
			throw new Error("expected Bug");
		}
		const toResearch = await changeWorkType(prisma, {
			actorId,
			baseRevision: toBug.work.revision,
			idempotencyKey: "bug-to-research",
			origin: "human",
			type: "Research",
			workId: task.id,
		});
		expect(toResearch).toMatchObject({
			status: "committed",
			work: { type: "Research" },
		});
		if (toResearch.status !== "committed") {
			throw new Error("expected Research");
		}
		const toImprovement = await changeWorkType(prisma, {
			actorId,
			baseRevision: toResearch.work.revision,
			idempotencyKey: "research-to-improvement",
			origin: "human",
			type: "Improvement",
			workId: task.id,
		});
		expect(toImprovement).toMatchObject({
			status: "committed",
			work: { type: "Improvement" },
		});
	});

	it("requires an impact preview to enter or leave Feature", async () => {
		const { actorId, project } = await openPayments(prisma);
		const task = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "preview-task",
					projectId: project.id,
					title: "Payments",
					type: "Task",
				},
				actorId
			)
		);
		if (task.status !== "committed") {
			throw new Error("expected Task");
		}
		expect(
			await changeWorkType(prisma, {
				actorId,
				baseRevision: task.work.revision,
				idempotencyKey: "enter-feature-silent",
				origin: "human",
				type: "Feature",
				workId: task.work.id,
			})
		).toEqual({
			reason: "feature-impact-preview-required",
			status: "rejected",
		});
		const enterPreview = await previewWorkTypeChange(
			prisma,
			task.work.id,
			"Feature"
		);
		expect(enterPreview).toMatchObject({
			blocked: false,
			copy: FEATURE_IMPACT_COPY,
			fromType: "Task",
			healthHistory: [],
			includedWork: [],
			primarySpec: null,
			requiresPreview: true,
			toType: "Feature",
		});
		const entered = await changeWorkType(prisma, {
			actorId,
			baseRevision: task.work.revision,
			idempotencyKey: "enter-feature",
			origin: "human",
			previewAcknowledged: true,
			type: "Feature",
			workId: task.work.id,
		});
		expect(entered).toMatchObject({
			status: "committed",
			work: { id: task.work.id, type: "Feature" },
		});
		if (entered.status !== "committed") {
			throw new Error("expected Feature");
		}
		expect(
			await changeWorkType(prisma, {
				actorId,
				baseRevision: entered.work.revision,
				idempotencyKey: "leave-feature-silent",
				origin: "human",
				type: "Bug",
				workId: task.work.id,
			})
		).toEqual({
			reason: "feature-impact-preview-required",
			status: "rejected",
		});
		const leavePreview = await previewWorkTypeChange(
			prisma,
			task.work.id,
			"Bug"
		);
		expect(leavePreview).toMatchObject({
			blocked: false,
			copy: FEATURE_IMPACT_COPY,
			fromType: "Feature",
			healthHistory: [],
			includedWork: [],
			primarySpec: null,
			requiresPreview: true,
			toType: "Bug",
		});
		expect(JSON.stringify(leavePreview)).not.toMatch(HIERARCHY_PATTERN);
		const left = await changeWorkType(prisma, {
			actorId,
			baseRevision: entered.work.revision,
			idempotencyKey: "leave-feature",
			origin: "human",
			previewAcknowledged: true,
			type: "Bug",
			workId: task.work.id,
		});
		expect(left).toMatchObject({
			status: "committed",
			work: { key: "PAY-1", type: "Bug" },
		});
	});

	it("lands Draft finalize and capture convert on the same independent Work main record", async () => {
		const { actorId, project } = await openPayments(prisma);
		const fromDraft = await finalizeDraft(
			prisma,
			createCommand(
				{
					idempotencyKey: "draft",
					projectId: project.id,
					title: "Saved form",
					type: "Research",
				},
				actorId
			)
		);
		const fromCapture = await convertCaptureToWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "capture",
					projectId: project.id,
					title: "Inbox note",
					type: "Bug",
				},
				actorId
			)
		);
		expect(fromDraft).toMatchObject({
			status: "committed",
			work: {
				key: "PAY-1",
				status: "Not Started",
				title: "Saved form",
				type: "Research",
			},
		});
		expect(fromCapture).toMatchObject({
			status: "committed",
			work: {
				key: "PAY-2",
				status: "Not Started",
				title: "Inbox note",
				type: "Bug",
			},
		});
		if (
			fromDraft.status !== "committed" ||
			fromCapture.status !== "committed"
		) {
			throw new Error("expected independent Work");
		}
		expect(fromDraft.work.id).not.toBe(fromCapture.work.id);
		expect(fromDraft.work).not.toHaveProperty("draftId");
		expect(fromCapture.work).not.toHaveProperty("captureItemId");
		expect(await getWork(prisma, fromDraft.work.id)).toEqual(fromDraft.work);
		expect(await getWork(prisma, fromCapture.work.id)).toEqual(
			fromCapture.work
		);
		expect(await listWork(prisma, project.id)).toEqual([
			fromDraft.work,
			fromCapture.work,
		]);
	});

	it("replays the same human create and conflicts on a different payload", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "same-key",
					projectId: project.id,
					title: "Intake",
				},
				actorId
			)
		);
		const replayed = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "same-key",
					projectId: project.id,
					title: "Intake",
				},
				actorId
			)
		);
		expect(first.status).toBe("committed");
		expect(replayed.status).toBe("replayed");
		if (first.status === "committed" && replayed.status === "replayed") {
			expect(replayed.work).toEqual(first.work);
		}
		expect(
			await createWork(
				prisma,
				createCommand(
					{
						idempotencyKey: "same-key",
						projectId: project.id,
						title: "Other",
					},
					actorId
				)
			)
		).toEqual({
			conflict: MUTATION_COPY.conflict,
			status: "conflict",
		});
		expect(await listWork(prisma, project.id)).toHaveLength(1);
	});

	it("keeps workflow status and closure result separate and moves freely among non-terminal statuses", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "status-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		expect(created.work).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		const inProgress = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: "In Progress",
			workId: created.work.id,
		});
		expect(inProgress).toMatchObject({
			status: "committed",
			work: {
				closureResult: null,
				key: "PAY-1",
				status: "In Progress",
			},
		});
		if (inProgress.status !== "committed") {
			throw new Error("expected committed status");
		}
		const blocked = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: inProgress.work.revision,
			idempotencyKey: "to-blocked",
			origin: "human",
			status: "Blocked",
			workId: created.work.id,
		});
		expect(blocked).toMatchObject({
			status: "committed",
			work: { closureResult: null, status: "Blocked" },
		});
		if (blocked.status !== "committed") {
			throw new Error("expected committed status");
		}
		const back = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: blocked.work.revision,
			idempotencyKey: "to-not-started",
			origin: "human",
			status: "Not Started",
			workId: created.work.id,
		});
		expect(back).toMatchObject({
			status: "committed",
			work: { closureResult: null, status: "Not Started" },
		});
		expect(
			await changeWorkStatus(prisma, {
				actorId,
				baseRevision:
					back.status === "committed"
						? back.work.revision
						: created.work.revision,
				idempotencyKey: "closed-without-result",
				origin: "human",
				status: "Closed",
				workId: created.work.id,
			})
		).toEqual({
			reason: "close-step-required",
			status: "rejected",
		});
		expect(await getWork(prisma, created.work.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
	});

	it("closes only through the close step with Completed or Abandoned and leaves status on cancel", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "close-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const beforeCancel = await getWork(prisma, created.work.id);
		expect(beforeCancel).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(
			await closeWork(prisma, {
				actorId,
				baseRevision: created.work.revision,
				idempotencyKey: "close-missing-result",
				origin: "human",
				workId: created.work.id,
			})
		).toEqual({
			reason: "unknown-closure-result",
			status: "rejected",
		});
		expect(await getWork(prisma, created.work.id)).toEqual(beforeCancel);
		const completed = await closeWork(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "close-completed",
			origin: "human",
			reason: "Shipped checkout",
			result: "Completed",
			workId: created.work.id,
		});
		expect(completed).toMatchObject({
			status: "committed",
			work: {
				closureResult: "Completed",
				status: "Closed",
			},
		});
		if (completed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		const abandonedWork = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "close-abandoned-create",
					projectId: project.id,
					title: "Old experiment",
				},
				actorId
			)
		);
		if (abandonedWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const stagesBefore = (await getProject(prisma, project.id))?.stages;
		const abandoned = await closeWork(prisma, {
			actorId,
			baseRevision: abandonedWork.work.revision,
			idempotencyKey: "close-abandoned",
			origin: "human",
			result: "Abandoned",
			workId: abandonedWork.work.id,
		});
		expect(abandoned).toMatchObject({
			status: "committed",
			work: {
				closureResult: "Abandoned",
				status: "Closed",
			},
		});
		expect(await listWork(prisma, project.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: abandonedWork.work.id,
					key: "PAY-2",
					status: "Closed",
				}),
			])
		);
		expect((await getProject(prisma, project.id))?.stages).toEqual(
			stagesBefore
		);
		expect(JSON.stringify(abandoned)).not.toMatch(ARCHIVE_PATTERN);
		expect(
			await closeWork(prisma, {
				actorId,
				baseRevision: abandonedWork.work.revision,
				idempotencyKey: "github-close",
				origin: "github",
				result: "Completed",
				workId: abandonedWork.work.id,
			})
		).toEqual({
			reason: "silent-result-forbidden",
			status: "rejected",
		});
		expect(
			await closeWork(prisma, {
				actorId,
				baseRevision: abandonedWork.work.revision,
				idempotencyKey: "automation-close",
				origin: "system-automation",
				result: "Abandoned",
				workId: abandonedWork.work.id,
			})
		).toEqual({
			reason: "silent-result-forbidden",
			status: "rejected",
		});
	});

	it("reopens with confirm and a non-terminal status while keeping the previous result in history", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "reopen-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "reopen-close",
			origin: "human",
			reason: "Shipped",
			result: "Completed",
			workId: created.work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		expect(
			await reopenWork(prisma, {
				actorId,
				baseRevision: closed.work.revision,
				idempotencyKey: "reopen-unconfirmed",
				origin: "human",
				status: "In Progress",
				workId: created.work.id,
			})
		).toEqual({
			reason: "reopen-confirm-required",
			status: "rejected",
		});
		expect(
			await reopenWork(prisma, {
				actorId,
				baseRevision: closed.work.revision,
				idempotencyKey: "reopen-closed-target",
				origin: "human",
				reopenConfirmed: true,
				status: "Closed",
				workId: created.work.id,
			})
		).toEqual({
			reason: "unknown-work-status",
			status: "rejected",
		});
		const reopened = await reopenWork(prisma, {
			actorId,
			baseRevision: closed.work.revision,
			idempotencyKey: "reopen-confirmed",
			origin: "human",
			reopenConfirmed: true,
			status: "In Progress",
			workId: created.work.id,
		});
		expect(reopened).toMatchObject({
			status: "committed",
			work: {
				closureResult: null,
				status: "In Progress",
			},
		});
		expect(await listWorkLifecycleHistory(prisma, created.work.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					closureResult: "Completed",
					kind: "closed",
					reason: "Shipped",
					status: "Closed",
				}),
				expect.objectContaining({
					closureResult: null,
					kind: "reopened",
					status: "In Progress",
				}),
			])
		);
	});

	it("warns on Closure check without blocking close and previews Keep lasting context without generating text", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "check-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const notes = "Checkout auth belongs in the Decision log.";
		const preview = await previewClose(prisma, {
			activeBlockers: [{ id: "block-1", title: "Waiting on GitHub App" }],
			incompleteChecklistItems: [{ id: "item-1", title: "Write the receipt" }],
			notes,
			workId: created.work.id,
		});
		expect(preview).toMatchObject({
			blocking: false,
			copy: {
				closeAnyway: "Close anyway",
				closureCheck: "Closure check",
				keepLastingContext: "Keep lasting context",
				returnToWork: "Return to work",
			},
			findings: {
				activeBlockers: [{ id: "block-1", title: "Waiting on GitHub App" }],
				incompleteChecklistItems: [
					{ id: "item-1", title: "Write the receipt" },
				],
			},
			keepLastingContext: {
				decision: {
					action: "create-decision",
					body: notes,
					linkedWorkId: created.work.id,
				},
				personalWiki: {
					action: "create-personal-wiki-document",
					body: notes,
					originProjectId: project.id,
					originWorkId: created.work.id,
				},
			},
		});
		if ("reason" in preview) {
			throw new Error("expected close preview");
		}
		expect(preview.keepLastingContext?.decision.body).toBe(notes);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "close-anyway",
			origin: "human",
			result: "Completed",
			workId: created.work.id,
		});
		expect(closed).toMatchObject({
			status: "committed",
			work: { closureResult: "Completed", status: "Closed" },
		});
		expect(await getWork(prisma, created.work.id)).toMatchObject({
			title: "Intake checkout",
		});
	});

	it("does not let planning membership write status or skip the close step", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "board-intake",
					projectId: project.id,
					title: "Intake checkout",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const membership = await applyPlanningMembership(prisma, {
			desiredStatus: "In Progress",
			surface: "Board",
			workId: created.work.id,
		});
		expect(membership).toMatchObject({
			membership: { surface: "Board" },
			status: "committed",
			work: {
				closureResult: null,
				status: "Not Started",
			},
		});
		expect(
			await applyPlanningMembership(prisma, {
				desiredStatus: "Closed",
				surface: "Board",
				workId: created.work.id,
			})
		).toEqual({
			reason: "close-step-required",
			status: "rejected",
		});
		expect(await getWork(prisma, created.work.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
	});

	it("rejects a human create missing the client idempotency key", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			await createWork(
				prisma,
				createCommand(
					{
						projectId: project.id,
						title: "Intake",
					},
					actorId
				)
			)
		).toEqual({
			reason: "missing-idempotency-key",
			status: "rejected",
		});
	});

	it("previews Recreate in another Project and commits a new identity with origin", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const invoices = await openSecondProject(
			prisma,
			actorId,
			workspaceId,
			"Invoices"
		);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "recreate-source",
					projectId: project.id,
					title: "Intake checkout",
					type: "Bug",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "recreate-progress",
			origin: "human",
			status: "In Progress",
			workId: created.work.id,
		});
		if (progressed.status !== "committed") {
			throw new Error("expected In Progress");
		}
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: progressed.work.revision,
			idempotencyKey: "recreate-close",
			origin: "human",
			result: "Completed",
			workId: created.work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		const sourceBefore = await getWork(prisma, created.work.id);
		const relations = [
			{
				id: "rel-related",
				kind: "related",
				title: "Auth Decision",
			},
			{
				id: "rel-github",
				kind: "github-completion",
				title: "PR merge",
			},
		];
		const preview = await previewRecreate(prisma, {
			relations,
			targetProjectId: invoices.id,
			workId: created.work.id,
		});
		expect(preview).toMatchObject({
			copy: {
				recreateInAnotherProject: "Recreate in another Project",
			},
			source: {
				closureResult: "Completed",
				id: created.work.id,
				key: "PAY-1",
				status: "Closed",
				type: "Bug",
			},
			targetProject: {
				id: invoices.id,
				name: "Invoices",
			},
		});
		if ("reason" in preview) {
			throw new Error("expected recreate preview");
		}
		expect(preview.portableFields.map((field) => field.id)).toEqual([
			"title",
			"type",
			"description",
			"lightChecklist",
		]);
		expect(
			preview.portableFields.every((field) => field.selectedByDefault)
		).toBe(true);
		expect(preview.relations).toEqual([
			{
				id: "rel-related",
				kind: "related",
				portable: true,
				title: "Auth Decision",
			},
			{
				id: "rel-github",
				kind: "github-completion",
				portable: false,
				title: "PR merge",
			},
		]);
		const recreated = await recreateWork(prisma, {
			actorId,
			idempotencyKey: "recreate-confirm",
			origin: "human",
			payload: {
				relations,
				selectedFields: ["title", "type", "description", "lightChecklist"],
				selectedRelationIds: ["rel-related"],
				targetProjectId: invoices.id,
				workId: created.work.id,
			},
		});
		expect(recreated).toMatchObject({
			status: "committed",
			work: {
				closureResult: null,
				key: "INV-1",
				projectId: invoices.id,
				status: "Not Started",
				title: "Intake checkout",
				type: "Bug",
			},
		});
		if (recreated.status !== "committed") {
			throw new Error("expected recreated Work");
		}
		expect(recreated.work.id).not.toBe(created.work.id);
		expect(recreated.work.key).not.toBe("PAY-1");
		expect(recreated.work.origin).toEqual({
			id: created.work.id,
			key: "PAY-1",
			projectId: project.id,
		});
		expect(recreated.work.relations).toEqual([
			expect.objectContaining({
				kind: "related",
				title: "Auth Decision",
			}),
		]);
		expect(recreated.work.relations[0]?.id).not.toBe("rel-related");
		expect(await getWork(prisma, created.work.id)).toEqual(sourceBefore);
		expect(await listWork(prisma, project.id)).toEqual([sourceBefore]);
		expect(JSON.stringify(recreated.work)).not.toMatch(MOVE_PATTERN);
		const replayed = await recreateWork(prisma, {
			actorId,
			idempotencyKey: "recreate-confirm",
			origin: "human",
			payload: {
				relations,
				selectedFields: ["title", "type", "description", "lightChecklist"],
				selectedRelationIds: ["rel-related"],
				targetProjectId: invoices.id,
				workId: created.work.id,
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status === "replayed") {
			expect(replayed.work).toEqual(recreated.work);
		}
	});

	it("refuses non-portable binds and does not alias the source key", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const invoices = await openSecondProject(
			prisma,
			actorId,
			workspaceId,
			"Invoices"
		);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "alias-source",
					projectId: project.id,
					title: "Intake checkout",
					type: "Bug",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const sourceBefore = await getWork(prisma, created.work.id);
		expect(
			await recreateWork(prisma, {
				actorId,
				idempotencyKey: "copy-github",
				origin: "human",
				payload: {
					relations: [
						{
							id: "rel-github",
							kind: "github-completion",
							title: "PR merge",
						},
					],
					selectedFields: ["title", "type"],
					selectedRelationIds: ["rel-github"],
					targetProjectId: invoices.id,
					workId: created.work.id,
				},
			})
		).toEqual({
			reason: "work-not-portable",
			status: "rejected",
		});
		expect(
			await recreateWork(prisma, {
				actorId,
				idempotencyKey: "copy-status",
				origin: "human",
				payload: {
					selectedFields: ["title", "current-status"],
					targetProjectId: invoices.id,
					workId: created.work.id,
				},
			})
		).toEqual({
			reason: "work-not-portable",
			status: "rejected",
		});
		expect(await getWork(prisma, created.work.id)).toEqual(sourceBefore);
		expect(await listWork(prisma, invoices.id)).toEqual([]);
		expect(
			await recreateWork(prisma, {
				actorId,
				idempotencyKey: "same-project",
				origin: "human",
				payload: {
					selectedFields: ["title", "type"],
					targetProjectId: project.id,
					workId: created.work.id,
				},
			})
		).toEqual({
			reason: "work-not-portable",
			status: "rejected",
		});
		const recreated = await recreateWork(prisma, {
			actorId,
			idempotencyKey: "copy-title-only",
			origin: "human",
			payload: {
				selectedFields: ["title"],
				targetProjectId: invoices.id,
				workId: created.work.id,
			},
		});
		expect(recreated).toMatchObject({
			status: "committed",
			work: {
				key: "INV-1",
				status: "Not Started",
				title: "Intake checkout",
				type: "Task",
			},
		});
		if (recreated.status !== "committed") {
			throw new Error("expected recreated Work");
		}
		expect((await listWork(prisma, invoices.id)).map((row) => row.key)).toEqual(
			["INV-1"]
		);
		expect((await listWork(prisma, project.id)).map((row) => row.key)).toEqual([
			"PAY-1",
		]);
		expect(recreated.work.key).not.toBe(created.work.key);
		expect(await getWork(prisma, created.work.id)).toMatchObject({
			key: "PAY-1",
			status: "Not Started",
			type: "Bug",
		});
	});
});
