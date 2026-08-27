/**
 * Relations seam — usage link is not a typed relation, unlink
 * removes the embed, source status and record stay. Synthetic
 * fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki usage package).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	createUsageLink,
	inspectRelations,
	unlinkUsageLink,
} from "./relations";
import { RELATIONS_COPY, USAGE_KIND } from "./relations-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const USAGE_METADATA = /evidenceRole|copiedBody|Related/;

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
	await prisma.usageLink.deleteMany();
	await prisma.usageHostEmbed.deleteMany();
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
	const outcome = await createWork(prisma, {
		actorId,
		idempotencyKey,
		origin: "human",
		payload: { projectId, title },
	});
	if (outcome.status !== "committed") {
		throw new Error(`expected committed ${title}`);
	}
	return outcome.work;
}

describe("Relations usage links", () => {
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

	it("stores usage without entering Related or changing status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const host = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout spec",
			"create-host"
		);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Intake",
			"create-source"
		);
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-intake",
			kind: USAGE_KIND.inlineRecordReference,
			origin: "human",
			sourceRecordId: source.id,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed usage");
		}
		expect(created.usageLink.kindLabel).toBe("Inline reference");
		expect(created.usageLink.kindLabel).not.toBe(RELATIONS_COPY.related);
		expect(created.host.status).toBe("Not Started");
		expect(created.source.status).toBe("Not Started");
		expect(created.source.revision).toBe(source.revision);
		expect(created.embed.sourceRecordId).toBe(source.id);
		expect(JSON.stringify(created.usageLink)).not.toMatch(USAGE_METADATA);
		const graph = await inspectRelations(prisma, host.id);
		expect(graph.relationCount).toBe(0);
		expect(graph.typedRelations).toEqual([]);
		expect(graph.usageLinks).toEqual([created.usageLink]);
		const liveSource = await getWork(prisma, source.id);
		expect(liveSource?.title).toBe("Intake");
		expect(liveSource?.status).toBe("Not Started");
	});

	it("rejects unknown usage kinds and Evidence Role", async () => {
		const { actorId, project } = await openPayments(prisma);
		const host = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Host",
			"create-host"
		);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Source",
			"create-source"
		);
		const unknown = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "unknown-kind",
			kind: RELATIONS_COPY.related,
			origin: "human",
			sourceRecordId: source.id,
		});
		expect(unknown).toEqual({
			reason: "unknown-usage-kind",
			status: "rejected",
		});
		const withRole = await createUsageLink(prisma, {
			actorId,
			evidenceRole: "Supports",
			hostRecordId: host.id,
			idempotencyKey: "with-role",
			kind: USAGE_KIND.liveContentBlock,
			origin: "human",
			sourceRecordId: source.id,
		});
		expect(withRole).toEqual({
			reason: "evidence-role-not-allowed",
			status: "rejected",
		});
		const graph = await inspectRelations(prisma, host.id);
		expect(graph.usageLinks).toEqual([]);
		expect(graph.relationCount).toBe(0);
	});

	it("unlinks the embed and keeps the source record", async () => {
		const { actorId, project } = await openPayments(prisma);
		const host = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Flow",
			"create-host"
		);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Pay screen",
			"create-source"
		);
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-screen",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: source.id,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed usage");
		}
		const second = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-again",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: source.id,
		});
		expect(second.status).toBe("committed");
		const unlinked = await unlinkUsageLink(prisma, {
			actorId,
			idempotencyKey: "unlink-screen",
			origin: "human",
			usageLinkId: created.usageLink.id,
		});
		expect(unlinked.status).toBe("committed");
		if (unlinked.status !== "committed") {
			throw new Error("expected committed unlink");
		}
		expect(unlinked.source.id).toBe(source.id);
		expect(unlinked.source.status).toBe("Not Started");
		const graph = await inspectRelations(prisma, host.id);
		expect(graph.usageLinks).toHaveLength(1);
		expect(graph.usageLinks[0]?.id).toBe(
			second.status === "committed" ? second.usageLink.id : ""
		);
		const liveSource = await getWork(prisma, source.id);
		expect(liveSource).toMatchObject({
			id: source.id,
			status: "Not Started",
			title: "Pay screen",
		});
		const unlinkedAgain = await inspectRelations(prisma, source.id);
		expect(
			unlinkedAgain.usageLinks.some((link) => link.id === created.usageLink.id)
		).toBe(false);
	});

	it("keeps Related beside usage without mixing counts", async () => {
		const { actorId, project } = await openPayments(prisma);
		const host = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Feature host",
			"create-host"
		);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Related work",
			"create-source"
		);
		const related = await relateWork(prisma, {
			actorId,
			baseRevision: host.revision,
			fromWorkId: host.id,
			idempotencyKey: "relate",
			origin: "human",
			toWorkId: source.id,
		});
		expect(related.status).toBe("committed");
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "usage",
			kind: USAGE_KIND.pinnedFileOrWireframeBind,
			origin: "human",
			sourceRecordId: source.id,
		});
		expect(created.status).toBe("committed");
		const graph = await inspectRelations(prisma, host.id);
		expect(graph.relationCount).toBe(1);
		expect(graph.typedRelations[0]?.type).toBe("Related");
		expect(graph.usageLinks).toHaveLength(1);
		expect(graph.usageLinks[0]?.kindLabel).toBe("Pinned bind");
	});
});
