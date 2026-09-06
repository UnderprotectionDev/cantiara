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
	listMoodboards,
	listProjectWallCardsSpawnedFrom,
	setMoodboardCaption,
} from "./moodboards";
import {
	MOODBOARD_COUNTERPARTS,
	MOODBOARD_FOREIGN_IDENTITIES,
	MOODBOARD_KIND,
	moodboardsCatalog,
	VISUAL_ORIGIN_KIND,
} from "./moodboards-model";

const DATABASE_URL = localTestDatabaseUrl();

const SOCIAL_OR_SECOND_SOURCE =
	/comment thread|reaction|mention|task|file description/i;
const FOREIGN_SURFACE =
	/User Flow|Wireframe|design system|Screen|production asset/i;

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
		expect(catalog.originKinds).toEqual(["File Attachment", "External link"]);
		expect(catalog.counterparts).toEqual(MOODBOARD_COUNTERPARTS);
		expect(catalog.foreignIdentities).toEqual(MOODBOARD_FOREIGN_IDENTITIES);
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
				id: placed.moodboard.visuals[0]?.id,
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
			id: placed.moodboard.visuals[0]?.id,
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
			listProjectWallCardsSpawnedFrom(prisma, created.moodboard.id)
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
