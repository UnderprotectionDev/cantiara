/**
 * Completion Effects seam — Hesap enablement, closed theme/palette
 * catalog, static samples, Preview that does not touch Work status,
 * the success notice, or the 30-second wait; trigger and exclude
 * matrix for User-initiated Work Success; idempotency/multi-tab;
 * client-only 30-second wait; 10-second Work completed notice;
 * Reduce Motion; 1.2s layer; drawing-budget fallback. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Bitiriş efekti: settings/preview, allow-list, trigger/exclude,
 * idempotency/multi-tab, 30s wait, 1.2/10s notice, Reduce Motion,
 * flash/focus/input, low-performance fallback).
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
	COMPLETION_EFFECT_MOTION_SAFETY,
	COMPLETION_EFFECT_THEMES,
	catalogBrowseMotion,
	clearPresentationOnSurfaceChange,
	closeOutcomeToAcceptance,
	completionEffectPreferenceInputSchema,
	DECORATIVE_LAYER_MS,
	DECORATIVE_WAIT_MS,
	defaultCompletionEffectPreference,
	idleCompletionEffectsClientSession,
	observeCloseAcceptance,
	PREVIEW_MOTION_MS,
	palettesForTheme,
	previewFallback,
	previewMotion,
	requestReopenFromNotice,
	SUCCESS_NOTICE_MS,
	startPreview,
	themeForPaletteChange,
	visibleSuccessPresentation,
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
const FORBIDDEN_PLAY_RECORD_PATTERN =
	/played|delivered|seen|waitUntil|closeCycle/i;
const FORBIDDEN_FEEDBACK_PATTERN = /Stop|sound|haptic|strobe|Needs Action/i;

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

	it("plays the effect only after the visible client close is accepted as Completed", () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const nowMs = 10_000;
		const accepted = closeOutcomeToAcceptance({
			closeCycleId: "cycle-1",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		});
		expect(accepted).toEqual({
			closeCycleId: "cycle-1",
			closureResult: "Completed",
			serverAccepted: true,
			source: "user-initiated-close",
			workId: "work-1",
		});
		expect(
			observeCloseAcceptance(
				enabled,
				idleCompletionEffectsClientSession(),
				accepted,
				nowMs
			)
		).toEqual({
			feedback: "effect",
			session: {
				decorativeWaitUntilMs: nowMs + DECORATIVE_WAIT_MS,
				feedback: "effect",
				lastCloseCycleId: "cycle-1",
				notice: "Work completed",
				noticeUntilMs: nowMs + SUCCESS_NOTICE_MS,
				reopenConfirmationRequested: false,
				workStatus: "Closed",
			},
		});
		expect(DECORATIVE_WAIT_MS).toBe(30_000);
		expect(
			observeCloseAcceptance(
				{ enabled: false, palette: "Haze", theme: "Calm" },
				idleCompletionEffectsClientSession(),
				accepted,
				nowMs
			)
		).toEqual({
			feedback: "base-notice",
			session: {
				decorativeWaitUntilMs: null,
				feedback: "base-notice",
				lastCloseCycleId: "cycle-1",
				notice: "Work completed",
				noticeUntilMs: nowMs + SUCCESS_NOTICE_MS,
				reopenConfirmationRequested: false,
				workStatus: "Closed",
			},
		});
	});

	it("does not start the effect on the close step, optimistic UI, or a failed write", () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const idle = idleCompletionEffectsClientSession();
		const failedStatuses = [
			"pending",
			"optimistic",
			"rejected",
			"conflict",
			"timeout",
			"undo",
		] as const;
		for (const mutationStatus of failedStatuses) {
			const event = closeOutcomeToAcceptance({
				closeCycleId: "cycle-fail",
				closureResult: "Completed",
				mutationStatus,
				workId: "work-1",
			});
			expect(event.serverAccepted).toBe(false);
			expect(observeCloseAcceptance(enabled, idle, event, 1000)).toEqual({
				feedback: "none",
				session: idle,
			});
		}
	});

	it("does not replay for the same idempotent request, refresh, back, second tab, or background sync", () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const nowMs = 5000;
		const first = observeCloseAcceptance(
			enabled,
			idleCompletionEffectsClientSession(),
			closeOutcomeToAcceptance({
				closeCycleId: "same-key",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			nowMs
		);
		expect(first.feedback).toBe("effect");
		const retry = closeOutcomeToAcceptance({
			closeCycleId: "same-key",
			closureResult: "Completed",
			mutationStatus: "replayed",
			workId: "work-1",
		});
		expect(retry.source).toBe("user-initiated-close");
		expect(
			observeCloseAcceptance(enabled, first.session, retry, nowMs + 10)
		).toEqual({
			feedback: "none",
			session: first.session,
		});
		expect(
			observeCloseAcceptance(
				enabled,
				idleCompletionEffectsClientSession(),
				retry,
				nowMs
			).feedback
		).toBe("effect");
		expect(
			observeCloseAcceptance(
				enabled,
				first.session,
				{
					closeCycleId: "same-key",
					closureResult: "Completed",
					serverAccepted: true,
					source: "user-initiated-close",
					workId: "work-1",
				},
				nowMs + 20
			).feedback
		).toBe("none");
		const otherClientSources = [
			"refresh",
			"history-back",
			"second-tab",
			"background-sync",
		] as const;
		for (const source of otherClientSources) {
			const otherTab = idleCompletionEffectsClientSession();
			expect(
				observeCloseAcceptance(
					enabled,
					otherTab,
					{
						closeCycleId: "same-key",
						closureResult: "Completed",
						serverAccepted: true,
						source,
						workId: "work-1",
					},
					nowMs
				)
			).toEqual({
				feedback: "none",
				session: otherTab,
			});
		}
	});

	it("treats reopen then Completed as a new eligible event and does not replay history", () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const firstAt = 1000;
		const first = observeCloseAcceptance(
			enabled,
			idleCompletionEffectsClientSession(),
			closeOutcomeToAcceptance({
				closeCycleId: "close-1",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			firstAt
		);
		expect(first.feedback).toBe("effect");
		const afterWait = observeCloseAcceptance(
			enabled,
			first.session,
			closeOutcomeToAcceptance({
				closeCycleId: "close-2",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			firstAt + DECORATIVE_WAIT_MS
		);
		expect(afterWait.feedback).toBe("effect");
		expect(afterWait.session.lastCloseCycleId).toBe("close-2");
		expect(afterWait.session.decorativeWaitUntilMs).toBe(
			firstAt + DECORATIVE_WAIT_MS + DECORATIVE_WAIT_MS
		);
	});

	it("does not trigger on Abandoned, checklist, PR merge, automation, or other terminals", () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const idle = idleCompletionEffectsClientSession();
		const excluded = [
			closeOutcomeToAcceptance({
				closeCycleId: "abandoned",
				closureResult: "Abandoned",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "checklist" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "pr-merge" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "prepared-pr-merge-rule" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "external-run-reconcile" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "daily-focus-close" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "focus-period-close" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "milestone-reached" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "project-complete" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "stage-complete" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "project-release-publish" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "other-terminal" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "close-step" as const,
				workId: "work-1",
			},
			{
				closeCycleId: "c",
				closureResult: "Completed" as const,
				serverAccepted: true,
				source: "close-check" as const,
				workId: "work-1",
			},
		];
		expect(excluded[0]).toMatchObject({
			serverAccepted: true,
			source: "abandoned",
		});
		for (const event of excluded) {
			expect(observeCloseAcceptance(enabled, idle, event, 2000)).toEqual({
				feedback: "none",
				session: idle,
			});
		}
	});

	it("does not offer a general success-event engine", async () => {
		const model = await import("./completion-effects-model");
		expect("observeSuccessEvent" in model).toBe(false);
		expect("onSuccessEvent" in model).toBe(false);
		expect("successEventToEffect" in model).toBe(false);
		expect(typeof model.observeCloseAcceptance).toBe("function");
	});

	it("gives later eligible successes only the base notice during the 30-second client wait", async () => {
		const enabled = { enabled: true, palette: "Haze", theme: "Calm" as const };
		const firstAt = 40_000;
		const first = observeCloseAcceptance(
			enabled,
			idleCompletionEffectsClientSession(),
			closeOutcomeToAcceptance({
				closeCycleId: "close-a",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-a",
			}),
			firstAt
		);
		expect(first.feedback).toBe("effect");
		const duringWait = observeCloseAcceptance(
			enabled,
			first.session,
			closeOutcomeToAcceptance({
				closeCycleId: "close-b",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-b",
			}),
			firstAt + 1000
		);
		expect(duringWait).toEqual({
			feedback: "base-notice",
			session: {
				decorativeWaitUntilMs: firstAt + DECORATIVE_WAIT_MS,
				feedback: "base-notice",
				lastCloseCycleId: "close-b",
				notice: "Work completed",
				noticeUntilMs: firstAt + 1000 + SUCCESS_NOTICE_MS,
				reopenConfirmationRequested: false,
				workStatus: "Closed",
			},
		});
		const saved = await saveCompletionEffectPreference(prisma, accountId, {
			enabled: true,
			palette: "Haze",
			theme: "Calm",
		});
		await expect(
			getCompletionEffectPreference(prisma, accountId)
		).resolves.toEqual(saved);
		expect(JSON.stringify(saved)).not.toMatch(FORBIDDEN_PLAY_RECORD_PATTERN);
	});

	it("keeps Work completed visible for 10 seconds with Reopen as confirmation, even when the effect is off", () => {
		const nowMs = 8000;
		const accepted = closeOutcomeToAcceptance({
			closeCycleId: "notice-1",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		});
		const shown = observeCloseAcceptance(
			{ enabled: false, palette: "Haze", theme: "Calm" },
			idleCompletionEffectsClientSession(),
			accepted,
			nowMs
		);
		expect(SUCCESS_NOTICE_MS).toBe(10_000);
		expect(
			visibleSuccessPresentation(shown.session, nowMs + 9999, {
				drawingBudgetHeld: true,
				reduceMotion: false,
			})
		).toEqual({
			ariaLive: "polite",
			decorativeLayer: false,
			notice: true,
			reopen: true,
			stopControl: false,
		});
		expect(
			visibleSuccessPresentation(shown.session, nowMs + SUCCESS_NOTICE_MS, {
				drawingBudgetHeld: true,
				reduceMotion: false,
			}).notice
		).toBe(false);
		const afterReopen = requestReopenFromNotice(shown.session);
		expect(afterReopen.reopenConfirmationRequested).toBe(true);
		expect(afterReopen.workStatus).toBe("Closed");
		expect(afterReopen.notice).toBe("Work completed");
	});

	it("suppresses effect and motion preview under Reduce Motion and keeps the notice", () => {
		const nowMs = 20_000;
		const accepted = closeOutcomeToAcceptance({
			closeCycleId: "rm-1",
			closureResult: "Completed",
			mutationStatus: "committed",
			workId: "work-1",
		});
		const shown = observeCloseAcceptance(
			{ enabled: true, palette: "Haze", theme: "Calm" },
			idleCompletionEffectsClientSession(),
			accepted,
			nowMs,
			{ drawingBudgetHeld: true, reduceMotion: true }
		);
		expect(shown.feedback).toBe("base-notice");
		expect(shown.session.decorativeWaitUntilMs).toBeNull();
		expect(
			visibleSuccessPresentation(shown.session, nowMs, {
				drawingBudgetHeld: true,
				reduceMotion: true,
			})
		).toMatchObject({
			ariaLive: "polite",
			decorativeLayer: false,
			notice: true,
		});
		expect(previewMotion(nowMs, nowMs, true)).toBe("static");
		expect(previewFallback(true)).toBe("static-last-frame");
		expect(previewFallback(false)).toBe("motion");
		expect(COMPLETION_EFFECTS_COPY.calmMotion).toBe(
			"Calm settles as quiet marks in the last frame."
		);
	});

	it("does not emit sound, haptics, strobe, a stop control, or a notification-center record", async () => {
		expect(COMPLETION_EFFECT_MOTION_SAFETY).toEqual({
			captureFocus: false,
			captureInput: false,
			flash: false,
			haptics: false,
			notificationCenter: false,
			sound: false,
			stopControl: false,
			strobe: false,
		});
		expect(completionEffectsChrome()).not.toHaveProperty("stop");
		expect(JSON.stringify(completionEffectsChrome())).not.toMatch(
			FORBIDDEN_FEEDBACK_PATTERN
		);
		const model = await import("./completion-effects-model");
		expect("createAttentionSignal" in model).toBe(false);
		expect("mintNotification" in model).toBe(false);
	});

	it("limits the decorative layer to 1.2 seconds, does not capture focus or input, and clears on surface change", () => {
		const nowMs = 3000;
		const shown = observeCloseAcceptance(
			{ enabled: true, palette: "Haze", theme: "Calm" },
			idleCompletionEffectsClientSession(),
			closeOutcomeToAcceptance({
				closeCycleId: "layer-1",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			nowMs
		);
		expect(DECORATIVE_LAYER_MS).toBe(1200);
		expect(PREVIEW_MOTION_MS).toBe(1200);
		expect(
			visibleSuccessPresentation(shown.session, nowMs + 1199, {
				drawingBudgetHeld: true,
				reduceMotion: false,
			}).decorativeLayer
		).toBe(true);
		expect(
			visibleSuccessPresentation(shown.session, nowMs + DECORATIVE_LAYER_MS, {
				drawingBudgetHeld: true,
				reduceMotion: false,
			})
		).toEqual({
			ariaLive: "polite",
			decorativeLayer: false,
			notice: true,
			reopen: true,
			stopControl: false,
		});
		const cleared = clearPresentationOnSurfaceChange(shown.session);
		expect(cleared.notice).toBeNull();
		expect(cleared.feedback).toBe("none");
		expect(cleared.decorativeWaitUntilMs).toBe(nowMs + DECORATIVE_WAIT_MS);
		expect(cleared.lastCloseCycleId).toBe("layer-1");
		expect(COMPLETION_EFFECT_MOTION_SAFETY.captureFocus).toBe(false);
		expect(COMPLETION_EFFECT_MOTION_SAFETY.captureInput).toBe(false);
	});

	it("skips decoration when the drawing budget cannot be held and keeps the notice equally fast", () => {
		const nowMs = 12_000;
		const shown = observeCloseAcceptance(
			{ enabled: true, palette: "Haze", theme: "Calm" },
			idleCompletionEffectsClientSession(),
			closeOutcomeToAcceptance({
				closeCycleId: "budget-1",
				closureResult: "Completed",
				mutationStatus: "committed",
				workId: "work-1",
			}),
			nowMs,
			{ drawingBudgetHeld: false, reduceMotion: false }
		);
		expect(shown).toEqual({
			feedback: "base-notice",
			session: {
				decorativeWaitUntilMs: null,
				feedback: "base-notice",
				lastCloseCycleId: "budget-1",
				notice: "Work completed",
				noticeUntilMs: nowMs + SUCCESS_NOTICE_MS,
				reopenConfirmationRequested: false,
				workStatus: "Closed",
			},
		});
		expect(
			visibleSuccessPresentation(shown.session, nowMs, {
				drawingBudgetHeld: false,
				reduceMotion: false,
			}).decorativeLayer
		).toBe(false);
	});
});
