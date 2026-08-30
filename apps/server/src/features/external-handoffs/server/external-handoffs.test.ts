/**
 * External Execution Handoff seam — Start Handoff on Work
 * creates a Work-owned going package from the selected exact
 * version manifest. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Dış yürütme devri: going package).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../../../routes";
import { TEST_SOURCE_DETAIL } from "../../project-overview/server/project-overview";
import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import {
	createWork,
	getWork,
	listWork,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	confirmReconcile,
	listHandoffsForWork,
	previewReconcile,
	recordReturn,
	rejectReconcile,
	startHandoff,
} from "./external-handoffs";
import { EXTERNAL_HANDOFFS_COPY } from "./external-handoffs-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FORBIDDEN_PRODUCT =
	/coding session|agent task|independent Handoff main record|commit arrived/i;
const RUNNER_PATTERN =
	/launchAgent|pollCi|streamTelemetry|spawnTerminal|cloneRepository/i;
const LIVE_SYNC_PATTERN =
	/liveSync":true|repositoryCopy":true|publishArtifact":true/;

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

async function createNamedWork(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string,
	idempotencyKey: string
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey,
		origin: "human",
		payload: { projectId, title },
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Work");
	}
	return created.work;
}

describe("External Execution Handoff", () => {
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

	it("uses English External Execution Handoff, Start Handoff, Open, and Source of truth is in the app", () => {
		expect(EXTERNAL_HANDOFFS_COPY).toMatchObject({
			constraints: "Constraints",
			executor: "Executor",
			expectedOutput: "Expected output",
			externalExecutionHandoff: "External Execution Handoff",
			github: "GitHub",
			handoff: "Handoff",
			open: "Open",
			producedAt: "Produced at",
			purpose: "Purpose",
			reconcile: "Reconcile",
			reconciled: "Reconciled",
			resultReturned: "Result returned",
			selectedVersions: "Selected versions",
			sourceOfTruth: "Source of truth is in the app",
			startHandoff: "Start Handoff",
		});
		expect(JSON.stringify(EXTERNAL_HANDOFFS_COPY)).not.toMatch(
			FORBIDDEN_PRODUCT
		);
	});

	it("starts an Open Work-owned handoff and does not mint an independent main record", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const started = await startHandoff(prisma, {
			actorId,
			idempotencyKey: "start-handoff",
			origin: "human",
			payload: {
				constraints: "Do not change payment capture.",
				executorVisibleName: "Cursor",
				expectedOutput: "A dated going package for the checkout Work.",
				purpose: "Code the checkout path outside Cantiara.",
				selectedVersions: [
					{
						kind: "Work",
						recordId: work.id,
						title: work.title,
						versionId: String(work.revision),
					},
				],
				workId: work.id,
			},
		});
		expect(started.status).toBe("committed");
		if (started.status !== "committed") {
			return;
		}
		expect(started.handoff.status).toBe(EXTERNAL_HANDOFFS_COPY.open);
		expect(started.handoff.workId).toBe(work.id);
		expect(started.handoff.workKey).toBe(work.key);
		expect(started.handoff.purpose).toBe(
			"Code the checkout path outside Cantiara."
		);
		expect(started.handoff.expectedOutput).toBe(
			"A dated going package for the checkout Work."
		);
		expect(started.handoff.executorVisibleName).toBe("Cursor");
		expect(started.handoff.constraints).toBe("Do not change payment capture.");
		expect(started.handoff.identity).toEqual({
			independentLifecycle: false,
			independentMainRecord: false,
			ownedByWorkId: work.id,
			searchableApartFromWork: false,
			shareableApartFromWork: false,
		});
		expect(started.handoff.copy).toMatchObject({
			externalExecutionHandoff: "External Execution Handoff",
			open: "Open",
			reconcile: "Reconcile",
			reconciled: "Reconciled",
			resultReturned: "Result returned",
			sourceOfTruth: "Source of truth is in the app",
			startHandoff: "Start Handoff",
		});
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([started.handoff.id]);
		expect(JSON.stringify(started.handoff)).not.toMatch(FORBIDDEN_PRODUCT);
		const worksAfter = await listWork(prisma, project.id);
		expect(worksAfter.map((item) => item.id)).toEqual([work.id]);
		expect(Object.keys(appRouter.externalHandoffs).sort()).toEqual([
			"confirmReconcile",
			"list",
			"previewReconcile",
			"recordReturn",
			"rejectReconcile",
			"start",
		]);
		expect(TEST_SOURCE_DETAIL.handoff).toBe("Test Handoff");
		expect(TEST_SOURCE_DETAIL.handoff).not.toBe(
			EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff
		);
	});

	it("snapshots the live Work version instead of a stale client title", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const started = await startHandoff(prisma, {
			actorId,
			idempotencyKey: "start-live-work",
			origin: "human",
			payload: {
				constraints: "Keep capture.",
				executorVisibleName: "Cursor",
				expectedOutput: "Dated package.",
				purpose: "Code checkout.",
				selectedVersions: [
					{
						kind: "Work",
						recordId: work.id,
						title: "Stale client title",
						versionId: "0",
					},
				],
				workId: work.id,
			},
		});
		expect(started.status).toBe("committed");
		if (started.status !== "committed") {
			return;
		}
		expect(started.handoff.goingPackage.markdown).toContain("Checkout");
		expect(started.handoff.goingPackage.markdown).not.toContain(
			"Stale client title"
		);
		expect(started.handoff.selectedVersions).toEqual([
			{
				kind: "Work",
				recordId: work.id,
				title: "Checkout",
				versionId: String(work.revision),
			},
		]);
	});

	it("produces dated Markdown from the selected version manifest only", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const related = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Unselected Wallet",
			"create-wallet"
		);
		const linked = await relateWork(prisma, {
			actorId,
			baseRevision: work.revision,
			fromWorkId: work.id,
			idempotencyKey: "relate-wallet",
			origin: "human",
			toWorkId: related.id,
		});
		expect(linked.status).toBe("committed");
		const started = await startHandoff(prisma, {
			actorId,
			idempotencyKey: "start-package",
			origin: "human",
			payload: {
				constraints: "Keep the capture path.",
				executorVisibleName: "Cursor",
				expectedOutput: "Readable going package.",
				permittedGithubContext: [
					{ identifier: "underprotection/cantiara#160" },
				],
				purpose: "Code checkout outside the app.",
				selectedVersions: [
					{
						body: "Checkout remains in Cantiara.",
						fields: [
							{ name: "Token", secret: true, value: "sk-live-handoff-secret" },
							{
								inaccessible: true,
								name: "Private note",
								value: "founder-only-note",
							},
							{ name: "Acceptance", value: "Package stays dated." },
						],
						kind: "Work",
						recordId: work.id,
						title: work.title,
						versionId: String(work.revision),
					},
					{
						body: "Pin the checkout contract.",
						kind: "Document",
						recordId: "doc-checkout-contract",
						title: "Checkout contract",
						versionId: "doc-v3",
					},
					{
						body: "Keep capture on the Work.",
						kind: "Decision",
						recordId: "decision-capture",
						title: "Capture stays on Work",
						versionId: "decision-v1",
					},
					{
						body: "Card brands can drift.",
						kind: "Risk",
						recordId: "risk-brands",
						title: "Brand drift",
						versionId: "risk-v1",
					},
					{
						body: "Which wallet SDK?",
						kind: "Open Question",
						recordId: "question-wallet",
						title: "Wallet SDK",
						versionId: "question-v1",
					},
					{
						body: "Stripe checkout guide.",
						kind: "Source",
						recordId: "source-stripe",
						title: "Stripe guide",
						versionId: "source-v2",
					},
				],
				workId: work.id,
			},
		});
		expect(started.status).toBe("committed");
		if (started.status !== "committed") {
			return;
		}
		const { goingPackage, id, runner } = started.handoff;
		const { markdown } = goingPackage;
		expect(markdown).toContain(work.key);
		expect(markdown).toContain(id);
		expect(markdown).toContain(goingPackage.producedAt);
		expect(markdown).toContain(EXTERNAL_HANDOFFS_COPY.sourceOfTruth);
		expect(markdown).toContain("Checkout remains in Cantiara.");
		expect(markdown).toContain("Pin the checkout contract.");
		expect(markdown).toContain("Keep capture on the Work.");
		expect(markdown).toContain("Card brands can drift.");
		expect(markdown).toContain("Which wallet SDK?");
		expect(markdown).toContain("Stripe checkout guide.");
		expect(markdown).toContain("Package stays dated.");
		expect(markdown).toContain("underprotection/cantiara#160");
		expect(markdown).not.toContain("Unselected Wallet");
		expect(markdown).not.toContain("sk-live-handoff-secret");
		expect(markdown).not.toContain("founder-only-note");
		expect(started.handoff.selectedVersions.map((item) => item.kind)).toEqual([
			"Work",
			"Document",
			"Decision",
			"Risk",
			"Open Question",
			"Source",
		]);
		expect(started.handoff.permittedGithubContext).toEqual([
			{ identifier: "underprotection/cantiara#160" },
		]);
		expect(await listHandoffsForWork(prisma, related.id)).toEqual([]);
		expect(goingPackage).toMatchObject({
			liveSync: false,
			publishArtifact: false,
			repositoryCopy: false,
		});
		expect(runner).toEqual({
			ci: false,
			externalAgent: false,
			ide: false,
			repository: false,
			telemetry: false,
			terminal: false,
		});
		expect(JSON.stringify(started.handoff)).not.toMatch(RUNNER_PATTERN);
		expect(JSON.stringify(started.handoff)).not.toMatch(LIVE_SYNC_PATTERN);
	});

	it("records a late return on the same handoff as Result returned without changing Work status or minting records", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const { related, started, work } = await startCheckoutWithRelated(
			prisma,
			actorId,
			project.id
		);
		const returned = await recordReturn(prisma, {
			actorId,
			idempotencyKey: "record-return",
			origin: "human",
			payload: {
				changedAssumptions: "Capture stays on the Work.",
				executorSummary: "Checkout path coded outside the app.",
				handoffId: started.handoff.id,
				openQuestions: "Which wallet SDK remains open.",
				permittedExternalLinks: [
					{ identifier: "https://example.com/checkout-diff" },
				],
				producedEvidence: "Diff notes for the checkout path.",
				proposedFollowUpWork: [
					{
						id: "follow-up-wallet",
						title: "Wallet follow-up",
					},
				],
				proposedRelations: [
					{
						id: "relate-wallet",
						toId: related.id,
						toKind: "Work",
						toTitle: related.title,
						type: "Related",
					},
				],
			},
		});
		expect(returned.status).toBe("committed");
		if (returned.status !== "committed") {
			return;
		}
		expect(returned.handoff.id).toBe(started.handoff.id);
		expect(returned.handoff.status).toBe(EXTERNAL_HANDOFFS_COPY.resultReturned);
		expect(returned.handoff.returnRecord).toEqual({
			changedAssumptions: "Capture stays on the Work.",
			executorSummary: "Checkout path coded outside the app.",
			openQuestions: "Which wallet SDK remains open.",
			permittedExternalLinks: [
				{ identifier: "https://example.com/checkout-diff" },
			],
			producedEvidence: "Diff notes for the checkout path.",
			proposedFollowUpWork: [
				{ id: "follow-up-wallet", title: "Wallet follow-up" },
			],
			proposedRelations: [
				{
					id: "relate-wallet",
					toId: related.id,
					toKind: "Work",
					toTitle: related.title,
					type: "Related",
				},
			],
		});
		expect(returned.handoff.reconcileDecision).toBeNull();
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.status)).toEqual([
			EXTERNAL_HANDOFFS_COPY.resultReturned,
		]);
		const after = await getWork(prisma, work.id);
		expect(after?.status).toBe("Not Started");
		expect((await listWork(prisma, project.id)).map((item) => item.id)).toEqual(
			[work.id, related.id]
		);
		expect(
			await listRelations(prisma, {
				record: { id: work.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		expect(JSON.stringify(returned.handoff)).not.toMatch(FORBIDDEN_PRODUCT);
	});

	it("previews Reconcile writes and rejects without creating records", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const { related, started, work } = await startCheckoutWithRelated(
			prisma,
			actorId,
			project.id
		);
		await recordCheckoutReturn(prisma, actorId, started.handoff.id, related);
		const preview = await previewReconcile(prisma, started.handoff.id);
		expect(preview.status).toBe("ok");
		if (preview.status !== "ok") {
			return;
		}
		expect(preview.preview).toEqual({
			copy: {
				confirm: EXTERNAL_HANDOFFS_COPY.confirm,
				followUpWork: EXTERNAL_HANDOFFS_COPY.followUpWork,
				reconcile: EXTERNAL_HANDOFFS_COPY.reconcile,
				reject: EXTERNAL_HANDOFFS_COPY.reject,
				related: EXTERNAL_HANDOFFS_COPY.related,
			},
			followUpWork: [{ id: "follow-up-wallet", title: "Wallet follow-up" }],
			gitMerge: false,
			importWizard: false,
			relations: [
				{
					id: "relate-wallet",
					toId: related.id,
					toKind: "Work",
					toTitle: related.title,
					type: "Related",
				},
			],
		});
		const rejected = await rejectReconcile(prisma, {
			actorId,
			idempotencyKey: "reject-reconcile",
			origin: "human",
			payload: { handoffId: started.handoff.id },
		});
		expect(rejected.status).toBe("committed");
		if (rejected.status !== "committed") {
			return;
		}
		expect(rejected.handoff.status).toBe(EXTERNAL_HANDOFFS_COPY.resultReturned);
		expect(rejected.handoff.reconcileDecision).toBeNull();
		expect((await listWork(prisma, project.id)).map((item) => item.id)).toEqual(
			[work.id, related.id]
		);
		expect(
			await listRelations(prisma, {
				record: { id: work.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const after = await getWork(prisma, work.id);
		expect(after?.status).toBe("Not Started");
	});

	it("confirms only the chosen Reconcile subset atomically and stores a historical Reconcile decision", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const { related, started, work } = await startCheckoutWithRelated(
			prisma,
			actorId,
			project.id
		);
		await recordCheckoutReturn(prisma, actorId, started.handoff.id, related);
		const withoutPreview = await confirmReconcile(prisma, {
			actorId,
			idempotencyKey: "confirm-without-preview",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
				previewAcknowledged: false,
				selectedFollowUpWorkIds: ["follow-up-wallet"],
				selectedRelationIds: ["relate-wallet"],
			},
		});
		expect(withoutPreview.status).toBe("rejected");
		expect((await listWork(prisma, project.id)).map((item) => item.id)).toEqual(
			[work.id, related.id]
		);
		const failedAtomic = await confirmReconcile(prisma, {
			actorId,
			idempotencyKey: "confirm-invalid-subset",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
				previewAcknowledged: true,
				selectedFollowUpWorkIds: ["follow-up-wallet"],
				selectedRelationIds: ["missing-relation"],
			},
		});
		expect(failedAtomic.status).toBe("rejected");
		expect((await listWork(prisma, project.id)).map((item) => item.id)).toEqual(
			[work.id, related.id]
		);
		expect(
			await listRelations(prisma, {
				record: { id: work.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const listedAfterFail = await listHandoffsForWork(prisma, work.id);
		expect(listedAfterFail.map((item) => item.status)).toEqual([
			EXTERNAL_HANDOFFS_COPY.resultReturned,
		]);
		const confirmed = await confirmReconcile(prisma, {
			actorId,
			idempotencyKey: "confirm-partial",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
				previewAcknowledged: true,
				selectedFollowUpWorkIds: ["follow-up-wallet"],
				selectedRelationIds: [],
			},
		});
		expect(confirmed.status).toBe("committed");
		if (confirmed.status !== "committed") {
			return;
		}
		expect(confirmed.handoff.status).toBe(EXTERNAL_HANDOFFS_COPY.reconciled);
		expect(confirmed.handoff.reconcileDecision?.kind).toBe(
			EXTERNAL_HANDOFFS_COPY.reconcile
		);
		expect(
			confirmed.handoff.reconcileDecision?.selectedFollowUpWorkIds
		).toEqual(["follow-up-wallet"]);
		expect(confirmed.handoff.reconcileDecision?.selectedRelationIds).toEqual(
			[]
		);
		const works = await listWork(prisma, project.id);
		expect(works.map((item) => item.title)).toEqual([
			"Checkout",
			"Wallet",
			"Wallet follow-up",
		]);
		const followUp = works.find((item) => item.title === "Wallet follow-up");
		expect(followUp).toBeDefined();
		const relations = await listRelations(prisma, {
			record: { id: work.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations.map((item) => item.to.id).sort()).toEqual(
			[followUp?.id].sort()
		);
		expect((await getWork(prisma, work.id))?.status).toBe("Not Started");
		const replayed = await confirmReconcile(prisma, {
			actorId,
			idempotencyKey: "confirm-partial",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
				previewAcknowledged: true,
				selectedFollowUpWorkIds: ["follow-up-wallet"],
				selectedRelationIds: [],
			},
		});
		expect(replayed.status).toBe("replayed");
		expect(
			(await listWork(prisma, project.id)).map((item) => item.title)
		).toEqual(["Checkout", "Wallet", "Wallet follow-up"]);
	});

	it("does not mint records from return prose without a Reconcile preview", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const started = await startNamedHandoff(prisma, actorId, work);
		const returned = await recordReturn(prisma, {
			actorId,
			idempotencyKey: "prose-return",
			origin: "human",
			payload: {
				changedAssumptions: "None.",
				executorSummary:
					"Create a Decision called Capture stays and a Risk called Brand drift.",
				handoffId: started.handoff.id,
				openQuestions: "Should we mint an Open Question from this sentence?",
				producedEvidence: "Attached notes are still handoff text.",
			},
		});
		expect(returned.status).toBe("committed");
		expect((await listWork(prisma, project.id)).map((item) => item.id)).toEqual(
			[work.id]
		);
		expect(
			await listRelations(prisma, {
				record: { id: work.id, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
	});
});

async function startNamedHandoff(
	prisma: PrismaClient,
	actorId: string,
	work: { id: string; revision: number; title: string }
) {
	const started = await startHandoff(prisma, {
		actorId,
		idempotencyKey: `start-${work.id}`,
		origin: "human",
		payload: {
			constraints: "Do not change payment capture.",
			executorVisibleName: "Cursor",
			expectedOutput: "A dated going package for the checkout Work.",
			purpose: "Code the checkout path outside Cantiara.",
			selectedVersions: [
				{
					kind: "Work",
					recordId: work.id,
					title: work.title,
					versionId: String(work.revision),
				},
			],
			workId: work.id,
		},
	});
	if (started.status !== "committed") {
		throw new Error("expected committed handoff");
	}
	return started;
}

async function startCheckoutWithRelated(
	prisma: PrismaClient,
	actorId: string,
	projectId: string
) {
	const work = await createNamedWork(
		prisma,
		actorId,
		projectId,
		"Checkout",
		"create-checkout"
	);
	const related = await createNamedWork(
		prisma,
		actorId,
		projectId,
		"Wallet",
		"create-wallet"
	);
	const started = await startNamedHandoff(prisma, actorId, work);
	return { related, started, work };
}

async function recordCheckoutReturn(
	prisma: PrismaClient,
	actorId: string,
	handoffId: string,
	related: { id: string; title: string }
) {
	const returned = await recordReturn(prisma, {
		actorId,
		idempotencyKey: `return-${handoffId}`,
		origin: "human",
		payload: {
			changedAssumptions: "Capture stays on the Work.",
			executorSummary: "Checkout path coded outside the app.",
			handoffId,
			openQuestions: "Which wallet SDK remains open.",
			permittedExternalLinks: [
				{ identifier: "https://example.com/checkout-diff" },
			],
			producedEvidence: "Diff notes for the checkout path.",
			proposedFollowUpWork: [
				{ id: "follow-up-wallet", title: "Wallet follow-up" },
			],
			proposedRelations: [
				{
					id: "relate-wallet",
					toId: related.id,
					toKind: "Work",
					toTitle: related.title,
					type: "Related",
				},
			],
		},
	});
	if (returned.status !== "committed") {
		throw new Error("expected committed return");
	}
	return returned;
}
