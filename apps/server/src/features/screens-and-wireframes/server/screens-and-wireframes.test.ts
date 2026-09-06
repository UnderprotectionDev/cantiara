/**
 * Screens and Wireframes seam — Project-scoped Screen master
 * with title-only create. Wireframe is a versioned surface on
 * the Screen, not a second master or archive/trash life.
 * docs/specs/48-screens-and-wireframes/spec.md and GitHub #349 / #350.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Tasarım bağlamı: Screen life).
 */

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	createDocument,
	updateDocument,
} from "../../documents/server/documents";
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
	applyLinkedBlockChange,
	archiveScreen,
	createLinkedBlock,
	createScreen,
	detachLinkedBlock,
	getExactWireframeVersion,
	getScreen,
	listScreens,
	permanentlyDeleteScreen,
	previewLinkedBlockChange,
	restoreScreen,
	saveExactWireframeVersion,
	trashScreen,
	unarchiveScreen,
} from "./screens-and-wireframes";
import {
	EMPTY_WIREFRAME_DOCUMENT,
	SCREEN_EVENT_KIND,
	SCREEN_KIND,
	SCREEN_LIFE,
	SCREENS_COPY,
} from "./screens-and-wireframes-model";
import {
	drawingStroke,
	hitTestWireframe,
	parseWireframeDocument,
	snapWireframePoint,
	WIREFRAME_ANIMATION_KIND,
	WIREFRAME_BROKEN_LIVE_TEXT,
	WIREFRAME_CANVAS_TYPEFACE,
	WIREFRAME_DURATION,
	WIREFRAME_SEMANTIC_KIND,
} from "./wireframe-document";

const DATABASE_URL = localTestDatabaseUrl();

const USER_FLOW_EDITOR =
	/User Flow editor|Add node|flow canvas|Moodboard frame/i;
