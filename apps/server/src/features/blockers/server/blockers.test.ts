/**
 * Work Blockers seam — Active Engeller/Engellenir on
 * Work←Work, Decision→Work, or Open Question→Work; readable
 * blocker fact without writing Work status Blocked; pair
 * submit is idempotent; Remove relation deletes a mistaken
 * link without resolution history; Mark blocker resolved
 * records date and optional note; reactivate is the same
 * relation; source close is not a write; work-blocked emits
 * only on new Active and Resolved to Active; Dependencies is a
 * read-only projection. Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Blokaj: relation life, source close does not auto-resolve).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	closeWork,
	createWork,
	getWork,
	includeWork,
	listWorkLifecycleHistory,
} from "../../work-lifecycle/server/work-lifecycle";
import { ACTION_REQUIRED_SIGNAL_IDS } from "../../workspace-overview/server/workspace-overview";
import {
	addActiveBlockingRelation,
	listWorkBlockers,
	markBlockerResolved,
	projectDependencies,
	reactivateBlockingRelation,
	removeBlockingRelation,
} from "./blockers";
import {
	BLOCKERS_COPY,
	WORK_BLOCKED_SIGNAL_ID,
	WORK_BLOCKED_SIGNAL_SECTION,
} from "./blockers-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FREE_TYPE_PATTERN = /related-pile|freeRelationType|customRelationType/i;
const KANBAN_TAG_PRIORITY_PATTERN =
	/kanbanColumn|columnColor|priorityScore|tagAsBlocker/i;
const BLOCKED_STATUS_WRITE = /"status":"Blocked"/;
const CYCLE_SIGNAL_PATTERN = /cycle-detected/;
const MERMAID_PATTERN = /mermaid/i;
const GRAPH_LAYOUT_PATTERN = /criticalPath|nodePosition|layoutX|layoutY/;

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
	idempotencyKey: string,
	type?: "Feature" | "Task"
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey,
		origin: "human",
		payload: { projectId, title, ...(type ? { type } : {}) },
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

	it("uses English Active, Resolved, Mark blocker resolved, Remove relation, and Dependencies without a free relation type", () => {
		expect(BLOCKERS_COPY).toEqual({
			active: "Active",
			blockedBy: "Blocked by",
			blocks: "Blocks",
			cycle: "These records wait on each other.",
			dependencies: "Dependencies",
			markBlockerResolved: "Mark blocker resolved",
			note: "Note",
			removeRelation: "Remove relation",
			resolved: "Resolved",
			sourceClosedSuggestion:
				"Source is closed. Mark blocker resolved is a separate act.",
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
			relation: {
				id: added.relation.id,
				resolutionNote: null,
				resolvedAt: null,
				state: "Active",
			},
			status: "committed",
		});
		if (removed.status !== "committed") {
			throw new Error("expected committed remove");
		}
		expect(removed.relation.copy.removeRelation).toBe("Remove relation");
		expect(await listWorkBlockers(prisma, blocked.id)).toMatchObject({
			hasActiveBlocker: false,
			relations: [],
		});
		expect(await prisma.typedRelation.count()).toBe(0);
	});

	it("records Mark blocker resolved with date and optional note and leaves history off the Active signal", async () => {
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
		const before = Date.now();
		const resolved = await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-auth",
			origin: "human",
			relationId: added.relation.id,
			resolutionNote: "Auth shipped",
			viewerWorkspaceId: workspaceId,
		});
		expect(resolved).toMatchObject({
			relation: {
				copy: {
					active: "Active",
					markBlockerResolved: "Mark blocker resolved",
					removeRelation: "Remove relation",
					resolved: "Resolved",
				},
				id: added.relation.id,
				resolutionNote: "Auth shipped",
				source: { id: source.id, kind: "Work" },
				state: "Resolved",
			},
			status: "committed",
		});
		if (resolved.status !== "committed") {
			throw new Error("expected committed resolve");
		}
		const resolvedAt = Date.parse(resolved.relation.resolvedAt ?? "");
		expect(resolvedAt).toBeGreaterThanOrEqual(before);
		expect(resolvedAt).toBeLessThanOrEqual(Date.now());
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.hasActiveBlocker).toBe(false);
		expect(listed.relations).toEqual([resolved.relation]);
		expect(listed.relations[0]?.state).toBe("Resolved");
		expect(await prisma.typedRelation.count()).toBe(1);
	});

	it("reactivates the same Resolved relation as Active rather than minting a new wait", async () => {
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
		const resolved = await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-auth",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		if (resolved.status !== "committed") {
			throw new Error("expected committed resolve");
		}
		const reactivated = await reactivateBlockingRelation(prisma, {
			actorId,
			idempotencyKey: "reactivate-auth",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(reactivated).toMatchObject({
			relation: {
				id: added.relation.id,
				resolutionNote: resolved.relation.resolutionNote,
				resolvedAt: resolved.relation.resolvedAt,
				source: { id: source.id, kind: "Work" },
				state: "Active",
			},
			status: "committed",
		});
		if (reactivated.status !== "committed") {
			throw new Error("expected committed reactivate");
		}
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.hasActiveBlocker).toBe(true);
		expect(listed.relations).toHaveLength(1);
		expect(listed.relations[0]?.id).toBe(added.relation.id);
		expect(listed.relations[0]?.state).toBe("Active");
		expect(await prisma.typedRelation.count()).toBe(1);
	});

	it("keeps the relation Active when the source Work closes and only offers a visible resolve suggestion", async () => {
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
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: source.revision,
			idempotencyKey: "close-auth",
			origin: "human",
			result: "Completed",
			workId: source.id,
		});
		expect(closed).toMatchObject({
			status: "committed",
			work: { id: source.id, status: "Closed" },
		});
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.hasActiveBlocker).toBe(true);
		expect(listed.relations).toMatchObject([
			{
				id: added.relation.id,
				sourceCloseSuggestion: {
					copy: { markBlockerResolved: "Mark blocker resolved" },
					reason: BLOCKERS_COPY.sourceClosedSuggestion,
				},
				state: "Active",
			},
		]);
		expect(
			await prisma.typedRelation.findUnique({
				where: { id: added.relation.id },
			})
		).toMatchObject({
			blockerState: "Active",
			resolvedAt: null,
		});
	});

	it("does not silently resolve on GitHub origin, automation, or parent Feature close", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const feature = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout feature",
			"create-feature",
			"Feature"
		);
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
		expect(
			await markBlockerResolved(prisma, {
				actorId,
				idempotencyKey: "github-merge",
				origin: "github",
				relationId: added.relation.id,
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
		expect(
			await markBlockerResolved(prisma, {
				actorId,
				idempotencyKey: "automation-resolve",
				origin: "system-automation",
				relationId: added.relation.id,
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: source.revision,
			featureId: feature.id,
			idempotencyKey: "include-auth",
			origin: "human",
			workId: source.id,
		});
		if (included.status !== "committed") {
			throw new Error("expected included source");
		}
		const includedBlocked = await includeWork(prisma, {
			actorId,
			baseRevision: blocked.revision,
			featureId: feature.id,
			idempotencyKey: "include-checkout",
			origin: "human",
			workId: blocked.id,
		});
		if (includedBlocked.status !== "committed") {
			throw new Error("expected included blocked Work");
		}
		const closedParent = await closeWork(prisma, {
			actorId,
			baseRevision: feature.revision,
			idempotencyKey: "close-feature",
			origin: "human",
			result: "Completed",
			workId: feature.id,
		});
		expect(closedParent).toMatchObject({ status: "committed" });
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.hasActiveBlocker).toBe(true);
		expect(listed.relations[0]?.state).toBe("Active");
		expect(listed.relations[0]?.resolvedAt).toBeNull();
	});

	it("emits registered work-blocked on new Active and not again on a later read", async () => {
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
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		expect(added.emissions).toEqual([
			{
				blockedWorkId: blocked.id,
				relationId: added.relation.id,
				relationTime: added.relation.establishedAt,
				section: WORK_BLOCKED_SIGNAL_SECTION,
				signalId: WORK_BLOCKED_SIGNAL_ID,
				source: { id: source.id, kind: "Work" },
			},
		]);
		expect(ACTION_REQUIRED_SIGNAL_IDS).toContain(WORK_BLOCKED_SIGNAL_ID);
		expect(WORK_BLOCKED_SIGNAL_SECTION).toBe("Action Required");
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.signals).toEqual(added.emissions);
		const listedAgain = await listWorkBlockers(prisma, blocked.id);
		expect(listedAgain.signals).toEqual(listed.signals);
		expect(listedAgain.signals).toHaveLength(1);
	});

	it("emits work-blocked for a Decision source onto Work", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
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
			idempotencyKey: "block-from-decision",
			origin: "human",
			source: { id: "decision-auth", kind: "Decision" },
			viewerWorkspaceId: workspaceId,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		expect(added.emissions).toEqual([
			{
				blockedWorkId: blocked.id,
				relationId: added.relation.id,
				relationTime: added.relation.establishedAt,
				section: WORK_BLOCKED_SIGNAL_SECTION,
				signalId: WORK_BLOCKED_SIGNAL_ID,
				source: { id: "decision-auth", kind: "Decision" },
			},
		]);
	});

	it("does not emit on resolve, source close, or a detected cycle", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const auth = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-auth"
		);
		const checkout = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const first = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: checkout.id,
			idempotencyKey: "auth-blocks-checkout",
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (first.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		const reverse = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: auth.id,
			idempotencyKey: "checkout-blocks-auth",
			origin: "human",
			source: { id: checkout.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (reverse.status !== "committed") {
			throw new Error("expected reverse Active relation");
		}
		expect(reverse.emissions).toHaveLength(1);
		expect(reverse.emissions[0]?.signalId).toBe(WORK_BLOCKED_SIGNAL_ID);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: auth.revision,
			idempotencyKey: "close-auth",
			origin: "human",
			result: "Completed",
			workId: auth.id,
		});
		expect(closed.status).toBe("committed");
		const afterClose = await listWorkBlockers(prisma, checkout.id);
		expect(afterClose.signals).toHaveLength(1);
		expect(afterClose.signals[0]?.signalId).toBe(WORK_BLOCKED_SIGNAL_ID);
		const afterCycleOnAuth = await listWorkBlockers(prisma, auth.id);
		expect(afterCycleOnAuth.signals).toHaveLength(1);
		const looping = await projectDependencies(prisma, [auth.id, checkout.id]);
		expect(looping.cycles).toHaveLength(1);
		expect(looping.cycles[0]?.explanation).toBe(BLOCKERS_COPY.cycle);
		expect(JSON.stringify(looping)).not.toMatch(CYCLE_SIGNAL_PATTERN);
		const resolved = await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-auth",
			origin: "human",
			relationId: first.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(resolved).toMatchObject({
			emissions: [],
			status: "committed",
		});
		if (resolved.status !== "committed") {
			throw new Error("expected committed resolve");
		}
		expect((await listWorkBlockers(prisma, checkout.id)).signals).toEqual([]);
		const afterResolve = await projectDependencies(prisma, [
			auth.id,
			checkout.id,
		]);
		expect(afterResolve.cycles).toEqual([]);
		expect(JSON.stringify(afterResolve)).not.toMatch(CYCLE_SIGNAL_PATTERN);
	});

	it("re-emits work-blocked when a Resolved relation is made Active again", async () => {
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
		const resolved = await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-auth",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		if (resolved.status !== "committed") {
			throw new Error("expected committed resolve");
		}
		const reactivated = await reactivateBlockingRelation(prisma, {
			actorId,
			idempotencyKey: "reactivate-auth",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(reactivated.status).toBe("committed");
		if (reactivated.status !== "committed") {
			throw new Error("expected committed reactivate");
		}
		expect(reactivated.emissions).toMatchObject([
			{
				blockedWorkId: blocked.id,
				relationId: added.relation.id,
				section: WORK_BLOCKED_SIGNAL_SECTION,
				signalId: WORK_BLOCKED_SIGNAL_ID,
				source: { id: source.id, kind: "Work" },
			},
		]);
		expect(reactivated.emissions[0]?.relationTime).not.toBe(
			reactivated.relation.establishedAt
		);
		const listed = await listWorkBlockers(prisma, blocked.id);
		expect(listed.signals).toHaveLength(1);
		expect(listed.signals[0]?.relationId).toBe(added.relation.id);
		expect(listed.signals[0]?.signalId).toBe(WORK_BLOCKED_SIGNAL_ID);
	});

	it("projects a read-only Dependencies graph from existing relations without writing a layout", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const feature = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout feature",
			"create-feature",
			"Feature"
		);
		const auth = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Auth API",
			"create-auth"
		);
		const checkout = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const outsider = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Unrelated",
			"create-outsider"
		);
		const includedAuth = await includeWork(prisma, {
			actorId,
			baseRevision: auth.revision,
			featureId: feature.id,
			idempotencyKey: "include-auth",
			origin: "human",
			workId: auth.id,
		});
		if (includedAuth.status !== "committed") {
			throw new Error("expected included auth");
		}
		const includedCheckout = await includeWork(prisma, {
			actorId,
			baseRevision: checkout.revision,
			featureId: feature.id,
			idempotencyKey: "include-checkout",
			origin: "human",
			workId: checkout.id,
		});
		if (includedCheckout.status !== "committed") {
			throw new Error("expected included checkout");
		}
		const added = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: checkout.id,
			idempotencyKey: "auth-blocks-checkout",
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: "resolve-auth",
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: outsider.id,
			idempotencyKey: "auth-blocks-outsider",
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const graph = await projectDependencies(prisma, [
			feature.id,
			auth.id,
			checkout.id,
		]);
		expect(graph.copy.dependencies).toBe("Dependencies");
		expect(graph.edges).toEqual([
			{
				direction: "Blocks",
				from: { id: auth.id, kind: "Work" },
				id: added.relation.id,
				state: "Resolved",
				to: { id: checkout.id, kind: "Work" },
			},
		]);
		expect(graph.nodes.map((node) => node.id).sort()).toEqual(
			[auth.id, checkout.id].sort()
		);
		expect(graph.writable).toBe(false);
		const serialized = JSON.stringify(graph);
		expect(serialized).not.toMatch(MERMAID_PATTERN);
		expect(serialized).not.toMatch(GRAPH_LAYOUT_PATTERN);
		expect(serialized).not.toMatch(KANBAN_TAG_PRIORITY_PATTERN);
		expect(await prisma.typedRelation.count()).toBe(2);
	});
});
