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
	applyScopeTreeDrag,
	archiveWork,
	bindPrimarySpec,
	changeWorkStatus,
	changeWorkType,
	closeWork,
	convertCaptureToWork,
	createWork,
	detachFeatureHealthHistory,
	detachIncludedWork,
	detachPrimarySpec,
	finalizeDraft,
	getScopeTree,
	getWork,
	getWorkByKey,
	getWorkScope,
	includeWork,
	listWork,
	listWorkLifecycleHistory,
	listWorkRelations,
	mergeWork,
	permanentlyDeleteWork,
	previewClose,
	previewRecreate,
	previewWorkMerge,
	previewWorkTypeChange,
	recordFeatureHealth,
	recreateWork,
	relateWork,
	reopenWork,
	summarizeFeatureProgress,
	unarchiveWork,
	undoWorkMerge,
	updateWorkPlanningDates,
	updateWorkTitle,
} from "./work-lifecycle";
import { DEFAULT_WORK_TYPE } from "./work-lifecycle-model";

const SCHEMA_MISSING_IN_DATABASE = /does not exist in the current database/;

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const HIERARCHY_PATTERN = /epic|subtask|parentId|parentWork/i;
const MOVE_PATTERN = /moveWork|changeProject|reassignProject/i;
const DUPLICATE_CLOSE_RESULT = /"closureResult":"Duplicate"/;
const RECREATE_IN_ANOTHER_PROJECT = /recreate in another project/i;
const CLOSED_STATUS = /"status":"Closed"/;
const RECREATE_WORD = /recreate/i;
const TRASH_PATTERN = /trash|deletedAt/i;
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
	await prisma.typedRelation.deleteMany();
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

	it("lists Work when the generated client does not know originWork include", async () => {
		const staleUnknownOrigin = new Error(
			"Unknown field 'originWork' for include statement on model 'Work'."
		);
		const listed = [
			{
				archived: false,
				closureResult: null,
				description: null,
				id: "work-1",
				key: "PAY-1",
				lightChecklist: [],
				number: 1,
				originWorkId: "origin-1",
				portableRelations: [],
				projectId: "project-1",
				retiredIntoId: null,
				revision: 1,
				status: "Not Started",
				title: "Intake",
				type: "Task",
			},
		];
		const origins = [
			{
				id: "origin-1",
				key: "CORE-1",
				projectId: "project-2",
			},
		];
		const prismaWithoutOriginInclude = {
			work: {
				findMany: (args: {
					include?: { originWork?: unknown };
					where?: {
						id?: { in?: string[] };
						projectId?: string;
						retiredIntoId?: { in?: string[] } | null;
					};
				}) => {
					if (args.include && "originWork" in args.include) {
						throw staleUnknownOrigin;
					}
					if (args.where?.id?.in) {
						return origins.filter((row) =>
							args.where?.id?.in?.includes(row.id)
						);
					}
					if (args.where?.retiredIntoId) {
						return [];
					}
					return listed;
				},
			},
			workMergeEvent: {
				findMany: () => [],
			},
		};

		await expect(
			listWork(
				prismaWithoutOriginInclude as unknown as PrismaClient,
				"project-1"
			)
		).resolves.toEqual([
			{
				archived: false,
				closureResult: null,
				description: null,
				id: "work-1",
				key: "PAY-1",
				latestMergeEventId: null,
				lightChecklist: [],
				number: 1,
				origin: origins[0],
				plannedStart: null,
				projectId: "project-1",
				reappearDate: null,
				relations: [],
				retiredIdentities: [],
				revision: 1,
				status: "Not Started",
				targetDate: null,
				title: "Intake",
				type: "Task",
			},
		]);
	});

	it("fails listing Work when the generated client is ahead of the database", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "schema-drift-list",
					projectId: project.id,
					title: "Intake",
				},
				actorId
			)
		);
		expect(created.status).toBe("committed");
		await prisma.$executeRaw`ALTER TABLE "work" DROP COLUMN IF EXISTS "description"`;
		try {
			await expect(listWork(prisma, project.id)).rejects.toThrow(
				SCHEMA_MISSING_IN_DATABASE
			);
		} finally {
			await prisma.$executeRaw`ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "description" TEXT`;
		}
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

	it("writes Target date and Reappear date without changing status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "dates-create",
					projectId: project.id,
					title: "Dated Work",
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const updated = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: created.work.revision,
			idempotencyKey: "set-dates",
			origin: "human",
			plannedStart: "2026-08-28",
			reappearDate: "2026-08-31",
			targetDate: "2026-09-03",
			workId: created.work.id,
		});
		expect(updated).toMatchObject({
			status: "committed",
			work: {
				id: created.work.id,
				plannedStart: "2026-08-28",
				reappearDate: "2026-08-31",
				status: created.work.status,
				targetDate: "2026-09-03",
			},
		});
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
		expect(abandoned).toMatchObject({
			status: "committed",
			work: { archived: false, closureResult: "Abandoned" },
		});
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

	it("archives Work independently of status and result, drops it from the default list, and unarchives with the same identity", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "archive-intake",
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
			idempotencyKey: "archive-close",
			origin: "human",
			result: "Completed",
			workId: created.work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		expect(closed.work.archived).toBe(false);
		expect(await listWork(prisma, project.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					archived: false,
					id: created.work.id,
					key: "PAY-1",
					status: "Closed",
				}),
			])
		);
		const archived = await archiveWork(prisma, {
			actorId,
			baseRevision: closed.work.revision,
			idempotencyKey: "archive-closed",
			origin: "human",
			workId: created.work.id,
		});
		expect(archived).toMatchObject({
			status: "committed",
			work: {
				archived: true,
				closureResult: "Completed",
				id: created.work.id,
				key: "PAY-1",
				status: "Closed",
				title: "Intake checkout",
			},
		});
		if (archived.status !== "committed") {
			throw new Error("expected archived Work");
		}
		expect(JSON.stringify(archived.work)).not.toMatch(TRASH_PATTERN);
		expect(await listWork(prisma, project.id)).toEqual([]);
		expect(await listWork(prisma, project.id, { archived: true })).toEqual([
			archived.work,
		]);
		expect(await getWork(prisma, created.work.id)).toEqual(archived.work);
		expect(await listWorkLifecycleHistory(prisma, created.work.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					closureResult: "Completed",
					kind: "closed",
					status: "Closed",
				}),
			])
		);
		const unarchived = await unarchiveWork(prisma, {
			actorId,
			baseRevision: archived.work.revision,
			idempotencyKey: "unarchive-closed",
			origin: "human",
			workId: created.work.id,
		});
		expect(unarchived).toMatchObject({
			status: "committed",
			work: {
				archived: false,
				closureResult: "Completed",
				id: created.work.id,
				key: "PAY-1",
				status: "Closed",
			},
		});
		if (unarchived.status !== "committed") {
			throw new Error("expected unarchived Work");
		}
		expect(await listWork(prisma, project.id)).toEqual([unarchived.work]);
		expect(await listWork(prisma, project.id, { archived: true })).toEqual([]);
		expect(await listWorkLifecycleHistory(prisma, created.work.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					closureResult: "Completed",
					kind: "closed",
					status: "Closed",
				}),
			])
		);
		const openWork = await createWork(
			prisma,
			createCommand(
				{
					idempotencyKey: "archive-open-create",
					projectId: project.id,
					title: "Parked idea",
				},
				actorId
			)
		);
		if (openWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const archivedOpen = await archiveWork(prisma, {
			actorId,
			baseRevision: openWork.work.revision,
			idempotencyKey: "archive-open",
			origin: "human",
			workId: openWork.work.id,
		});
		expect(archivedOpen).toMatchObject({
			status: "committed",
			work: {
				archived: true,
				closureResult: null,
				id: openWork.work.id,
				key: "PAY-2",
				status: "Not Started",
			},
		});
		expect(await listWork(prisma, project.id)).toEqual([unarchived.work]);
		expect(
			(await listWork(prisma, project.id, { archived: true })).map(
				(work) => work.key
			)
		).toEqual(["PAY-2"]);
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

	it("refuses Merge as duplicate without a preview of the surviving record", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const second = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout copy",
			"create-checkout-copy"
		);
		expect(
			await mergeWork(prisma, {
				actorId,
				duplicateBaseRevision: second.revision,
				duplicateId: second.id,
				idempotencyKey: "silent-merge",
				origin: "human",
				survivorBaseRevision: first.revision,
				survivorId: first.id,
			})
		).toEqual({
			reason: "merge-preview-required",
			status: "rejected",
		});
		expect(await listWork(prisma, project.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: first.id, key: "PAY-1" }),
				expect.objectContaining({ id: second.id, key: "PAY-2" }),
			])
		);
	});

	it("previews survivor, field conflicts, and relations before Merge as duplicate", async () => {
		const { actorId, project } = await openPayments(prisma);
		const survivor = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-survivor"
		);
		const duplicate = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout copy",
			"create-duplicate",
			"Bug"
		);
		const related = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Receipts",
			"create-related"
		);
		await prisma.workRelation.create({
			data: {
				fromId: duplicate.id,
				id: crypto.randomUUID(),
				kind: "Related",
				toId: related.id,
			},
		});
		const preview = await previewWorkMerge(prisma, {
			duplicateId: duplicate.id,
			survivorId: survivor.id,
		});
		expect(preview).toMatchObject({
			copy: {
				fieldConflicts: "Field conflicts",
				mergeAsDuplicate: "Merge as duplicate",
				mergePreview: "Merge Preview",
				origin: "Origin",
				related: "Related",
				relationsToRewrite: "Relations",
				survivingRecord: "Surviving record",
			},
			duplicate: { id: duplicate.id, key: "PAY-2", title: "Checkout copy" },
			fieldConflicts: [
				{
					duplicateValue: "Checkout copy",
					field: "title",
					survivorValue: "Checkout",
				},
				{
					duplicateValue: "Bug",
					field: "type",
					survivorValue: "Task",
				},
			],
			relationsToRewrite: [
				{
					fromId: duplicate.id,
					kind: "Related",
					rewrittenFromId: survivor.id,
					rewrittenToId: related.id,
					toId: related.id,
				},
			],
			survivor: { id: survivor.id, key: "PAY-1", title: "Checkout" },
		});
		expect(JSON.stringify(preview)).not.toMatch(DUPLICATE_CLOSE_RESULT);
		expect(JSON.stringify(preview)).not.toMatch(RECREATE_IN_ANOTHER_PROJECT);
	});

	it("consolidates into one surviving Work and retires the loser key as visible origin", async () => {
		const { actorId, project } = await openPayments(prisma);
		const survivor = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-survivor-commit"
		);
		const duplicate = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout copy",
			"create-duplicate-commit",
			"Bug"
		);
		const related = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Receipts",
			"create-related-commit"
		);
		await prisma.workRelation.create({
			data: {
				fromId: duplicate.id,
				id: crypto.randomUUID(),
				kind: "Related",
				toId: related.id,
			},
		});
		const merged = await mergeWork(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { title: "survivor", type: "duplicate" },
			idempotencyKey: "merge-checkout",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
		});
		expect(merged).toMatchObject({
			status: "committed",
			undo: "Undo",
			work: {
				id: survivor.id,
				key: "PAY-1",
				retiredIdentities: [{ id: duplicate.id, key: "PAY-2" }],
				title: "Checkout",
				type: "Bug",
			},
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		expect(merged.work.closureResult).not.toBe("Duplicate");
		expect(await listWork(prisma, project.id)).toEqual([
			expect.objectContaining({ id: survivor.id, key: "PAY-1" }),
			expect.objectContaining({ id: related.id, key: "PAY-3" }),
		]);
		expect(await getWork(prisma, duplicate.id)).toMatchObject({
			id: survivor.id,
			key: "PAY-1",
			origin: { id: duplicate.id, key: "PAY-2" },
		});
		expect(await getWorkByKey(prisma, project.id, "PAY-2")).toMatchObject({
			id: survivor.id,
			origin: { id: duplicate.id, key: "PAY-2" },
		});
		expect(await listWorkRelations(prisma, survivor.id)).toEqual([
			{
				fromId: survivor.id,
				kind: "Related",
				toId: related.id,
			},
		]);
		expect(JSON.stringify(await listWork(prisma, project.id))).not.toMatch(
			CLOSED_STATUS
		);
	});

	it("does not merge from title similarity and is not Recreate in another Project", async () => {
		const { actorId, project } = await openPayments(prisma);
		await createNamedWork(prisma, actorId, project.id, "Checkout", "similar-a");
		await createNamedWork(prisma, actorId, project.id, "Checkout", "similar-b");
		const listed = await listWork(prisma, project.id);
		expect(listed).toHaveLength(2);
		expect(listed.map((row) => row.key)).toEqual(["PAY-1", "PAY-2"]);
		expect(listed[0]?.id).not.toBe(listed[1]?.id);
		expect(listed[0]?.projectId).toBe(project.id);
		expect(listed[1]?.projectId).toBe(project.id);
		expect(JSON.stringify(listed)).not.toMatch(RECREATE_WORD);
	});

	it("undoes Merge as duplicate without deleting a later unrelated title write", async () => {
		const { actorId, project } = await openPayments(prisma);
		const survivor = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"undo-survivor"
		);
		const duplicate = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout copy",
			"undo-duplicate",
			"Bug"
		);
		const merged = await mergeWork(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { title: "survivor", type: "duplicate" },
			idempotencyKey: "merge-for-undo",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: merged.work.revision,
			idempotencyKey: "later-title",
			origin: "human",
			title: "Checkout later",
			workId: survivor.id,
		});
		if (renamed.status !== "committed") {
			throw new Error("expected later title");
		}
		const undone = await undoWorkMerge(prisma, {
			actorId,
			baseRevision: renamed.work.revision,
			idempotencyKey: "undo-merge",
			mergeEventId: merged.mergeEventId,
			origin: "human",
			survivorId: survivor.id,
		});
		expect(undone).toMatchObject({
			status: "committed",
			work: {
				id: survivor.id,
				key: "PAY-1",
				title: "Checkout later",
				type: "Task",
			},
		});
		expect(await getWork(prisma, duplicate.id)).toMatchObject({
			id: duplicate.id,
			key: "PAY-2",
			origin: null,
			title: "Checkout copy",
			type: "Bug",
		});
		expect(await listWork(prisma, project.id)).toHaveLength(2);
	});

	it("refuses undo when a later write touched a merge-attributed field", async () => {
		const { actorId, project } = await openPayments(prisma);
		const survivor = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"conflict-survivor"
		);
		const duplicate = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout copy",
			"conflict-duplicate"
		);
		const merged = await mergeWork(prisma, {
			actorId,
			duplicateBaseRevision: duplicate.revision,
			duplicateId: duplicate.id,
			fieldChoices: { title: "duplicate" },
			idempotencyKey: "merge-attributed-title",
			origin: "human",
			previewAcknowledged: true,
			survivorBaseRevision: survivor.revision,
			survivorId: survivor.id,
		});
		if (merged.status !== "committed") {
			throw new Error("expected committed merge");
		}
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: merged.work.revision,
			idempotencyKey: "later-attributed-title",
			origin: "human",
			title: "Checkout rewritten",
			workId: survivor.id,
		});
		if (renamed.status !== "committed") {
			throw new Error("expected later attributed title");
		}
		expect(
			await undoWorkMerge(prisma, {
				actorId,
				baseRevision: renamed.work.revision,
				idempotencyKey: "undo-attributed",
				mergeEventId: merged.mergeEventId,
				origin: "human",
				survivorId: survivor.id,
			})
		).toMatchObject({
			conflict: "Conflict",
			current: { title: "Checkout rewritten" },
			currentValueLabel: "Current value",
			status: "conflict",
		});
		expect(await getWork(prisma, duplicate.id)).toMatchObject({
			id: survivor.id,
			origin: { key: "PAY-2" },
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

	it("lets a Feature include Work once via Includes and refuses a second primary Feature", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "feature-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const other = await committedWork(prisma, actorId, {
			idempotencyKey: "feature-wallet",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake checkout",
			type: "Task",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "include-intake",
			origin: "human",
			workId: intake.id,
		});
		expect(included).toMatchObject({
			status: "committed",
			work: {
				id: intake.id,
				key: "PAY-3",
				status: "Not Started",
				title: "Intake checkout",
				type: "Task",
			},
		});
		expect(await getWorkScope(prisma, checkout.id)).toMatchObject({
			copy: {
				includedIn: "Included in",
				includedWork: "Included Work",
				includes: "Includes",
			},
			includedIn: null,
			includedWork: [
				{
					id: intake.id,
					key: "PAY-3",
					title: "Intake checkout",
				},
			],
		});
		expect(await getWorkScope(prisma, intake.id)).toMatchObject({
			includedIn: {
				id: checkout.id,
				key: "PAY-1",
				title: "Checkout",
			},
			includedWork: [],
		});
		expect(
			await includeWork(prisma, {
				actorId,
				baseRevision: intake.revision + 1,
				featureId: other.id,
				idempotencyKey: "second-primary",
				origin: "human",
				workId: intake.id,
			})
		).toEqual({
			reason: "already-included",
			status: "rejected",
		});
		expect(await getWorkScope(prisma, other.id)).toMatchObject({
			includedWork: [],
		});
		expect(await getWorkScope(prisma, intake.id)).toMatchObject({
			includedIn: { id: checkout.id },
		});
		expect(
			await includeWork(prisma, {
				actorId,
				baseRevision: other.revision,
				featureId: checkout.id,
				idempotencyKey: "include-feature",
				origin: "human",
				workId: other.id,
			})
		).toEqual({
			reason: "nested-inclusion-refused",
			status: "rejected",
		});
		expect(JSON.stringify(await getWorkScope(prisma, checkout.id))).not.toMatch(
			HIERARCHY_PATTERN
		);
	});

	it("keeps Related Features out of inclusion progress", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "related-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const wallet = await committedWork(prisma, actorId, {
			idempotencyKey: "related-wallet",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "related-intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "include-for-related",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		const related = await relateWork(prisma, {
			actorId,
			baseRevision: included.work.revision,
			fromWorkId: intake.id,
			idempotencyKey: "relate-wallet",
			origin: "human",
			toWorkId: wallet.id,
		});
		expect(related).toMatchObject({
			status: "committed",
			work: { id: intake.id, type: "Task" },
		});
		expect(await getWorkScope(prisma, wallet.id)).toMatchObject({
			copy: { related: "Related" },
			includedWork: [],
			relatedWork: [{ id: intake.id, key: "PAY-3" }],
		});
		expect(await summarizeFeatureProgress(prisma, checkout.id)).toMatchObject({
			closedCount: 0,
			featureStatus: "Not Started",
			includedCount: 1,
		});
		expect(await summarizeFeatureProgress(prisma, wallet.id)).toMatchObject({
			closedCount: 0,
			featureStatus: "Not Started",
			includedCount: 0,
		});
	});

	it("leaves included Work type, status, planning, and history independent of the Feature", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "independent-feature",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "independent-task",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "include-independent",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		const retitled = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: included.work.revision,
			idempotencyKey: "rename-intake",
			origin: "human",
			title: "Intake tax",
			workId: intake.id,
		});
		if (retitled.status !== "committed") {
			throw new Error("expected title");
		}
		const asBug = await changeWorkType(prisma, {
			actorId,
			baseRevision: retitled.work.revision,
			idempotencyKey: "intake-to-bug",
			origin: "human",
			type: "Bug",
			workId: intake.id,
		});
		if (asBug.status !== "committed") {
			throw new Error("expected Bug");
		}
		const inProgress = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: asBug.work.revision,
			idempotencyKey: "intake-progress",
			origin: "human",
			status: "In Progress",
			workId: intake.id,
		});
		if (inProgress.status !== "committed") {
			throw new Error("expected In Progress");
		}
		await applyPlanningMembership(prisma, {
			desiredStatus: "Blocked",
			surface: "Board",
			workId: intake.id,
		});
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: inProgress.work.revision,
			idempotencyKey: "intake-close",
			origin: "human",
			result: "Completed",
			workId: intake.id,
		});
		expect(closed).toMatchObject({
			status: "committed",
			work: { closureResult: "Completed", status: "Closed", type: "Bug" },
		});
		expect(await getWork(prisma, checkout.id)).toMatchObject({
			status: "Not Started",
			title: "Checkout",
			type: "Feature",
		});
		expect(await listWorkLifecycleHistory(prisma, checkout.id)).toEqual([]);
		expect(await listWorkLifecycleHistory(prisma, intake.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "status",
					status: "In Progress",
				}),
				expect.objectContaining({
					closureResult: "Completed",
					kind: "closed",
					status: "Closed",
				}),
			])
		);
	});

	it("does not let derived Feature progress write Feature status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "progress-feature",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "progress-task",
			projectId: project.id,
			title: "Intake checkout",
		});
		await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "include-progress",
			origin: "human",
			workId: intake.id,
		});
		const live = await getWork(prisma, intake.id);
		if (!live) {
			throw new Error("expected intake");
		}
		await closeWork(prisma, {
			actorId,
			baseRevision: live.revision,
			idempotencyKey: "close-for-progress",
			origin: "human",
			result: "Completed",
			workId: intake.id,
		});
		expect(await summarizeFeatureProgress(prisma, checkout.id)).toMatchObject({
			closedCount: 1,
			copy: { includedWork: "Included Work" },
			featureStatus: "Not Started",
			includedCount: 1,
		});
		expect(await getWork(prisma, checkout.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
	});

	it("keeps Feature health on the Feature and off the Project score", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "health-feature",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "health-task",
			projectId: project.id,
			title: "Intake checkout",
		});
		expect(
			await recordFeatureHealth(prisma, {
				actorId,
				baseRevision: intake.revision,
				idempotencyKey: "task-health",
				origin: "human",
				reason: "Payments lag",
				status: "At Risk",
				workId: intake.id,
			})
		).toEqual({
			reason: "feature-health-not-allowed",
			status: "rejected",
		});
		const recorded = await recordFeatureHealth(prisma, {
			actorId,
			baseRevision: checkout.revision,
			idempotencyKey: "feature-health",
			origin: "human",
			reason: "Checkout spike",
			status: "At Risk",
			workId: checkout.id,
		});
		expect(recorded).toMatchObject({
			status: "committed",
			work: { id: checkout.id, status: "Not Started", type: "Feature" },
		});
		expect(await getWorkScope(prisma, checkout.id)).toMatchObject({
			copy: {
				atRisk: "At Risk",
				featureHealth: "Feature health",
				offTrack: "Off Track",
				onTrack: "On Track",
			},
			healthHistory: [
				expect.objectContaining({
					reason: "Checkout spike",
					status: "At Risk",
				}),
			],
		});
		expect(await getWork(prisma, checkout.id)).toMatchObject({
			status: "Not Started",
		});
		const projectAfter = await getProject(prisma, project.id);
		expect(projectAfter && "healthScore" in projectAfter).toBe(false);
	});

	it("blocks leaving Feature while included Work, health history, or Primary spec remain", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "exit-feature",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "exit-task",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "include-exit",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		const withHealth = await recordFeatureHealth(prisma, {
			actorId,
			baseRevision: checkout.revision,
			idempotencyKey: "health-exit",
			origin: "human",
			status: "Off Track",
			workId: checkout.id,
		});
		if (withHealth.status !== "committed") {
			throw new Error("expected health");
		}
		const withSpec = await bindPrimarySpec(prisma, {
			actorId,
			baseRevision: withHealth.work.revision,
			idempotencyKey: "spec-exit",
			origin: "human",
			primarySpec: { id: "spec-checkout", title: "Checkout spec" },
			workId: checkout.id,
		});
		if (withSpec.status !== "committed") {
			throw new Error("expected Primary spec");
		}
		const blockedPreview = await previewWorkTypeChange(
			prisma,
			checkout.id,
			"Task"
		);
		expect(blockedPreview).toMatchObject({
			blocked: true,
			copy: FEATURE_IMPACT_COPY,
			healthHistory: [{ id: expect.any(String) }],
			includedWork: [{ id: intake.id, key: "PAY-2", title: "Intake checkout" }],
			primarySpec: { id: "spec-checkout", title: "Checkout spec" },
			requiresPreview: true,
			toType: "Task",
		});
		expect(
			await changeWorkType(prisma, {
				actorId,
				baseRevision: withSpec.work.revision,
				idempotencyKey: "leave-blocked",
				origin: "human",
				previewAcknowledged: true,
				type: "Task",
				workId: checkout.id,
			})
		).toEqual({
			reason: "feature-exit-blocked",
			status: "rejected",
		});
		const liveIncluded = await getWork(prisma, intake.id);
		if (!liveIncluded) {
			throw new Error("expected included Work");
		}
		await detachIncludedWork(prisma, {
			actorId,
			baseRevision: liveIncluded.revision,
			idempotencyKey: "detach-work",
			origin: "human",
			workId: intake.id,
		});
		await detachFeatureHealthHistory(prisma, {
			actorId,
			baseRevision: withSpec.work.revision,
			idempotencyKey: "detach-health",
			origin: "human",
			workId: checkout.id,
		});
		const afterHealth = await getWork(prisma, checkout.id);
		if (!afterHealth) {
			throw new Error("expected Feature");
		}
		await detachPrimarySpec(prisma, {
			actorId,
			baseRevision: afterHealth.revision,
			idempotencyKey: "detach-spec",
			origin: "human",
			workId: checkout.id,
		});
		const clearPreview = await previewWorkTypeChange(
			prisma,
			checkout.id,
			"Task"
		);
		expect(clearPreview).toMatchObject({
			blocked: false,
			healthHistory: [],
			includedWork: [],
			primarySpec: null,
		});
		const detached = await getWork(prisma, checkout.id);
		if (!detached) {
			throw new Error("expected Feature after detach");
		}
		const left = await changeWorkType(prisma, {
			actorId,
			baseRevision: detached.revision,
			idempotencyKey: "leave-after-detach",
			origin: "human",
			previewAcknowledged: true,
			type: "Task",
			workId: checkout.id,
		});
		expect(left).toMatchObject({
			status: "committed",
			work: { id: checkout.id, type: "Task" },
		});
		expect(await getWorkScope(prisma, intake.id)).toMatchObject({
			includedIn: null,
		});
	});

	it("opens Scope Tree as a read of Project → Feature → included Work", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "tree-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const wallet = await committedWork(prisma, actorId, {
			idempotencyKey: "tree-wallet",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "tree-intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "tree-include",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		const related = await relateWork(prisma, {
			actorId,
			baseRevision: included.work.revision,
			fromWorkId: intake.id,
			idempotencyKey: "tree-relate",
			origin: "human",
			toWorkId: wallet.id,
		});
		expect(related).toMatchObject({ status: "committed" });
		const tree = await getScopeTree(prisma, project.id);
		expect(tree).toMatchObject({
			copy: {
				openSourceRecord: "Open source record",
				scopeTree: "Scope Tree",
			},
			features: [
				{
					id: checkout.id,
					includedWork: [
						{
							id: intake.id,
							key: "PAY-3",
							status: "Not Started",
							title: "Intake checkout",
						},
					],
					key: "PAY-1",
					progress: {
						closedCount: 0,
						featureStatus: "Not Started",
						includedCount: 1,
					},
					status: "Not Started",
					title: "Checkout",
				},
				{
					id: wallet.id,
					includedWork: [],
					key: "PAY-2",
					progress: {
						closedCount: 0,
						featureStatus: "Not Started",
						includedCount: 0,
					},
					title: "Wallet",
				},
			],
			project: { id: project.id, name: "Payments" },
		});
		expect(
			tree?.features.flatMap((feature) =>
				feature.includedWork.map((work) => work.id)
			)
		).toEqual([intake.id]);
		expect(JSON.stringify(tree)).not.toMatch(HIERARCHY_PATTERN);
	});

	it("refuses Scope Tree drag so Includes stay on the primary Feature", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "drag-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const wallet = await committedWork(prisma, actorId, {
			idempotencyKey: "drag-wallet",
			projectId: project.id,
			title: "Wallet",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "drag-intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "drag-include",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		expect(
			await applyScopeTreeDrag(prisma, {
				targetFeatureId: wallet.id,
				workId: intake.id,
			})
		).toEqual({
			reason: "scope-tree-read-only",
			status: "rejected",
		});
		expect(await getWorkScope(prisma, intake.id)).toMatchObject({
			includedIn: { id: checkout.id },
		});
		expect(await getWorkScope(prisma, wallet.id)).toMatchObject({
			includedWork: [],
		});
		expect(await getScopeTree(prisma, project.id)).toMatchObject({
			features: [
				{ id: checkout.id, includedWork: [{ id: intake.id }] },
				{ id: wallet.id, includedWork: [] },
			],
		});
	});

	it("shows Scope Tree status and Feature progress from the Work records", async () => {
		const { actorId, project } = await openPayments(prisma);
		const checkout = await committedWork(prisma, actorId, {
			idempotencyKey: "source-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "source-intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: checkout.id,
			idempotencyKey: "source-include",
			origin: "human",
			workId: intake.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected inclusion");
		}
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: included.work.revision,
			idempotencyKey: "source-close",
			origin: "human",
			result: "Completed",
			workId: intake.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected close");
		}
		expect(await summarizeFeatureProgress(prisma, checkout.id)).toMatchObject({
			closedCount: 1,
			featureStatus: "Not Started",
			includedCount: 1,
		});
		expect(await getScopeTree(prisma, project.id)).toMatchObject({
			features: [
				{
					id: checkout.id,
					includedWork: [{ id: intake.id, status: "Closed" }],
					progress: {
						closedCount: 1,
						featureStatus: "Not Started",
						includedCount: 1,
					},
					status: "Not Started",
				},
			],
		});
	});
});