const WIREFRAME_MASTER = /createWireframe|archiveWireframe|wireframeId/;
const SHANTELL_SANS = /Shantell Sans/;
const FORBIDDEN_ENGINE_IMPORT =
	/from ["']@excalidraw|from ["']tldraw|from ["']@tiptap|from ["']prosemirror/;
const KONVA_STAGE = {
	attrs: { width: 800 },
	children: [],
	className: "Stage",
};

/**
 * bun --hot can serve a Prisma client generated before Screen.
 * Writes must still persist through table SQL — gating getPrismaClient
 * on Screen made every RPC ask to restart the API (CANT-4DB9B62F).
 */
function withoutScreenDelegates(prisma: PrismaClient): PrismaClient {
	const hide = (target: object): PrismaClient =>
		new Proxy(target, {
			get(object, prop, receiver) {
				if (
					prop === "screen" ||
					prop === "screenEvent" ||
					prop === "wireframeVersion" ||
					prop === "wireframeLinkedBlock"
				) {
					return;
				}
				const value = Reflect.get(object, prop, receiver) as unknown;
				if (prop === "$transaction" && typeof value === "function") {
					return (fn: (tx: object) => unknown, options?: unknown) =>
						(
							value as (
								callback: (tx: object) => unknown,
								opts?: unknown
							) => unknown
						).call(object, (tx: object) => fn(hide(tx)), options);
				}
				if (typeof value === "function") {
					return value.bind(object);
				}
				return value;
			},
		}) as PrismaClient;
	return hide(prisma);
}

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
	if (typeof prisma.wireframeLinkedBlock?.deleteMany === "function") {
		await prisma.wireframeLinkedBlock.deleteMany();
	} else {
		await prisma.$executeRaw`DELETE FROM "wireframe_linked_block"`;
	}
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

	it("creates a Screen when bun --hot still lacks the Screen delegate", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const stale = withoutScreenDelegates(prisma);
		const created = await createScreen(stale, {
			actorId,
			idempotencyKey: "create-stale-checkout",
			origin: "human",
			payload: {
				projectId,
				title: "Checkout",
			},
		});
		expect(created).toMatchObject({ status: "committed" });
		if (created.status !== "committed") {
			throw new Error("expected SQL Screen create");
		}
		expect(created.screen.title).toBe("Checkout");
		const listed = await listScreens(stale, { projectId });
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(created.screen.id);
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
		expect(created.screen.history[0]?.kind).toBe(SCREEN_EVENT_KIND.create);
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

	it("round-trips a semantic WireframeDocument and refuses Konva, Tiptap, and keyframe models", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const screen = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-checkout-wire",
			projectId,
			title: "Checkout",
		});
		const document = {
			animations: [
				{
					duration: WIREFRAME_DURATION.short,
					id: "anim-1",
					kind: WIREFRAME_ANIMATION_KIND.showHide,
					nodeId: "pay",
				},
			],
			canvasTypeface: WIREFRAME_CANVAS_TYPEFACE,
			nodes: [
				{
					geometry: { height: 40, width: 120, x: 16, y: 16 },
					id: "pay",
					kind: WIREFRAME_SEMANTIC_KIND.button,
					label: "Pay",
					seed: 7,
				},
			],
			schema: "WireframeDocument" as const,
			schemaVersion: 1 as const,
		};
		const saved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: screen.revision,
			idempotencyKey: "semantic-v1",
			origin: "human",
			payload: { document, screenId: screen.id },
		});
		expect(saved.status).toBe("committed");
		const loaded = await getExactWireframeVersion(prisma, {
			screenId: screen.id,
			versionNumber: 1,
		});
		expect(loaded?.document).toMatchObject(document);
		expect(loaded?.document.canvasTypeface).toBe("Shantell Sans");
		expect(loaded?.document.nodes[0]?.kind).toBe("Button");
		expect(loaded?.document.nodes[0]).not.toHaveProperty("roughPath");
		expect(
			parseWireframeDocument({
				attrs: { width: 800 },
				children: [],
				className: "Stage",
			})
		).toEqual({ reason: "konva-json-not-durable", status: "rejected" });
		expect(parseWireframeDocument({ content: [], type: "doc" })).toEqual({
			reason: "forbidden-document-model",
			status: "rejected",
		});
		expect(
			parseWireframeDocument({
				elements: [],
				type: "excalidraw",
			})
		).toEqual({ reason: "forbidden-document-model", status: "rejected" });
		expect(
			parseWireframeDocument({
				schema: "tldraw",
				store: {},
			})
		).toEqual({ reason: "forbidden-document-model", status: "rejected" });
		expect(
			parseWireframeDocument({
				animations: [
					{
						duration: WIREFRAME_DURATION.short,
						easing: "cubic-bezier(0.4, 0, 0.2, 1)",
						id: "kf",
						kind: "keyframe",
					},
				],
				nodes: [],
				schema: "WireframeDocument",
				schemaVersion: 1,
			})
		).toEqual({ reason: "invalid-wireframe-document", status: "rejected" });
		expect(SCREENS_COPY.detachLink).toBe("Detach Link");
		expect(JSON.stringify(SCREENS_COPY)).not.toMatch(SHANTELL_SANS);
		const engineSource = await readFile(
			new URL("./wireframe-document.ts", import.meta.url),
			"utf8"
		);
		expect(engineSource).not.toMatch(FORBIDDEN_ENGINE_IMPORT);
	});

	it("hit-tests and snaps canonical geometry with a fixed seed, not a Rough.js stroke", () => {
		const geometry = { height: 40, width: 80, x: 10, y: 10 };
		const parsed = parseWireframeDocument({
			nodes: [
				{
					geometry,
					id: "a",
					kind: WIREFRAME_SEMANTIC_KIND.input,
					seed: 1,
				},
				{
					geometry: { height: 40, width: 80, x: 200, y: 10 },
					id: "b",
					kind: WIREFRAME_SEMANTIC_KIND.input,
					seed: 99_991,
				},
			],
			schema: "WireframeDocument",
			schemaVersion: 1,
		});
		if (parsed.status !== "ok") {
			throw new Error("expected document");
		}
		const [first, second] = parsed.document.nodes;
		if (!(first && second)) {
			throw new Error("expected nodes");
		}
		const inside = hitTestWireframe(parsed.document, { x: 20, y: 20 });
		expect(inside?.id).toBe("a");
		expect(hitTestWireframe(parsed.document, { x: 210, y: 20 })?.id).toBe("b");
		expect(drawingStroke(first).seed).toBe(1);
		expect(drawingStroke(first).source).toBe("canonical");
		expect(drawingStroke(first).geometry).toEqual(geometry);
		expect(drawingStroke(second).geometry).toEqual({
			height: 40,
			width: 80,
			x: 200,
			y: 10,
		});
		expect(snapWireframePoint(parsed.document, { x: 12, y: 11 })).toEqual({
			snapped: true,
			x: 10,
			y: 10,
		});
	});

	it("previews affected Screens before a linked-block change and Detach Link freezes an independent copy", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const other = await createProject(prisma, {
			actorId,
			idempotencyKey: "create-other",
			origin: "human",
			payload: { name: "Other", starterConfiguration: "Blank Project" },
			workspaceId: (
				await prisma.project.findUnique({ where: { id: projectId } })
			)?.workspaceId as string,
		});
		if (other.status !== "committed") {
			throw new Error("expected other project");
		}
		const checkout = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-checkout-linked",
			projectId,
			title: "Checkout",
		});
		const settings = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-settings-linked",
			projectId,
			title: "Settings",
		});
		const nav = await createLinkedBlock(prisma, {
			actorId,
			idempotencyKey: "nav-def",
			origin: "human",
			payload: {
				definition: {
					geometry: { height: 48, width: 320 },
					kind: WIREFRAME_SEMANTIC_KIND.navigation,
					label: "Header",
				},
				name: "Header",
				projectId,
			},
		});
		expect(nav.status).toBe("committed");
		if (nav.status !== "committed") {
			throw new Error("expected linked block");
		}
		const instance = {
			geometry: { height: 48, width: 320, x: 0, y: 0 },
			id: "nav-instance",
			kind: WIREFRAME_SEMANTIC_KIND.navigation,
			label: "Header",
			linkedBlockId: nav.linkedBlock.id,
			seed: 3,
		};
		const checkoutSaved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: checkout.revision,
			idempotencyKey: "checkout-nav",
			origin: "human",
			payload: {
				document: {
					nodes: [instance],
					schema: "WireframeDocument",
					schemaVersion: 1,
				},
				screenId: checkout.id,
			},
		});
		const settingsSaved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: settings.revision,
			idempotencyKey: "settings-nav",
			origin: "human",
			payload: {
				document: {
					nodes: [{ ...instance, id: "nav-settings" }],
					schema: "WireframeDocument",
					schemaVersion: 1,
				},
				screenId: settings.id,
			},
		});
		if (
			checkoutSaved.status !== "committed" ||
			settingsSaved.status !== "committed"
		) {
			throw new Error("expected versions");
		}
		const nextDefinition = {
			geometry: { height: 64, width: 320 },
			kind: WIREFRAME_SEMANTIC_KIND.navigation,
			label: "Header v2",
		};
		const preview = await previewLinkedBlockChange(prisma, {
			linkedBlockId: nav.linkedBlock.id,
			nextDefinition,
			projectId,
		});
		expect(preview.status).toBe("ok");
		if (preview.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(preview.affectedScreens.map((row) => row.title).sort()).toEqual([
			"Checkout",
			"Settings",
		]);
		const withoutPreview = await applyLinkedBlockChange(prisma, {
			actorId,
			idempotencyKey: "apply-nav",
			origin: "human",
			payload: {
				linkedBlockId: nav.linkedBlock.id,
				nextDefinition,
				projectId,
			},
		});
		expect(withoutPreview).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		const applied = await applyLinkedBlockChange(prisma, {
			actorId,
			idempotencyKey: "apply-nav-ok",
			origin: "human",
			payload: {
				linkedBlockId: nav.linkedBlock.id,
				nextDefinition,
				projectId,
			},
			previewAcknowledged: true,
			previewFingerprint: preview.previewFingerprint,
		});
		expect(applied.status).toBe("committed");
		const live = await getExactWireframeVersion(prisma, {
			overlayCurrent: true,
			screenId: checkout.id,
			versionNumber: 1,
		});
		expect(live?.document.nodes[0]?.label).toBe("Header");
		expect(live?.presentedNodes[0]?.label).toBe("Header v2");
		const detached = await detachLinkedBlock(prisma, {
			actorId,
			baseRevision: checkoutSaved.screen.revision,
			idempotencyKey: "detach-checkout",
			origin: "human",
			payload: { nodeId: "nav-instance", screenId: checkout.id },
		});
		expect(detached.status).toBe("committed");
		const checkoutV2 = await getExactWireframeVersion(prisma, {
			overlayCurrent: true,
			screenId: checkout.id,
			versionNumber: 2,
		});
		expect(checkoutV2?.document.nodes[0]?.linkedBlockId).toBeUndefined();
		expect(checkoutV2?.presentedNodes[0]?.label).toBe("Header v2");
		const settingsLive = await getExactWireframeVersion(prisma, {
			overlayCurrent: true,
			screenId: settings.id,
			versionNumber: 1,
		});
		expect(settingsLive?.document.nodes[0]?.linkedBlockId).toBe(
			nav.linkedBlock.id
		);
		const foreign = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "foreign-screen",
			projectId: other.project.id,
			title: "Foreign",
		});
		const cross = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: foreign.revision,
			idempotencyKey: "cross-nav",
			origin: "human",
			payload: {
				document: {
					nodes: [{ ...instance, id: "foreign-nav" }],
					schema: "WireframeDocument",
					schemaVersion: 1,
				},
				screenId: foreign.id,
			},
		});
		expect(cross).toEqual({
			reason: "cross-project-live-library",
			status: "rejected",
		});
	});

	it("keeps then-visible live Markdown text on a saved version and shows Broken instead of empty", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const createdDoc = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "# Checkout copy {#pay-cta}\n\nPay now.\n",
				scope: { kind: "project", projectId },
				title: "Copy",
				type: "Spec",
			},
			workspaceId,
		});
		if (createdDoc.status !== "committed") {
			throw new Error("expected document");
		}
		const screen = await committedScreen(prisma, {
			actorId,
			idempotencyKey: "create-copy-screen",
			projectId,
			title: "Checkout",
		});
		const saved = await saveExactWireframeVersion(prisma, {
			actorId,
			baseRevision: screen.revision,
			idempotencyKey: "copy-v1",
			origin: "human",
			payload: {
				document: {
					nodes: [
						{
							geometry: { height: 24, width: 200, x: 8, y: 8 },
							id: "cta",
							kind: WIREFRAME_SEMANTIC_KIND.text,
							seed: 2,
							text: {
								documentId: createdDoc.document.id,
								mode: "liveMarkdownSection",
								sectionId: "pay-cta",
							},
						},
					],
					schema: "WireframeDocument",
					schemaVersion: 1,
				},
				screenId: screen.id,
			},
		});
		expect(saved.status).toBe("committed");
		const version = await getExactWireframeVersion(prisma, {
			screenId: screen.id,
			versionNumber: 1,
		});
		expect(version?.presentedNodes[0]?.text).toMatchObject({
			status: "ok",
			value: "# Checkout copy {#pay-cta}\n\nPay now.",
		});
		expect(version?.presentedNodes[0]?.text?.liveSourcePath).toEqual({
			documentId: createdDoc.document.id,
			sectionId: "pay-cta",
		});
		const updated = await updateDocument(prisma, {
			actorId,
			baseRevision: createdDoc.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "# Later {#later}\n\nGone.\n",
				documentId: createdDoc.document.id,
			},
			workspaceId,
		});
		expect(updated.status).toBe("committed");
		const historical = await getExactWireframeVersion(prisma, {
			screenId: screen.id,
			versionNumber: 1,
		});
		expect(historical?.presentedNodes[0]?.text?.value).toBe(
			"# Checkout copy {#pay-cta}\n\nPay now."
		);
		expect(historical?.presentedNodes[0]?.text?.value).not.toBe("");
		const live = await getExactWireframeVersion(prisma, {
			overlayCurrent: true,
			screenId: screen.id,
			versionNumber: 1,
		});
		expect(live?.presentedNodes[0]?.text).toMatchObject({
			status: "broken",
			value: WIREFRAME_BROKEN_LIVE_TEXT,
		});
		expect(live?.presentedNodes[0]?.text?.value).not.toBe("");
		expect(SCREENS_COPY.broken).toBe("Broken");
	});
});
