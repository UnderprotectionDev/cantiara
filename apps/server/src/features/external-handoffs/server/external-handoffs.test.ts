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
	createWork,
	listWork,
	listWorkLifecycleHistory,
	relateWork,
	updateWorkTitle,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	listHandoffHistoryForWork,
	listHandoffsForWork,
	produceGoingPackage,
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
const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

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
		expect(EXTERNAL_HANDOFFS_COPY).toEqual({
			constraints: "Constraints",
			executor: "Executor",
			expectedOutput: "Expected output",
			externalExecutionHandoff: "External Execution Handoff",
			github: "GitHub",
			goingPackage: "Going package",
			handoff: "Handoff",
			newPackageVersion: "New package version",
			open: "Open",
			packageVersion: "Package version",
			producedAt: "Produced at",
			purpose: "Purpose",
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
		expect(started.handoff.copy).toEqual({
			externalExecutionHandoff: "External Execution Handoff",
			open: "Open",
			sourceOfTruth: "Source of truth is in the app",
			startHandoff: "Start Handoff",
		});
		expect(started.handoff.goingPackage.version).toBe(1);
		expect(
			started.handoff.goingPackageVersions.map((item) => item.version)
		).toEqual([1]);
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([started.handoff.id]);
		expect(JSON.stringify(started.handoff)).not.toMatch(FORBIDDEN_PRODUCT);
		const worksAfter = await listWork(prisma, project.id);
		expect(worksAfter.map((item) => item.id)).toEqual([work.id]);
		expect(Object.keys(appRouter.externalHandoffs).sort()).toEqual([
			"history",
			"list",
			"produceGoingPackage",
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

	it("keeps the first handoff when a second Start Handoff runs on the same Work", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const first = await startHandoff(prisma, {
			actorId,
			idempotencyKey: "start-first-coding-pass",
			origin: "human",
			payload: {
				constraints: "Do not change payment capture.",
				executorVisibleName: "Cursor",
				expectedOutput: "First going package.",
				purpose: "First coding pass.",
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
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			return;
		}
		const firstPackage = first.handoff.goingPackage.markdown;
		const second = await startHandoff(prisma, {
			actorId,
			idempotencyKey: "start-second-coding-pass",
			origin: "human",
			payload: {
				constraints: "Keep the first pass history.",
				executorVisibleName: "Claude",
				expectedOutput: "Second going package.",
				purpose: "Second coding pass.",
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
		expect(second.status).toBe("committed");
		if (second.status !== "committed") {
			return;
		}
		expect(second.handoff.id).not.toBe(first.handoff.id);
		expect(second.handoff.purpose).toBe("Second coding pass.");
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([
			first.handoff.id,
			second.handoff.id,
		]);
		const kept = listed.find((item) => item.id === first.handoff.id);
		expect(kept?.purpose).toBe("First coding pass.");
		expect(kept?.expectedOutput).toBe("First going package.");
		expect(kept?.executorVisibleName).toBe("Cursor");
		expect(kept?.constraints).toBe("Do not change payment capture.");
		expect(kept?.goingPackage.markdown).toBe(firstPackage);
		expect(kept?.goingPackage.markdown).not.toContain("Second coding pass.");
		expect(second.handoff.goingPackage.markdown).not.toBe(firstPackage);
	});

	it("does not rewrite a sent going package when Work or Decision sources change", async () => {
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
			idempotencyKey: "start-frozen-package",
			origin: "human",
			payload: {
				constraints: "Keep capture.",
				executorVisibleName: "Cursor",
				expectedOutput: "Dated package.",
				purpose: "Code checkout.",
				selectedVersions: [
					{
						body: "Checkout remains in Cantiara.",
						kind: "Work",
						recordId: work.id,
						title: work.title,
						versionId: String(work.revision),
					},
					{
						body: "Pin the checkout contract.",
						kind: "Decision",
						recordId: "decision-capture",
						title: "Capture stays on Work",
						versionId: "decision-v1",
					},
				],
				workId: work.id,
			},
		});
		expect(started.status).toBe("committed");
		if (started.status !== "committed") {
			return;
		}
		const sentMarkdown = started.handoff.goingPackage.markdown;
		expect(sentMarkdown).toContain("Checkout");
		expect(sentMarkdown).toContain("Pin the checkout contract.");
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "rename-after-send",
			origin: "human",
			title: "Checkout after send",
			workId: work.id,
		});
		expect(renamed.status).toBe("committed");
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.goingPackage.markdown).toBe(sentMarkdown);
		expect(listed[0]?.goingPackage.markdown).not.toContain(
			"Checkout after send"
		);
		expect(listed[0]?.goingPackage.markdown).toContain(
			"Pin the checkout contract."
		);
		expect(listed[0]?.goingPackage.producedAt).toBe(
			started.handoff.goingPackage.producedAt
		);
	});

	it("adds a new going package version on the same handoff without replacing the sent copy", async () => {
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
			idempotencyKey: "start-before-new-version",
			origin: "human",
			payload: {
				constraints: "Keep capture.",
				executorVisibleName: "Cursor",
				expectedOutput: "Dated package.",
				purpose: "Code checkout.",
				selectedVersions: [
					{
						body: "Checkout remains in Cantiara.",
						kind: "Work",
						recordId: work.id,
						title: work.title,
						versionId: String(work.revision),
					},
					{
						body: "Pin the checkout contract.",
						kind: "Decision",
						recordId: "decision-capture",
						title: "Capture stays on Work",
						versionId: "decision-v1",
					},
				],
				workId: work.id,
			},
		});
		expect(started.status).toBe("committed");
		if (started.status !== "committed") {
			return;
		}
		const sentMarkdown = started.handoff.goingPackage.markdown;
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "rename-before-new-version",
			origin: "human",
			title: "Checkout after send",
			workId: work.id,
		});
		expect(renamed.status).toBe("committed");
		if (renamed.status !== "committed") {
			return;
		}
		const produced = await produceGoingPackage(prisma, {
			actorId,
			idempotencyKey: "produce-second-package",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
				permittedGithubContext: [],
				selectedVersions: [
					{
						body: "Checkout remains in Cantiara.",
						kind: "Work",
						recordId: work.id,
						title: renamed.work.title,
						versionId: String(renamed.work.revision),
					},
					{
						body: "Capture now allows wallets.",
						kind: "Decision",
						recordId: "decision-capture",
						title: "Capture stays on Work",
						versionId: "decision-v2",
					},
				],
				workId: work.id,
			},
		});
		expect(produced.status).toBe("committed");
		if (produced.status !== "committed") {
			return;
		}
		expect(produced.handoff.id).toBe(started.handoff.id);
		expect(produced.handoff.purpose).toBe("Code checkout.");
		expect(produced.handoff.goingPackage.markdown).toContain(
			"Checkout after send"
		);
		expect(produced.handoff.goingPackage.markdown).toContain(
			"Capture now allows wallets."
		);
		expect(produced.handoff.goingPackage.markdown).not.toBe(sentMarkdown);
		const versions = produced.handoff.goingPackageVersions;
		expect(versions.map((item) => item.version)).toEqual([1, 2]);
		expect(versions[0]?.markdown).toBe(sentMarkdown);
		expect(versions[0]?.markdown).not.toContain("Checkout after send");
		expect(versions[0]?.markdown).not.toContain("Capture now allows wallets.");
		expect(versions[1]?.markdown).toBe(produced.handoff.goingPackage.markdown);
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.goingPackageVersions[0]?.markdown).toBe(sentMarkdown);
	});

	it("records start and package export on Work change history with actor and time", async () => {
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
			idempotencyKey: "start-history",
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
		const produced = await produceGoingPackage(prisma, {
			actorId,
			idempotencyKey: "produce-history",
			origin: "human",
			payload: {
				handoffId: started.handoff.id,
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
		expect(produced.status).toBe("committed");
		const history = await listHandoffHistoryForWork(prisma, work.id);
		expect(history.map((item) => item.kind)).toEqual([
			"started",
			"package-exported",
			"package-exported",
		]);
		expect(history[0]).toMatchObject({
			actorId,
			actorType: "User",
			handoffId: started.handoff.id,
			kind: "started",
			workId: work.id,
		});
		expect(history[1]).toMatchObject({
			actorId,
			actorType: "User",
			handoffId: started.handoff.id,
			kind: "package-exported",
			packageVersion: 1,
			workId: work.id,
		});
		expect(history[2]).toMatchObject({
			packageVersion: 2,
		});
		for (const entry of history) {
			expect(entry.occurredAt).toMatch(ISO_TIME_PATTERN);
			expect(entry.copy.startHandoff).toBe("Start Handoff");
			expect(entry.copy.goingPackage).toBe("Going package");
		}
		expect(await prisma.auditEvent.count()).toBe(0);
		expect(await listWorkLifecycleHistory(prisma, work.id)).toEqual([]);
		expect(Object.keys(appRouter.externalHandoffs).sort()).toEqual([
			"history",
			"list",
			"produceGoingPackage",
			"start",
		]);
	});
});
