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

import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { listHandoffsForWork, startHandoff } from "./external-handoffs";
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
		expect(EXTERNAL_HANDOFFS_COPY).toEqual({
			constraints: "Constraints",
			executor: "Executor",
			expectedOutput: "Expected output",
			externalExecutionHandoff: "External Execution Handoff",
			github: "GitHub",
			open: "Open",
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
		const listed = await listHandoffsForWork(prisma, work.id);
		expect(listed.map((item) => item.id)).toEqual([started.handoff.id]);
		expect(JSON.stringify(started.handoff)).not.toMatch(FORBIDDEN_PRODUCT);
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
		expect(markdown).toContain("Package stays dated.");
		expect(markdown).toContain("underprotection/cantiara#160");
		expect(markdown).not.toContain("Unselected Wallet");
		expect(markdown).not.toContain("sk-live-handoff-secret");
		expect(markdown).not.toContain("founder-only-note");
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
});
