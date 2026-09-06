/**
 * Screens and Wireframes seam — Project-scoped Screen master
 * with title-only create. Wireframe is a versioned surface on
 * the Screen, not a second master or archive/trash life.
 * docs/specs/48-screens-and-wireframes/spec.md and GitHub #349.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Tasarım bağlamı: Screen life).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	createUsageLink,
	inspectRelations,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { USAGE_KIND } from "../../relations/server/relations-model";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";

import {
	archiveScreen,
	createScreen,
	getScreen,
	listScreens,
	permanentlyDeleteScreen,
	restoreScreen,
	saveExactWireframeVersion,
	trashScreen,
	unarchiveScreen,
} from "./screens-and-wireframes";
import {
	EMPTY_WIREFRAME_DOCUMENT,
	SCREEN_KIND,
	SCREEN_LIFE,
	SCREENS_COPY,
} from "./screens-and-wireframes-model";

const DATABASE_URL = localTestDatabaseUrl();

const USER_FLOW_EDITOR =
	/User Flow editor|Add node|flow canvas|Moodboard frame/i;
const WIREFRAME_MASTER = /createWireframe|archiveWireframe|wireframeId/;
const KONVA_STAGE = {
	attrs: { width: 800 },
	children: [],
	className: "Stage",
};

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
	await prisma.typedRelation.deleteMany();
	await prisma.wireframeVersion.deleteMany();
	await prisma.screenEvent.deleteMany();
	await prisma.screen.deleteMany();
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
		idempotencyKey: `create-payments-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

async function committedScreen(
	prisma: PrismaClient,
	input: {
		actorId: string;
		idempotencyKey: string;
		projectId: string;
		title: string;
	}
) {
	const created = await createScreen(prisma, {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected create");
	}
	return created.screen;
}

describe("Screens and Wireframes", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("creates a Screen from a title with no visual design", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createScreen(prisma, {
			actorId,
			idempotencyKey: "create-checkout",
			origin: "human",
			payload: {
				projectId,
				title: "Checkout",
			},
		});
		expect(created).toMatchObject({ status: "committed" });
		if (created.status !== "committed") {
			throw new Error("expected committed Screen");
		}
		expect(created.screen).toMatchObject({
			life: SCREEN_LIFE.active,
			projectId,
			recordKind: SCREEN_KIND,
			title: "Checkout",
			versions: [],
		});
		expect(created.screen.recordKind).toBe("Screen");
		expect(created.screen.recordKind).not.toBe("Document");
		expect(created.screen.recordKind).not.toBe("Moodboard");
		expect(created.screen.recordKind).not.toBe("User Flow");
		expect(created.screen).not.toHaveProperty("wireframeId");
		expect(JSON.stringify(created.screen)).not.toMatch(USER_FLOW_EDITOR);
		expect(JSON.stringify(SCREENS_COPY)).not.toMatch(USER_FLOW_EDITOR);
		expect(SCREENS_COPY.screen).toBe("Screen");
		expect(SCREENS_COPY.createScreen).toBe("Create Screen");
		expect(SCREENS_COPY.titleRequired).toBe("Title is required.");
		const listed = await listScreens(prisma, { projectId });
		expect(listed).toHaveLength(1);
		expect(listed[0]?.title).toBe("Checkout");
		const empty = await createScreen(prisma, {
			actorId,
			idempotencyKey: "blank",
			origin: "human",
			payload: { projectId, title: "  " },
		});
		expect(empty).toEqual({
			reason: "title-required",
			status: "rejected",
		});
	});

	it("keeps Wireframe versions on the Screen and refuses a second master life", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const screen = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-pay",
			projectId,
			title: "Pay",
		});
		const saved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: screen.revision,
			idempotencyKey: "version-1",
			origin: "human",
			payload: {
				document: EMPTY_WIREFRAME_DOCUMENT,
				screenId: screen.id,
			},
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected version");
		}
		expect(saved.screen.versions).toHaveLength(1);
		expect(saved.screen.versions[0]).toMatchObject({
			schema: "WireframeDocument",
			screenId: screen.id,
			versionNumber: 1,
		});
		expect(saved.screen.versions[0]).not.toHaveProperty("archivedAt");
		expect(saved.screen.versions[0]).not.toHaveProperty("trashedAt");
		expect(saved.screen.versions[0]).not.toHaveProperty("projectId");
		expect(JSON.stringify(saved.screen)).not.toMatch(WIREFRAME_MASTER);
		const konva = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: saved.screen.revision,
			idempotencyKey: "konva",
			origin: "human",
			payload: {
				document: KONVA_STAGE,
				screenId: screen.id,
			},
		});
		expect(konva).toEqual({
			reason: "konva-json-not-durable",
			status: "rejected",
		});
		const archived = await archiveScreen(prisma, {
			actorId,
			baseRevision: saved.screen.revision,
			idempotencyKey: "archive-pay",
			origin: "human",
			payload: { screenId: screen.id },
		});
		expect(archived.status).toBe("committed");
		if (archived.status !== "committed") {
			throw new Error("expected archive");
		}
		expect(archived.screen.life).toBe(SCREEN_LIFE.archived);
		expect(archived.screen.versions).toHaveLength(1);
		expect(archived.screen.versions[0]?.screenId).toBe(screen.id);
		const active = await listScreens(prisma, { projectId });
		expect(active).toEqual([]);
		const withArchived = await listScreens(prisma, {
			includeArchived: true,
			projectId,
		});
		expect(withArchived).toHaveLength(1);
		expect(withArchived[0]?.id).toBe(screen.id);
		const restored = await unarchiveScreen(prisma, {
			actorId,
			baseRevision: archived.screen.revision,
			idempotencyKey: "unarchive-pay",
			origin: "human",
			payload: { screenId: screen.id },
		});
		expect(restored.status).toBe("committed");
		if (restored.status !== "committed") {
			throw new Error("expected unarchive");
		}
		expect(restored.screen.life).toBe(SCREEN_LIFE.active);
		expect(restored.screen.versions[0]?.versionNumber).toBe(1);
	});

	it("trashes and restores a Screen without a Wireframe trash life", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const screen = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-settings",
			projectId,
			title: "Settings",
		});
		const saved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: screen.revision,
			idempotencyKey: "settings-v1",
			origin: "human",
			payload: {
				document: EMPTY_WIREFRAME_DOCUMENT,
				screenId: screen.id,
			},
		});
		if (saved.status !== "committed") {
			throw new Error("expected version");
		}
		const trashed = await trashScreen(prisma, {
			actorId,
			baseRevision: saved.screen.revision,
			idempotencyKey: "trash-settings",
			origin: "human",
			payload: { screenId: screen.id },
		});
		expect(trashed.status).toBe("committed");
		if (trashed.status !== "committed") {
			throw new Error("expected trash");
		}
		expect(trashed.screen.life).toBe(SCREEN_LIFE.inTrash);
		expect(trashed.screen.versions).toHaveLength(1);
		expect(await listScreens(prisma, { projectId })).toEqual([]);
		const inTrash = await listScreens(prisma, { projectId, trash: true });
		expect(inTrash[0]?.id).toBe(screen.id);
		const restored = await restoreScreen(prisma, {
			actorId,
			baseRevision: trashed.screen.revision,
			idempotencyKey: "restore-settings",
			origin: "human",
			payload: { screenId: screen.id },
		});
		expect(restored.status).toBe("committed");
		if (restored.status !== "committed") {
			throw new Error("expected restore");
		}
		expect(restored.screen.life).toBe(SCREEN_LIFE.active);
		expect(restored.screen.versions[0]?.screenId).toBe(screen.id);
		const archived = await archiveScreen(prisma, {
			actorId,
			baseRevision: restored.screen.revision,
			idempotencyKey: "archive-settings",
			origin: "human",
			payload: { screenId: screen.id },
		});
		if (archived.status !== "committed") {
			throw new Error("expected archive");
		}
		const archivedTrash = await trashScreen(prisma, {
			actorId,
			baseRevision: archived.screen.revision,
			idempotencyKey: "trash-archived-settings",
			origin: "human",
			payload: { screenId: screen.id },
		});
		if (archivedTrash.status !== "committed") {
			throw new Error("expected trash of Archived Screen");
		}
		expect(archivedTrash.screen.life).toBe(SCREEN_LIFE.inTrash);
		const restoredArchive = await restoreScreen(prisma, {
			actorId,
			baseRevision: archivedTrash.screen.revision,
			idempotencyKey: "restore-archived-settings",
			origin: "human",
			payload: { screenId: screen.id },
		});
		if (restoredArchive.status !== "committed") {
			throw new Error("expected restore to Archived");
		}
		expect(restoredArchive.screen.life).toBe(SCREEN_LIFE.archived);
		expect(restoredArchive.screen.versions[0]?.screenId).toBe(screen.id);
	});

	it("leaves a deleted Screen as a broken target without silent retarget", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const pay = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-pay-screen",
			projectId,
			title: "Pay",
		});
		const refund = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-refund-screen",
			projectId,
			title: "Refund",
		});
		const host = await createWork(prisma, {
			actorId,
			idempotencyKey: "create-flow-host",
			origin: "human",
			payload: {
				projectId,
				title: "Checkout flow",
			},
		});
		if (host.status !== "committed") {
			throw new Error("expected host Work");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: host.work.id, kind: "Work" },
			idempotencyKey: "relate-screen",
			origin: "human",
			previewAcknowledged: true,
			to: { id: pay.id, kind: "Screen" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const linked = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.work.id,
			idempotencyKey: "flow-ref",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: pay.id,
			workspaceId,
		});
		expect(linked.status).toBe("committed");
		const before = await listRelations(prisma, {
			record: { id: pay.id, kind: "Screen" },
			viewerWorkspaceId: workspaceId,
		});
		expect(before[0]?.to.id).toBe(pay.id);
		expect(before[0]?.to.status).toBe("resolved");
		const trashed = await trashScreen(prisma, {
			actorId,
			baseRevision: pay.revision,
			idempotencyKey: "trash-pay",
			origin: "human",
			payload: { screenId: pay.id },
		});
		if (trashed.status !== "committed") {
			throw new Error("expected trash");
		}
		const deleted = await permanentlyDeleteScreen(prisma, {
			actorId,
			baseRevision: trashed.screen.revision,
			idempotencyKey: "delete-pay",
			origin: "human",
			payload: { screenId: pay.id },
		});
		expect(deleted).toEqual({
			screenId: pay.id,
			status: "committed",
		});
		expect(await getScreen(prisma, pay.id)).toBeNull();
		expect(await getScreen(prisma, refund.id)).not.toBeNull();
		const graph = await inspectRelations(prisma, host.work.id, workspaceId);
		expect(graph.usageLinks[0]?.sourceRecordId).toBe(pay.id);
		expect(graph.usageLinks[0]?.sourceRecordId).not.toBe(refund.id);
		const after = await listRelations(prisma, {
			record: { id: host.work.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const screenEnd = after.find((row) => row.to.id === pay.id)?.to;
		expect(screenEnd).toMatchObject({
			id: pay.id,
			kind: "Screen",
			openSourceRecord: false,
			reason: RELATIONS_COPY.permanentlyDeleted,
			status: "broken",
		});
		expect(screenEnd?.id).not.toBe(refund.id);
	});
});
