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
	changeWorkType,
	convertCaptureToWork,
	createWork,
	finalizeDraft,
	getWork,
	listWork,
	permanentlyDeleteWork,
	previewWorkTypeChange,
	updateWorkTitle,
} from "./work-lifecycle";
import {
	DEFAULT_WORK_TYPE,
	typeChangeImpact,
	WORK_LIFECYCLE_COPY,
	WORK_TYPES,
} from "./work-lifecycle-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const HIERARCHY_PATTERN = /epic|subtask|parentId|parentWork/i;
const MOVE_PATTERN = /moveWork|changeProject|reassignProject/i;

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
		expect(WORK_TYPES).toEqual([
			"Feature",
			"Bug",
			"Task",
			"Research",
			"Improvement",
		]);
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
			WORK_TYPES.map(async (type) => {
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
		expect(enterPreview).toEqual(typeChangeImpact("Task", "Feature"));
		expect(enterPreview).toMatchObject({
			blocked: false,
			copy: {
				impactPreview: "Impact preview",
				includedWork: "Included Work",
			},
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
			fromType: "Feature",
			healthHistory: [],
			includedWork: [],
			primarySpec: null,
			requiresPreview: true,
			toType: "Bug",
		});
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

	it("uses English Work, type, and impact-preview chrome", () => {
		expect(WORK_LIFECYCLE_COPY.work).toBe("Work");
		expect(WORK_LIFECYCLE_COPY.createWork).toBe("Create Work");
		expect(WORK_LIFECYCLE_COPY.title).toBe("Title");
		expect(WORK_LIFECYCLE_COPY.type).toBe("Type");
		expect(WORK_LIFECYCLE_COPY.key).toBe("Key");
		expect(WORK_LIFECYCLE_COPY.changeType).toBe("Change type");
		expect(WORK_LIFECYCLE_COPY.impactPreview).toBe("Impact preview");
		expect(WORK_LIFECYCLE_COPY.includedWork).toBe("Included Work");
		expect(WORK_LIFECYCLE_COPY.primarySpec).toBe("Primary spec");
		expect(WORK_LIFECYCLE_COPY.featureHealth).toBe("Feature health");
		expect(WORK_LIFECYCLE_COPY.confirmTypeChange).toBe("Confirm type change");
		expect(WORK_TYPES).toEqual([
			"Feature",
			"Bug",
			"Task",
			"Research",
			"Improvement",
		]);
		expect(JSON.stringify(WORK_LIFECYCLE_COPY)).not.toMatch(HIERARCHY_PATTERN);
	});
});