describe("Feature inclusion scope reads", () => {
	it("opens a Task without treating a missing inclusion host as a lookup", async () => {
		const prisma = scopeReader({
			includedInFeatureId: undefined,
		});
		await expect(getWorkScope(prisma, "task-1")).resolves.toMatchObject({
			includedIn: null,
			includedWork: [],
			relatedWork: [],
		});
	});

	it("opens a Task when Feature health and Related delegates are absent", async () => {
		const prisma = scopeReader({
			includedInFeatureId: null,
			omitFeatureDelegates: true,
		});
		await expect(getWorkScope(prisma, "task-1")).resolves.toMatchObject({
			healthHistory: [],
			includedIn: null,
			relatedWork: [],
		});
	});
});

function scopeReader(input: {
	includedInFeatureId: string | null | undefined;
	omitFeatureDelegates?: boolean;
}): PrismaClient {
	const work = {
		id: "task-1",
		includedInFeatureId: input.includedInFeatureId,
		key: "CLO-4",
		primarySpecId: null,
		primarySpecTitle: null,
		title: "Cloud Work 02",
	};
	const reader = {
		featureHealthUpdate: input.omitFeatureDelegates
			? undefined
			: {
					findMany: () => Promise.resolve([]),
				},
		work: {
			findMany: () => Promise.resolve([]),
			findUnique: (args: { where: { id?: string } }) => {
				if (typeof args.where.id !== "string" || args.where.id.length === 0) {
					return Promise.reject(
						new Error(
							"Invalid `prisma.work.findUnique()` invocation: missing id"
						)
					);
				}
				return Promise.resolve(args.where.id === work.id ? work : null);
			},
		},
		workRelatedEdge: input.omitFeatureDelegates
			? undefined
			: {
					findMany: () => Promise.resolve([]),
				},
	};
	return reader as unknown as PrismaClient;
}

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	input: {
		idempotencyKey: string;
		projectId: string;
		title: string;
		type?: string;
	}
) {
	const created = await createWork(prisma, createCommand(input, actorId));
	if (created.status !== "committed") {
		throw new Error(`expected committed Work, got ${created.status}`);
	}
	return created.work;
}

async function createNamedWork(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string,
	idempotencyKey: string,
	type?: string
) {
	const outcome = await createWork(
		prisma,
		createCommand(
			{
				idempotencyKey,
				projectId,
				title,
				type,
			},
			actorId
		)
	);
	if (outcome.status !== "committed") {
		throw new Error(`expected committed ${title}`);
	}
	return outcome.work;
}
