/**
 * Moodboards seam — Project Tasarım type Moodboard. Each visual keeps
 * File Attachment version or external-link origin plus optional Caption.
 * Caption is not a thread, reaction, task, mention, or second file
 * description. A reference is not a Screen, production asset, User Flow,
 * or Wireframe. Placing a visual does not auto-create a Project Wall card.
 * Color Swatch and palette groups are first-class visual-direction items;
 * they do not write Account Appearance, Completion effect, CSS, production
 * tokens, persistent custom fields, or Project Wall card highlight. There
 * is no automatic color suggestion or stock-image search.
 * docs/specs/50-moodboards/spec.md and GitHub #358, #359.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Tasarım bağlamı Moodboard half).
 */

import {
	getAccountPreferences,
	getCompletionEffectPreference,
	saveAccountPreferences,
	saveCompletionEffectPreference,
} from "@cantiara/auth";
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listCustomFields } from "../../custom-fields/server/custom-fields";
import { createProject } from "../../project-shell/server/project-shell";

import {
	addColorSwatch,
	addMoodboardVisual,
	addPaletteGroup,
	createMoodboard,
	getMoodboard,
	listMoodboards,
	listProjectWallCardsSpawnedFrom,
	setMoodboardCaption,
} from "./moodboards";
import {
	COLOR_SOURCE_KIND,
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
const STOCK_OR_AUTO_SUGGEST =
	/stock image|unsplash|auto(?:matic)? color suggest|color suggestion/i;

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
	await prisma.moodboardColorSwatch.deleteMany();
	await prisma.moodboardPaletteGroup.deleteMany();
	await prisma.moodboardVisual.deleteMany();
	await prisma.moodboard.deleteMany();
	await prisma.completionEffectPreference.deleteMany();
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

	it("exposes Color Swatch labels and refuses theme, token, and stock-search paths", () => {
		const catalog = moodboardsCatalog();
		expect(catalog.copy.colorSwatch).toBe("Color Swatch");
		expect(catalog.copy.addColorSwatch).toBe("Add Color Swatch");
		expect(catalog.copy.paletteGroup).toBe("Palette group");
		expect(catalog.copy.addPaletteGroup).toBe("Add palette group");
		expect(catalog.copy.note).toBe("Note");
		expect(catalog.copy.picker).toBe("Picker");
		expect(catalog.copy.eyedrop).toBe("Eyedrop");
		expect(catalog.copy.hex).toBe("HEX");
		expect(catalog.copy.rgb).toBe("RGB");
		expect(catalog.copy.hsl).toBe("HSL");
		expect(catalog.colorInputKinds).toEqual([
			"Picker",
			"Eyedrop",
			"HEX",
			"RGB",
			"HSL",
		]);
		expect(catalog.counterparts.appliesColorToProductUi).toBe(false);
		expect(catalog.counterparts.writesAccountTheme).toBe(false);
		expect(catalog.counterparts.writesCompletionEffect).toBe(false);
		expect(catalog.counterparts.writesCustomCss).toBe(false);
		expect(catalog.counterparts.writesProductionToken).toBe(false);
		expect(catalog.counterparts.writesPersistentCustomField).toBe(false);
		expect(catalog.counterparts.writesProjectWallCardHighlight).toBe(false);
		expect(catalog.counterparts.autoColorSuggestion).toBe(false);
		expect(catalog.counterparts.stockImageSearch).toBe(false);
		expect(catalog.paths.autoColorSuggestion).toBeNull();
		expect(catalog.paths.stockImageSearch).toBeNull();
		expect(JSON.stringify(catalog)).not.toMatch(STOCK_OR_AUTO_SUGGEST);
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

	it("keeps a Color Swatch as first-class HEX, RGB, HSL, and Picker color with a short note", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-swatch-board",
			origin: "human",
			payload: { projectId, title: "Checkout color" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		expect(created.moodboard.colorSwatches).toEqual([]);
		expect(created.moodboard.paletteGroups).toEqual([]);

		const hex = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "hex-swatch",
			origin: "human",
			payload: {
				color: { hex: "#336699", kind: COLOR_SOURCE_KIND.hex },
				moodboardId: created.moodboard.id,
				note: "Steel checkout.",
			},
		});
		expect(hex.status).toBe("committed");
		if (hex.status !== "committed") {
			throw new Error("expected hex swatch");
		}
		expect(hex.moodboard.colorSwatches).toEqual([
			{
				hex: "#336699",
				hsl: { h: 210, l: 40, s: 50 },
				id: hex.moodboard.colorSwatches[0]?.id,
				note: "Steel checkout.",
				paletteGroupId: null,
				rgb: { b: 153, g: 102, r: 51 },
				source: { kind: COLOR_SOURCE_KIND.hex },
			},
		]);

		const rgb = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "rgb-swatch",
			origin: "human",
			payload: {
				color: { b: 0, g: 0, kind: COLOR_SOURCE_KIND.rgb, r: 255 },
				moodboardId: created.moodboard.id,
			},
		});
		if (rgb.status !== "committed") {
			throw new Error("expected rgb swatch");
		}
		expect(rgb.moodboard.colorSwatches[1]).toMatchObject({
			hex: "#FF0000",
			hsl: { h: 0, l: 50, s: 100 },
			note: "",
			paletteGroupId: null,
			rgb: { b: 0, g: 0, r: 255 },
			source: { kind: COLOR_SOURCE_KIND.rgb },
		});

		const hsl = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "hsl-swatch",
			origin: "human",
			payload: {
				color: { h: 0, kind: COLOR_SOURCE_KIND.hsl, l: 50, s: 100 },
				moodboardId: created.moodboard.id,
			},
		});
		if (hsl.status !== "committed") {
			throw new Error("expected hsl swatch");
		}
		expect(hsl.moodboard.colorSwatches[2]).toMatchObject({
			hex: "#FF0000",
			hsl: { h: 0, l: 50, s: 100 },
			rgb: { b: 0, g: 0, r: 255 },
			source: { kind: COLOR_SOURCE_KIND.hsl },
		});

		const picker = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "picker-swatch",
			origin: "human",
			payload: {
				color: { hex: "#00AA55", kind: COLOR_SOURCE_KIND.picker },
				moodboardId: created.moodboard.id,
			},
		});
		if (picker.status !== "committed") {
			throw new Error("expected picker swatch");
		}
		expect(picker.moodboard.colorSwatches[3]).toMatchObject({
			hex: "#00AA55",
			source: { kind: COLOR_SOURCE_KIND.picker },
		});
		expect(picker.moodboard.recordKind).toBe(MOODBOARD_KIND);
	});

	it("groups Color Swatches in a palette group without applying them to product UI", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-palette-board",
			origin: "human",
			payload: { projectId, title: "Palette board" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const grouped = await addPaletteGroup(prisma, {
			actorId,
			idempotencyKey: "add-group",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				title: "Metals",
			},
		});
		expect(grouped.status).toBe("committed");
		if (grouped.status !== "committed") {
			throw new Error("expected palette group");
		}
		expect(grouped.moodboard.paletteGroups).toEqual([
			{
				colorSwatches: [],
				id: grouped.moodboard.paletteGroups[0]?.id,
				title: "Metals",
			},
		]);
		const swatch = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "grouped-swatch",
			origin: "human",
			payload: {
				color: { hex: "#C0C0C0", kind: COLOR_SOURCE_KIND.hex },
				moodboardId: created.moodboard.id,
				paletteGroupId: grouped.moodboard.paletteGroups[0]?.id,
			},
		});
		if (swatch.status !== "committed") {
			throw new Error("expected grouped swatch");
		}
		expect(swatch.moodboard.paletteGroups[0]?.colorSwatches).toHaveLength(1);
		expect(swatch.moodboard.paletteGroups[0]?.colorSwatches[0]?.hex).toBe(
			"#C0C0C0"
		);
		expect(swatch.moodboard.colorSwatches).toEqual([]);
		expect(MOODBOARD_COUNTERPARTS.appliesColorToProductUi).toBe(false);
		const applyUi = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "apply-ui",
			origin: "human",
			payload: {
				applyToProductUi: true,
				color: { hex: "#C0C0C0", kind: COLOR_SOURCE_KIND.hex },
				moodboardId: created.moodboard.id,
			},
		});
		expect(applyUi).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
	});

	it("eyedrops from an exact Moodboard visual and rejects a missing visual", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-eyedrop-board",
			origin: "human",
			payload: { projectId, title: "Eyedrop board" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const placed = await addMoodboardVisual(prisma, {
			actorId,
			idempotencyKey: "place-eyedrop-visual",
			origin: "human",
			payload: {
				moodboardId: created.moodboard.id,
				origin: {
					kind: VISUAL_ORIGIN_KIND.externalLink,
					url: "https://example.com/metal.png",
				},
			},
		});
		if (placed.status !== "committed") {
			throw new Error("expected visual");
		}
		const visualId = placed.moodboard.visuals[0]?.id ?? "";
		const sampled = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "eyedrop-swatch",
			origin: "human",
			payload: {
				color: {
					hex: "#8B5A2B",
					kind: COLOR_SOURCE_KIND.eyedrop,
					visualId,
				},
				moodboardId: created.moodboard.id,
			},
		});
		expect(sampled.status).toBe("committed");
		if (sampled.status !== "committed") {
			throw new Error("expected eyedrop");
		}
		expect(sampled.moodboard.colorSwatches[0]).toMatchObject({
			hex: "#8B5A2B",
			source: { kind: COLOR_SOURCE_KIND.eyedrop, visualId },
		});
		const missing = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "eyedrop-missing",
			origin: "human",
			payload: {
				color: {
					hex: "#8B5A2B",
					kind: COLOR_SOURCE_KIND.eyedrop,
					visualId: crypto.randomUUID(),
				},
				moodboardId: created.moodboard.id,
			},
		});
		expect(missing).toEqual({
			reason: "visual-not-found",
			status: "rejected",
		});
	});

	it("does not write Account theme, Completion effect, token, custom field, or Wall highlight", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		await saveAccountPreferences(prisma, actorId, {
			appearance: "Light",
			dateFormat: "locale",
			firstDayOfWeek: "Monday",
			locale: "en-GB",
			timeZone: "Europe/Istanbul",
		});
		await saveCompletionEffectPreference(prisma, actorId, {
			enabled: true,
			palette: "Haze",
			theme: "Calm",
		});
		const beforeAppearance = await getAccountPreferences(prisma, actorId);
		const beforeCompletion = await getCompletionEffectPreference(
			prisma,
			actorId
		);
		const created = await createMoodboard(prisma, {
			actorId,
			idempotencyKey: "create-no-theme",
			origin: "human",
			payload: { projectId, title: "Direction only" },
		});
		if (created.status !== "committed") {
			throw new Error("expected moodboard");
		}
		const written = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "theme-swatch",
			origin: "human",
			payload: {
				color: { hex: "#112233", kind: COLOR_SOURCE_KIND.hex },
				moodboardId: created.moodboard.id,
			},
		});
		expect(written.status).toBe("committed");
		expect(await getAccountPreferences(prisma, actorId)).toEqual(
			beforeAppearance
		);
		expect(await getCompletionEffectPreference(prisma, actorId)).toEqual(
			beforeCompletion
		);
		expect(await listCustomFields(prisma, projectId)).toEqual([]);
		expect(
			await listProjectWallCardsSpawnedFrom(prisma, created.moodboard.id)
		).toEqual([]);
		const tokenWrite = await addColorSwatch(prisma, {
			actorId,
			idempotencyKey: "token-write",
			origin: "human",
			payload: {
				appearance: "Dark",
				color: { hex: "#112233", kind: COLOR_SOURCE_KIND.hex },
				completionEffect: { palette: "Haze", theme: "Calm" },
				css: ":root { --brand: #112233; }",
				customField: { label: "Brand" },
				moodboardId: created.moodboard.id,
				token: "color.brand",
				wallHighlight: true,
			},
		});
		expect(tokenWrite).toEqual({
			reason: "invalid-command",
			status: "rejected",
		});
		expect(await getAccountPreferences(prisma, actorId)).toEqual(
			beforeAppearance
		);
		expect(await getCompletionEffectPreference(prisma, actorId)).toEqual(
			beforeCompletion
		);
		expect(moodboardsCatalog().paths.stockImageSearch).toBeNull();
	});
});
