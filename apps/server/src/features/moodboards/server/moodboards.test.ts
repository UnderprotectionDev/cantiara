/**
 * Moodboards seam — Project Tasarım type Moodboard. Each visual keeps
 * File Attachment version or external-link origin plus optional Caption.
 * Caption is not a thread, reaction, task, mention, or second file
 * description. A reference is not a Screen, production asset, User Flow,
 * or Wireframe. Placing a visual does not auto-create a Project Wall card.
 * docs/specs/50-moodboards/spec.md and GitHub #358.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Tasarım bağlamı Moodboard half).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";

import {
	addMoodboardVisual,
	createMoodboard,
	getMoodboard,
	getPersonalViewport,
	groupOutline,
	listMoodboards,
	listProjectWallCardsSpawnedFrom,
	reorderOutline,
	savePersonalViewport,
	setMoodboardCaption,
} from "./moodboards";
import {
	CANVAS_HARD_SCENE,
	CANVAS_STRESS_SCENE,
	evaluateMoodboardCanvasScene,
	fileAttachmentOpenHref,
	fitViewportToContent,
	MOODBOARD_COUNTERPARTS,
	MOODBOARD_FOREIGN_IDENTITIES,
	MOODBOARD_KIND,
	MOODBOARDS_COPY,
	moodboardExportInput,
	moodboardShareSnapshot,
	moodboardsCatalog,
	restorePersonalViewport,
	VISUAL_ORIGIN_KIND,
} from "./moodboards-model";

const DATABASE_URL = localTestDatabaseUrl();

const SOCIAL_OR_SECOND_SOURCE =
	/comment thread|reaction|mention|task|file description/i;
const FOREIGN_SURFACE =
	/User Flow|Wireframe|design system|Screen|production asset/i;
const VIEWPORT_FIELDS = /centerX|zoom/;

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
	await prisma.moodboardVisual.deleteMany();
	await prisma.moodboardPersonalViewport.deleteMany();
	await prisma.moodboardGroup.deleteMany();
	await prisma.moodboard.deleteMany();
	await prisma.fileAttachment.deleteMany();
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

async function insertImageVersion(
	prisma: PrismaClient,
	input: { projectId: string; title: string; workspaceId: string }
) {
	const fileId = crypto.randomUUID();
	const versionId = crypto.randomUUID();
	await prisma.fileAttachment.create({
		data: {
			id: fileId,
			lifecycle: "active",
			projectId: input.projectId,
			revision: 1,
			scopeKind: "project",
			title: input.title,
			versions: {
				create: {
					byteLength: 80,
					contentHash: `hash-${versionId}`,
					filename: "shot.png",
					id: versionId,
					kind: "image",
					mimeType: "image/png",
					objectKey: `files/${versionId}`,
					versionNumber: 1,
				},
			},
			workspaceId: input.workspaceId,
		},
	});
	return { fileId, versionId };
}

describe("Moodboards catalog", () => {
	it("exposes English Moodboard labels and origin kinds", () => {
		const catalog = moodboardsCatalog();
		expect(catalog.kind).toBe("Moodboard");
		expect(catalog.copy.moodboard).toBe("Moodboard");
		expect(catalog.copy.createMoodboard).toBe("Create Moodboard");
		expect(catalog.copy.caption).toBe("Caption");
		expect(catalog.copy.fileAttachment).toBe("File Attachment");
		expect(catalog.copy.externalLink).toBe("External link");
		expect(catalog.copy.addVisual).toBe("Add visual");
		expect(catalog.copy.fitView).toBe("Fit View");
		expect(catalog.copy.openSourceRecord).toBe("Open Source Record");
		expect(catalog.copy.outline).toBe("Outline");
		expect(catalog.copy.group).toBe("Group");
		expect(catalog.originKinds).toEqual(["File Attachment", "External link"]);
		expect(catalog.counterparts).toEqual(MOODBOARD_COUNTERPARTS);
		expect(catalog.foreignIdentities).toEqual(MOODBOARD_FOREIGN_IDENTITIES);
		expect(MOODBOARD_COUNTERPARTS.personalViewportIsShareSnapshot).toBe(false);
		expect(MOODBOARD_COUNTERPARTS.personalViewportIsContent).toBe(false);
		expect(JSON.stringify(catalog.copy)).not.toMatch(SOCIAL_OR_SECOND_SOURCE);
		expect(JSON.stringify(catalog.copy)).not.toMatch(FOREIGN_SURFACE);
	});
});

describe("Moodboards", () => {
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

	it("keeps File Attachment origin and optional Caption on a visual", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const shot = await insertImageVersion(prisma, {
			projectId,
			title: "Checkout shot",
			workspaceId,
		});
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-board",
			origin: "human",
			payload: { projectId, title: "Checkout direction" },
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		expect(created.moodboard.recordKind).toBe(MOODBOARD_KIND);
		expect(created.moodboard.visuals).toEqual([]);

		const placed = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-shot",
			origin: "human",
			payload: {
				caption: "Why this checkout density.",
				moodboardId: created.moodboard.id,
				origin: {
					fileAttachmentVersionId: shot.versionId,
					kind: VISUAL_ORIGIN_KIND.fileAttachment,
				},
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			throw new Error("expected visual");
		}
		expect(placed.moodboard.visuals).toEqual([
			{
				caption: "Why this checkout density.",
				groupId: null,
				id: placed.moodboard.visuals[0]?.id,
				openHref: fileAttachmentOpenHref(projectId, shot.fileId),
				openSourceRecord: MOODBOARDS_COPY.openSourceRecord,
				origin: {
					fileAttachmentId: shot.fileId,
					fileAttachmentVersionId: shot.versionId,
					kind: VISUAL_ORIGIN_KIND.fileAttachment,
					title: "Checkout shot",
				},
			},
		]);
		const loaded = await getMoodboard(prisma, created.moodboard.id);
		expect(loaded?.visuals[0]?.origin).toEqual({
			fileAttachmentId: shot.fileId,
			fileAttachmentVersionId: shot.versionId,
			kind: VISUAL_ORIGIN_KIND.fileAttachment,
			title: "Checkout shot",
		});
		const file = await prisma.fileAttachment.findUnique({
			where: { id: shot.fileId },
		});
		expect(file?.title).toBe("Checkout shot");
		expect(loaded?.visuals[0]?.caption).toBe("Why this checkout density.");
		expect(JSON.stringify(loaded)).not.toMatch(SOCIAL_OR_SECOND_SOURCE);
	});

	it("keeps an external-link origin after Caption is set", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-link-board",
			origin: "human",
			payload: { projectId, title: "Reference board" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const placed = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-link",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/ref.png",
				},
			},
		});
		if (placed.status !== "committed") {
			throw new Error("expected visual");
		}
		expect(placed.moodboard.visuals[0]?.caption).toBe("");
		expect(placed.moodboard.visuals[0]?.origin).toEqual({
			kind: VISUAL_ORIGIN_KIND.externalLink,
			url: "https://example.com/ref.png",
		});
		const captioned = await setMoodboardCaption(prisma, {
			actorId,
			baseRevision: placed.moodboard.revision,
			idempotencyKey: "set-caption",
			origin: "human",
			payload: {
				caption: "Warm metal.",
				visualId: placed.moodboard.visuals[0]?.id ?? "",
			},
		});
		expect(captioned.status).toBe("committed");
		if (captioned.status !== "committed") {
			throw new Error("expected caption");
		}
		expect(captioned.moodboard.visuals[0]).toEqual({
			caption: "Warm metal.",
			groupId: null,
			id: placed.moodboard.visuals[0]?.id,
			openHref: "https://example.com/ref.png",
			openSourceRecord: MOODBOARDS_COPY.openSourceRecord,
			origin: {
				kind: VISUAL_ORIGIN_KIND.externalLink,
				url: "https://example.com/ref.png",
			},
		});
	});

	it("rejects Screen or production-asset identity on a visual", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-reject-screen",
			origin: "human",
			payload: { projectId, title: "Direction" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const withScreen = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-screen",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					screenId: "screen-1",
					url: "https://example.com/ui.png",
				},
			},
		});
		expect(withScreen).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
		const withAsset = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-asset",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					fileAttachmentVersionId: crypto.randomUUID(),
					kind: VISUAL_ORIGIN_KIND.fileAttachment,
					productionAssetId: "asset-1",
				},
			},
		});
		expect(withAsset).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
		const listed = await listMoodboards(prisma, projectId);
		expect(listed[0]?.visuals).toEqual([]);
		expect(listed[0]?.recordKind).toBe("Moodboard");
		expect(listed[0]?.recordKind).not.toBe("User Flow");
		expect(JSON.stringify(listed)).not.toMatch(FOREIGN_SURFACE);
	});

	it("does not auto-create a Project Wall card when a visual is placed", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-no-wall",
			origin: "human",
			payload: { projectId, title: "No wall" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const withCard = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-wall",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/wall.png",
				},
				wallCard: true,
			},
		});
		expect(withCard).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
		const placed = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-ok",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/wall.png",
				},
			},
		});
		expect(placed.status).toBe("committed");
		expect(
			await listProjectWallCardsSpawnedFrom(prisma, created.moodboard.id)
		).toEqual([]);
		expect(MOODBOARD_COUNTERPARTS.autoCreateProjectWallCard).toBe(false);
	});

	it("replays the same create command without a second Moodboard", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const command = {
			actorId,
			idempotencyKey: "replay-board",
			origin: "human" as const,
			payload: { projectId, title: "Replay board" },
		};
		const first = await createMoodboard(prisma, command);
		const second = await createMoodboard(prisma, command);
		expect(first.status).toBe("committed");
		expect(second.status).toBe("replayed");
		if (first.status !== "committed" || second.status !== "replayed") {
			throw new Error("expected replay");
		}
		expect(second.moodboard.id).toBe(first.moodboard.id);
		expect(await listMoodboards(prisma, projectId)).toHaveLength(1);
	});
});

describe("Moodboards personal viewport and outline", () => {
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

	it("restores this canvas viewport and does not write relation or share snapshot", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-viewport-board",
			origin: "human",
			payload: { projectId, title: "Viewport board" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const first = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "visual-a",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/a.png",
				},
			},
		});
		if (first.status !== "committed") {
			throw new Error("expected visual");
		}
		const saved = await savePersonalViewport(prisma, {
			actorId,
			payload: {
				moodboardId: created.moodboard.id,
				viewport: {
					centerX: 120,
					centerY: 40,
					collapsedGroupIds: ["gone-group"],
					zoom: 1.5,
				},
			},
		});
		expect(saved.status).toBe("committed");
		const restored = await getPersonalViewport(prisma, {
			actorId,
			moodboardId: created.moodboard.id,
		});
		expect(restored).toEqual({
			fitted: false,
			inspectorOpen: false,
			selectedId: null,
			unsaved: false,
			viewport: {
				centerX: 120,
				centerY: 40,
				collapsedGroupIds: [],
				zoom: 1.5,
			},
		});
		const other = await prisma.user.create({
			data: {
				email: `other-${crypto.randomUUID()}@example.com`,
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Other",
			},
		});
		const otherView = await getPersonalViewport(prisma, {
			actorId: other.id,
			moodboardId: created.moodboard.id,
		});
		expect(otherView?.fitted).toBe(true);
		expect(otherView?.viewport.centerX).not.toBe(120);
		const content = await getMoodboard(prisma, created.moodboard.id);
		expect(content).not.toHaveProperty("viewport");
		expect(JSON.stringify(content)).not.toMatch(VIEWPORT_FIELDS);
		expect(
			moodboardShareSnapshot(content ?? created.moodboard)
		).not.toHaveProperty("viewport");
		expect(
			JSON.stringify(moodboardShareSnapshot(content ?? created.moodboard))
		).not.toMatch(VIEWPORT_FIELDS);
		expect(
			JSON.stringify(moodboardExportInput(content ?? created.moodboard))
		).not.toMatch(VIEWPORT_FIELDS);
		expect(
			await prisma.typedRelation.count({
				where: { fromId: created.moodboard.id },
			})
		).toBe(0);
		const afterSave = await getMoodboard(prisma, created.moodboard.id);
		expect(afterSave?.revision).toBe(first.moodboard.revision);
	});

	it("fits visible content from a meaningless saved position and does not restore selection", () => {
		const content = {
			groups: [] as { id: string }[],
			visuals: [
				{ groupId: null, id: "v1" },
				{ groupId: null, id: "v2" },
			],
		};
		const fitted = fitViewportToContent(content);
		expect(restorePersonalViewport({ content, saved: null })).toEqual({
			fitted: true,
			inspectorOpen: false,
			selectedId: null,
			unsaved: false,
			viewport: fitted,
		});
		const fromFitView = restorePersonalViewport({
			content,
			saved: {
				centerX: fitted.centerX,
				centerY: fitted.centerY,
				collapsedGroupIds: [],
				zoom: fitted.zoom,
			},
			session: {
				inspectorOpen: true,
				selectedId: "v1",
				unsaved: true,
			},
		});
		expect(fromFitView.selectedId).toBeNull();
		expect(fromFitView.inspectorOpen).toBe(false);
		expect(fromFitView.unsaved).toBe(false);
		expect(fromFitView.viewport.centerX).toBe(fitted.centerX);
		const meaningless = restorePersonalViewport({
			content,
			saved: {
				centerX: 50_000,
				centerY: -40_000,
				collapsedGroupIds: [],
				zoom: 0,
			},
		});
		expect(meaningless.fitted).toBe(true);
		expect(meaningless.viewport.centerX).toBe(fitted.centerX);
		expect(meaningless.viewport.centerY).toBe(fitted.centerY);
	});

	it("adds, selects, reorders, groups, inspects, and opens source from the outline", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const shot = await insertImageVersion(prisma, {
			projectId,
			title: "Checkout shot",
			workspaceId,
		});
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-outline-board",
			origin: "human",
			payload: { projectId, title: "Outline board" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const first = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "outline-a",
			origin: "human",
			payload: {
				caption: "First ref",
				moodboardId: created.moodboard.id,
				origin: {
					fileAttachmentVersionId: shot.versionId,
					kind: VISUAL_ORIGIN_KIND.fileAttachment,
				},
			},
		});
		const second = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "outline-b",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/b.png",
				},
			},
		});
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected visuals");
		}
		const firstId = first.moodboard.visuals[0]?.id ?? "";
		const secondId = second.moodboard.visuals[1]?.id ?? "";
		const reordered = await reorderOutline(prisma, {
			actorId,
			idempotencyKey: "reorder-outline",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				visualIds: [secondId, firstId],
			},
		});
		expect(reordered.status).toBe("committed");
		if (reordered.status !== "committed") {
			throw new Error("expected reorder");
		}
		expect(reordered.moodboard.visuals.map((visual) => visual.id)).toEqual([
			secondId,
			firstId,
		]);
		const grouped = await groupOutline(prisma, {
			actorId,
			idempotencyKey: "group-outline",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				title: MOODBOARDS_COPY.group,
				visualIds: [secondId, firstId],
			},
		});
		expect(grouped.status).toBe("committed");
		if (grouped.status !== "committed") {
			throw new Error("expected group");
		}
		expect(grouped.moodboard.groups).toHaveLength(1);
		expect(grouped.moodboard.groups[0]?.title).toBe(MOODBOARDS_COPY.group);
		expect(grouped.moodboard.visuals.every((visual) => visual.groupId)).toBe(
			true
		);
		const inspected = grouped.moodboard.visuals.find(
			(visual) => visual.id === firstId
		);
		expect(inspected?.caption).toBe("First ref");
		expect(inspected?.origin.kind).toBe(VISUAL_ORIGIN_KIND.fileAttachment);
		expect(inspected?.openSourceRecord).toBe(MOODBOARDS_COPY.openSourceRecord);
		expect(inspected?.openHref).toBe(
			fileAttachmentOpenHref(projectId, shot.fileId)
		);
		const collapse = await savePersonalViewport(prisma, {
			actorId,
			payload: {
				moodboardId: created.moodboard.id,
				viewport: {
					centerX: 80,
					centerY: 0,
					collapsedGroupIds: [grouped.moodboard.groups[0]?.id ?? ""],
					zoom: 1,
				},
			},
		});
		expect(collapse.status).toBe("committed");
		const restored = await getPersonalViewport(prisma, {
			actorId,
			moodboardId: created.moodboard.id,
		});
		expect(restored?.viewport.collapsedGroupIds).toEqual([
			grouped.moodboard.groups[0]?.id,
		]);
	});

	it("does not crash or corrupt the 500/750 hard scene or 2000/3000 stress", () => {
		expect(evaluateMoodboardCanvasScene(CANVAS_HARD_SCENE)).toEqual({
			corrupted: false,
			crashed: false,
			detail: "full",
		});
		expect(evaluateMoodboardCanvasScene(CANVAS_STRESS_SCENE)).toEqual({
			corrupted: false,
			crashed: false,
			detail: "reduced",
		});
	});
});
