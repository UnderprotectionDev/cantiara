/**
 * Completion Effects seam — Hesap enablement, closed theme/palette
 * catalog, static samples, Preview that does not touch Work status,
 * the success notice, or the 30-second wait. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Bitiriş efekti: settings/preview, allow-list).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	COMPLETION_EFFECTS_COPY,
	completionEffectsChrome,
} from "./completion-effects-copy";
import {
	COMPLETION_EFFECT_THEMES,
	catalogBrowseMotion,
	completionEffectPreferenceInputSchema,
	defaultCompletionEffectPreference,
	idleCompletionEffectsClientSession,
	PREVIEW_MOTION_MS,
	palettesForTheme,
	previewMotion,
	startPreview,
	themeForPaletteChange,
} from "./completion-effects-model";
import {
	getCompletionEffectPreference,
	saveCompletionEffectPreference,
} from "./completion-effects-persist";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FREE_PARAMETER_PATTERN = /random|particle|density|speed/i;
const FORBIDDEN_CATALOG_PATTERN =
	/Mario|Pikachu|Elsa|Jedi|Marvel|upload|licensed|Moodboard|System/i;

function catalogLiterals() {
	return {
		Arc: ["Gleam", "Trace", "Halo", "Span"],
		Calm: ["Haze", "Pebble", "Linen", "Moss"],
		Nova: ["Ember", "Pulse", "Orbit", "Flare"],
		Weave: ["Loom", "Cord", "Lattice", "Knot"],
	} as const;
}

describe("Completion Effects", () => {
	let prisma: PrismaClient;
	let pool: Pool;
	let accountId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.completionEffectPreference.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
		const user = await prisma.user.create({
			data: {
				email: "founder@example.com",
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Founder",
			},
		});
		accountId = user.id;
		await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Workspace",
				ownerId: accountId,
			},
		});
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("keeps Hesap persist off the web Completion Effects modules", async () => {
		const copy = await import("./completion-effects-copy");
		const model = await import("./completion-effects-model");
		for (const webModule of [copy, model]) {
			expect("getCompletionEffectPreference" in webModule).toBe(false);
			expect("saveCompletionEffectPreference" in webModule).toBe(false);
		}
	});

	it("is off by default with Calm and Haze until the Hesap enables it", async () => {
		await expect(
			getCompletionEffectPreference(prisma, accountId)
		).resolves.toEqual(defaultCompletionEffectPreference());
		expect(defaultCompletionEffectPreference()).toEqual({
			enabled: false,
			palette: "Haze",
			theme: "Calm",
		});
	});

	it("saves enablement, theme, and palette on the Hesap for every Project", async () => {
		const saved = await saveCompletionEffectPreference(prisma, accountId, {
			enabled: true,
			palette: "Lattice",
			theme: "Weave",
		});
		expect(saved).toEqual({
			enabled: true,
			palette: "Lattice",
			theme: "Weave",
		});
		await expect(
			getCompletionEffectPreference(prisma, accountId)
		).resolves.toEqual(saved);
		expect("projectId" in saved).toBe(false);
		expect("eventId" in saved).toBe(false);
	});

	it("reads and writes Hesap preference when bun --hot kept a Prisma client without the Completion effect preference delegate", async () => {
		const hotPrisma = new Proxy(prisma, {
			get(target, prop, receiver) {
				if (prop === "completionEffectPreference") {
					return;
				}
				return Reflect.get(target, prop, receiver);
			},
		}) as PrismaClient;
		expect(hotPrisma.completionEffectPreference).toBeUndefined();
		const saved = await saveCompletionEffectPreference(hotPrisma, accountId, {
			enabled: true,
			palette: "Moss",
			theme: "Calm",
		});
		await expect(
			getCompletionEffectPreference(hotPrisma, accountId)
		).resolves.toEqual(saved);
	});

	it("keeps a closed catalog of four themes with exactly four palettes each", () => {
		expect(COMPLETION_EFFECT_THEMES).toEqual(["Calm", "Weave", "Arc", "Nova"]);
		const expected = catalogLiterals();
		for (const theme of COMPLETION_EFFECT_THEMES) {
			expect(palettesForTheme(theme)).toEqual([...expected[theme]]);
			expect(palettesForTheme(theme)).toHaveLength(4);
		}
	});

	it("rejects unnamed catalog values so they cannot be stored or played", async () => {
		await expect(
			saveCompletionEffectPreference(prisma, accountId, {
				enabled: true,
				palette: "Unnamed",
				theme: "Calm",
			})
		).rejects.toThrow();
		await expect(
			saveCompletionEffectPreference(prisma, accountId, {
				enabled: true,
				palette: "Haze",
				theme: "Nova",
			})
		).rejects.toThrow();
		expect(
			completionEffectPreferenceInputSchema.safeParse({
				enabled: true,
				palette: "Random",
				theme: "Calm",
			}).success
		).toBe(false);
		await expect(
			getCompletionEffectPreference(prisma, accountId)
		).resolves.toEqual(defaultCompletionEffectPreference());
	});

	it("keeps samples static while browsing and starts motion only from Preview", () => {
		const session = idleCompletionEffectsClientSession();
		expect(catalogBrowseMotion()).toBe("static");
		expect(previewMotion(null, 0)).toBe("static");
		const afterPreview = startPreview(session);
		expect(afterPreview).toEqual(session);
		expect(previewMotion(1000, 1000)).toBe("playing");
		expect(previewMotion(1000, 1000 + PREVIEW_MOTION_MS)).toBe("static");
		expect(PREVIEW_MOTION_MS).toBe(1200);
	});

	it("does not let Preview change Work status, the success notice, or the 30-second wait", () => {
		const session = {
			decorativeWaitUntilMs: 50_000,
			notice: "Work completed" as const,
			workStatus: "In Progress",
		};
		expect(startPreview(session)).toEqual(session);
		expect(startPreview(idleCompletionEffectsClientSession())).toEqual(
			idleCompletionEffectsClientSession()
		);
	});

	it("does not offer random pick, Project override, per-event pick, or a free parameter editor", async () => {
		const saved = await saveCompletionEffectPreference(prisma, accountId, {
			enabled: true,
			palette: "Gleam",
			theme: "Arc",
		});
		expect(JSON.stringify(saved)).not.toMatch(FREE_PARAMETER_PATTERN);
		expect(themeForPaletteChange("Arc", "Gleam", "Nova")).toEqual({
			palette: "Ember",
			theme: "Nova",
		});
		expect(
			completionEffectPreferenceInputSchema.safeParse({
				enabled: true,
				palette: "Gleam",
				projectId: "proj_1",
				theme: "Arc",
			}).success
		).toBe(false);
	});

	it("uses original first-party catalog names with no licensed or upload path", () => {
		const catalog = JSON.stringify({
			copy: COMPLETION_EFFECTS_COPY,
			palettes: catalogLiterals(),
			themes: COMPLETION_EFFECT_THEMES,
		});
		expect(catalog).not.toMatch(FORBIDDEN_CATALOG_PATTERN);
		expect(completionEffectsChrome()).toMatchObject({
			arc: "Arc",
			calm: "Calm",
			heading: "Completion effects",
			nova: "Nova",
			preview: "Preview",
			weave: "Weave",
		});
		expect(Object.values(completionEffectsChrome())).not.toContain("Language");
		expect(Object.values(completionEffectsChrome())).not.toContain("Random");
		expect(Object.values(completionEffectsChrome())).not.toContain(
			"Appearance"
		);
	});
});
