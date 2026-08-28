/**
 * Work Blockers seam — Active Engeller/Engellenir on
 * Work←Work, Decision→Work, or Open Question→Work; readable
 * blocker fact without writing Work status Blocked; pair
 * submit is idempotent; Remove relation deletes a mistaken
 * link without resolution history. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Blokaj: Active relation life, status independence).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
	listWorkLifecycleHistory,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	addActiveBlockingRelation,
	listWorkBlockers,
	removeBlockingRelation,
} from "./blockers";
import { BLOCKERS_COPY } from "./blockers-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FREE_TYPE_PATTERN = /related-pile|freeRelationType|customRelationType/i;
const KANBAN_TAG_PRIORITY_PATTERN =
	/kanbanColumn|columnColor|priorityScore|tagAsBlocker/i;
const RESOLUTION_HISTORY_PATTERN =
	/resolvedAt|resolutionNote|resolutionDate|"Resolved"/;
const BLOCKED_STATUS_WRITE = /"status":"Blocked"/;

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

describe("Work Blockers", () => {
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

	it("uses English Active and Remove relation without a free relation type", () => {
		expect(BLOCKERS_COPY).toEqual({
			active: "Active",
			blockedBy: "Blocked by",
			blocks: "Blocks",
			removeRelation: "Remove relation",
		});
		expect(JSON.stringify(BLOCKERS_COPY)).not.toMatch(FREE_TYPE_PATTERN);
		expect(JSON.stringify(BLOCKERS_COPY)).not.toMatch(
			KANBAN_TAG_PRIORITY_PATTERN
		);
	});

	it("establishes an Active Work-to-Work Engeller relation as a readable blocker fact", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-source"
		);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		const added = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(added).toMatchObject({
			relation: {
				blockedWorkId: blocked.id,
				copy: {
					active: "Active",
					removeRelation: "Remove relation",
				},
				source: { id: source.id, kind: "Work" },
				state: "Active",
				type: "Blocks",
				typeLabelFrom: "Blocks",
				typeLabelTo: "Blocked by",
			},
			status: "committed",
		});
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed).toMatchObject({
			copy: {
				active: "Active",
				removeRelation: "Remove relation",
			},
			hasActiveBlocker: true,
			workId: blocked.id,
			workStatus: "Not Started",
		});
		expect(listed.relations).toEqual([added.relation]);
		expect(JSON.stringify(listed)).not.toMatch(KANBAN_TAG_PRIORITY_PATTERN);
		expect(JSON.stringify(listed)).not.toMatch(FREE_TYPE_PATTERN);
	});

	it("does not write Work workflow status Blocked when an Active relation is added", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-source"
		);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const work = await getWork(prisma, blocked.id);
		expect(work?.status).toBe("Not Started");
		expect(JSON.stringify(work)).not.toMatch(BLOCKED_STATUS_WRITE);
		expect(await listWorkLifecycleHistory(prisma, blocked.id)).toEqual([]);
		expect((await listWorkBlockers(prisma, blocked.id)).workStatus).toBe(
			"Not Started"
		);
	});

	it("does not mint a second Active relation for the same ends on resubmit", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-source"
		);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		const first = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (first.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		const second = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout-again",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(second.status === "committed" || second.status === "replayed").toBe(
			true
		);
		if (second.status !== "committed" && second.status !== "replayed") {
			throw new Error("expected existing Active relation");
		}
		expect(second.relation.id).toBe(first.relation.id);
		expect((await listWorkBlockers(prisma, blocked.id)).relations).toHaveLength(
			1
		);
	});

	it("establishes Active Decision and Open Question sources onto Work", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		const fromDecision = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-from-decision",
			origin: "human",
			source: { id: "decision-auth", kind: "Decision" },
			viewerWorkspaceId: workspaceId,
		});
		const fromQuestion = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-from-question",
			origin: "human",
			source: { id: "question-pci", kind: "Question" },
			viewerWorkspaceId: workspaceId,
		});
		expect(fromDecision).toMatchObject({
			relation: {
				source: { id: "decision-auth", kind: "Decision" },
				state: "Active",
				type: "Blocks",
			},
			status: "committed",
		});
		expect(fromQuestion).toMatchObject({
			relation: {
				source: { id: "question-pci", kind: "Question" },
				state: "Active",
				type: "Blocks",
			},
			status: "committed",
		});
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.hasActiveBlocker).toBe(true);
		expect(listed.relations.map((row) => row.source.kind).sort()).toEqual([
			"Decision",
			"Question",
		]);
	});

	it("rejects a source that is not Work, Decision, or Open Question", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		expect(
			await addActiveBlockingRelation(prisma, {
				actorId,
				blockedWorkId: blocked.id,
				idempotencyKey: "block-from-document",
				origin: "human",
				source: { id: "doc-1", kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
		expect(await listWorkBlockers(prisma, blocked.id)).toMatchObject({
			hasActiveBlocker: false,
			relations: [],
		});
	});

	it("removes a mistaken relation without writing resolution history", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const source = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-source"
		);
		const blocked = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-blocked"
		);
		const added = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: blocked.id,
			idempotencyKey: "block-checkout",
			origin: "human",
			source: { id: source.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		const removed = await removeBlockingRelation(prisma, {
			actorId,
			idempotencyKey: "remove-mistaken",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(removed).toMatchObject({
			relation: { id: added.relation.id, state: "Active" },
			status: "committed",
		});
		if (removed.status !== "committed") {
			throw new Error("expected committed remove");
		}
		expect(JSON.stringify(removed)).not.toMatch(RESOLUTION_HISTORY_PATTERN);
		expect(removed.relation.copy.removeRelation).toBe("Remove relation");
		expect(await listWorkBlockers(prisma, blocked.id)).toMatchObject({
			hasActiveBlocker: false,
			relations: [],
		});
		expect(await prisma.typedRelation.count()).toBe(0);
	});
});
