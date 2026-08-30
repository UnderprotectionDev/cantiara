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
import {
	closeWork,
	createWork,
	listWork,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	applyNonClosingHandoffEvent,
	cancelHandoff,
	listHandoffsForWork,
	startHandoff,
} from "./external-handoffs";
import {
	EXTERNAL_HANDOFFS_COPY,
	handoffStatusCatalog,
} from "./external-handoffs-model";

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

async function startCheckoutHandoff(
	prisma: PrismaClient,
	actorId: string,
	work: { id: string; revision: number; title: string },
	idempotencyKey: string
) {
	const started = await startHandoff(prisma, {
		actorId,
		idempotencyKey,
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
	return started.handoff;
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
		expect(EXTERNAL_HANDOFFS_COPY).toEqual({
			canceled: "Canceled",
			cancelHandoff: "Cancel Handoff",
			constraints: "Constraints",
			executor: "Executor",
			expectedOutput: "Expected output",
			externalExecutionHandoff: "External Execution Handoff",
			github: "GitHub",
			handoff: "Handoff",
			open: "Open",
			producedAt: "Produced at",
			purpose: "Purpose",
			reason: "Reason",
			reconciled: "Reconciled",
			resultReturned: "Result returned",
			selectedVersions: "Selected versions",
			sourceOfTruth: "Source of truth is in the app",
			startHandoff: "Start Handoff",
		});
		expect(JSON.stringify(EXTERNAL_HANDOFFS_COPY)).not.toMatch(
			FORBIDDEN_PRODUCT
		);
		expect(handoffStatusCatalog()).toEqual([
			{ status: "Open", terminal: false },
			{ status: "Result returned", terminal: false },
			{ status: "Reconciled", terminal: true },
			{ status: "Canceled", terminal: true },
		]);
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
		expect(started.handoff.copy).toEqual({
			canceled: "Canceled",
			cancelHandoff: "Cancel Handoff",
			externalExecutionHandoff: "External Execution Handoff",
			open: "Open",
			reconciled: "Reconciled",
			resultReturned: "Result returned",
			sourceOfTruth: "Source of truth is in the app",
			startHandoff: "Start Handoff",
		});
		expect(started.handoff.terminal).toBe(false);
		expect(started.handoff.cancelReason).toBeNull();
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([started.handoff.id]);
		expect(JSON.stringify(started.handoff)).not.toMatch(FORBIDDEN_PRODUCT);
		const worksAfter = await listWork(prisma, project.id);
		expect(worksAfter.map((item) => item.id)).toEqual([work.id]);
		expect(Object.keys(appRouter.externalHandoffs).sort()).toEqual([
			"cancel",
			"list",
			"start",
		]);
		expect(Object.keys(appRouter.externalHandoffs)).not.toContain(
			"assignToExternalHuman"
		);
		expect(Object.keys(appRouter.externalHandoffs)).not.toContain(
			"recordTestSession"
		);
		expect(Object.keys(appRouter.externalHandoffs)).not.toContain(
			"recordProductGapEscape"
		);
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

	it("cancels with a reason, keeps history, and starts a new handoff instead of reopening", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const openHandoff = await startCheckoutHandoff(
			prisma,
			actorId,
			work,
			"start-handoff"
		);
		const goingMarkdown = openHandoff.goingPackage.markdown;
		expect(
			await cancelHandoff(prisma, {
				actorId,
				idempotencyKey: "cancel-empty",
				origin: "human",
				payload: { handoffId: openHandoff.id, reason: "   " },
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
		expect(await listHandoffsForWork(prisma, work.id)).toEqual([openHandoff]);
		const canceled = await cancelHandoff(prisma, {
			actorId,
			idempotencyKey: "cancel-handoff",
			origin: "human",
			payload: {
				handoffId: openHandoff.id,
				reason: "Executor path is no longer needed.",
			},
		});
		expect(canceled.status).toBe("committed");
		if (canceled.status !== "committed") {
			return;
		}
		expect(canceled.handoff.id).toBe(openHandoff.id);
		expect(canceled.handoff.status).toBe("Canceled");
		expect(canceled.handoff.terminal).toBe(true);
		expect(canceled.handoff.cancelReason).toBe(
			"Executor path is no longer needed."
		);
		expect(canceled.handoff.goingPackage.markdown).toBe(goingMarkdown);
		expect(canceled.handoff.separations).toEqual({
			externalHumanAssignment: false,
			officialTestHistory: false,
			productGapEscape: false,
			publishArtifact: false,
			testHandoffPackage: false,
			testSession: false,
		});
		const listedCanceled = await listHandoffsForWork(prisma, work.id);
		expect(listedCanceled.map((item) => item.id)).toEqual([openHandoff.id]);
		expect(listedCanceled[0]?.status).toBe("Canceled");
		expect(listedCanceled[0]?.goingPackage.markdown).toBe(goingMarkdown);
		const restarted = await startCheckoutHandoff(
			prisma,
			actorId,
			work,
			"start-after-cancel"
		);
		expect(restarted.id).not.toBe(openHandoff.id);
		expect(restarted.status).toBe("Open");
		expect(restarted.terminal).toBe(false);
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([
			openHandoff.id,
			restarted.id,
		]);
		expect(listed.map((item) => item.status)).toEqual(["Canceled", "Open"]);
		const replayed = await cancelHandoff(prisma, {
			actorId,
			idempotencyKey: "cancel-handoff",
			origin: "human",
			payload: {
				handoffId: openHandoff.id,
				reason: "Executor path is no longer needed.",
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			return;
		}
		expect(replayed.handoff.status).toBe("Canceled");
		expect(
			await cancelHandoff(prisma, {
				actorId,
				idempotencyKey: "cancel-again",
				origin: "human",
				payload: {
					handoffId: openHandoff.id,
					reason: "Trying to reopen by canceling again.",
				},
			})
		).toEqual({ reason: "already-terminal", status: "rejected" });
		expect(
			(await listHandoffsForWork(prisma, work.id)).find(
				(item) => item.id === openHandoff.id
			)?.status
		).toBe("Canceled");
	});

	it("does not terminal on commit, PR, result-arrived, or Work Closed", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const openHandoff = await startCheckoutHandoff(
			prisma,
			actorId,
			work,
			"start-handoff"
		);
		const commitBound = await applyNonClosingHandoffEvent(prisma, {
			event: "github-commit-bound",
			handoffId: openHandoff.id,
			identifier: "underprotection/cantiara#160",
		});
		const prBound = await applyNonClosingHandoffEvent(prisma, {
			event: "github-pull-request-bound",
			handoffId: openHandoff.id,
			identifier: "underprotection/cantiara#160",
		});
		const resultArrived = await applyNonClosingHandoffEvent(prisma, {
			event: "external-result-arrived",
			handoffId: openHandoff.id,
			identifier: "underprotection/cantiara#160",
		});
		expect(commitBound).toMatchObject({
			reason: "not-a-terminal-event",
			status: "ignored",
		});
		expect(prBound).toMatchObject({
			reason: "not-a-terminal-event",
			status: "ignored",
		});
		expect(resultArrived).toMatchObject({
			reason: "not-a-terminal-event",
			status: "ignored",
		});
		if (
			commitBound.status !== "ignored" ||
			prBound.status !== "ignored" ||
			resultArrived.status !== "ignored"
		) {
			return;
		}
		expect(commitBound.handoff.status).toBe("Open");
		expect(prBound.handoff.status).toBe("Open");
		expect(resultArrived.handoff.status).toBe("Open");
		expect(commitBound.handoff.terminal).toBe(false);
		expect(commitBound.handoff.id).toBe(openHandoff.id);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "close-checkout",
			origin: "human",
			reason: "Shipped checkout",
			result: "Completed",
			workId: work.id,
		});
		expect(closed).toMatchObject({
			status: "committed",
			work: { status: "Closed" },
		});
		const afterClose = await listHandoffsForWork(prisma, work.id);
		expect(afterClose).toHaveLength(1);
		expect(afterClose[0]?.id).toBe(openHandoff.id);
		expect(afterClose[0]?.status).toBe("Open");
		expect(afterClose[0]?.terminal).toBe(false);
		expect(afterClose[0]?.separations.testHandoffPackage).toBe(false);
		expect(afterClose[0]?.separations.testSession).toBe(false);
		expect(afterClose[0]?.separations.productGapEscape).toBe(false);
		expect(afterClose[0]?.separations.officialTestHistory).toBe(false);
		expect(afterClose[0]?.goingPackage.publishArtifact).toBe(false);
	});
});
