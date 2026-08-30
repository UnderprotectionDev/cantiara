import { z } from "zod";

export const COMPLETION_EFFECT_THEMES = [
	"Calm",
	"Weave",
	"Arc",
	"Nova",
] as const;

export const COMPLETION_EFFECT_PALETTES = {
	Arc: ["Gleam", "Trace", "Halo", "Span"],
	Calm: ["Haze", "Pebble", "Linen", "Moss"],
	Nova: ["Ember", "Pulse", "Orbit", "Flare"],
	Weave: ["Loom", "Cord", "Lattice", "Knot"],
} as const;

export type CompletionEffectTheme = (typeof COMPLETION_EFFECT_THEMES)[number];
export type CompletionEffectPalette =
	(typeof COMPLETION_EFFECT_PALETTES)[CompletionEffectTheme][number];

export const PREVIEW_MOTION_MS = 1200;
export const DECORATIVE_LAYER_MS = PREVIEW_MOTION_MS;
export const SUCCESS_NOTICE_MS = 10_000;
export const DECORATIVE_WAIT_MS = 30_000;
export const DRAWING_FRAME_BUDGET_MS = 33;

export const COMPLETION_EFFECT_MOTION_SAFETY = {
	captureFocus: false,
	captureInput: false,
	flash: false,
	haptics: false,
	notificationCenter: false,
	sound: false,
	stopControl: false,
	strobe: false,
} as const;

export interface CompletionEffectsPresentation {
	drawingBudgetHeld: boolean;
	reduceMotion: boolean;
}

export const defaultCompletionEffectsPresentation: CompletionEffectsPresentation =
	{
		drawingBudgetHeld: true,
		reduceMotion: false,
	};

export type PreviewFallback = "motion" | "static-last-frame";

export type CompletionEffectsFeedback = "effect" | "base-notice" | "none";

export type CloseAcceptanceSource =
	| "user-initiated-close"
	| "abandoned"
	| "checklist"
	| "pr-merge"
	| "prepared-pr-merge-rule"
	| "external-run-reconcile"
	| "daily-focus-close"
	| "focus-period-close"
	| "milestone-reached"
	| "project-complete"
	| "stage-complete"
	| "project-release-publish"
	| "other-terminal"
	| "close-step"
	| "close-check"
	| "optimistic"
	| "rejected"
	| "conflict"
	| "timeout"
	| "undo"
	| "idempotent-retry"
	| "refresh"
	| "history-back"
	| "second-tab"
	| "background-sync";

export type CloseMutationStatus =
	| "pending"
	| "optimistic"
	| "committed"
	| "replayed"
	| "rejected"
	| "conflict"
	| "timeout"
	| "undo";

export interface CloseAcceptance {
	closeCycleId: string;
	closureResult: "Completed" | "Abandoned" | null;
	serverAccepted: boolean;
	source: CloseAcceptanceSource;
	workId: string;
}

export interface CloseOutcomeInput {
	closeCycleId: string;
	closureResult: "Completed" | "Abandoned";
	mutationStatus: CloseMutationStatus;
	workId: string;
}

export const completionEffectThemeSchema = z.enum(COMPLETION_EFFECT_THEMES);

export function palettesForTheme(
	theme: CompletionEffectTheme
): readonly CompletionEffectPalette[] {
	return COMPLETION_EFFECT_PALETTES[theme];
}

export function isCatalogSelection(
	theme: string,
	palette: string
): theme is CompletionEffectTheme {
	if (!COMPLETION_EFFECT_THEMES.includes(theme as CompletionEffectTheme)) {
		return false;
	}
	const palettes = COMPLETION_EFFECT_PALETTES[
		theme as CompletionEffectTheme
	] as readonly string[];
	return palettes.includes(palette);
}

export const completionEffectPreferenceInputSchema = z
	.object({
		enabled: z.boolean(),
		palette: z.string().min(1),
		theme: completionEffectThemeSchema,
	})
	.strict()
	.superRefine((value, ctx) => {
		if (!isCatalogSelection(value.theme, value.palette)) {
			ctx.addIssue({
				code: "custom",
				message: "Unknown catalog value",
				path: ["palette"],
			});
		}
	});

export type CompletionEffectPreferenceInput = z.infer<
	typeof completionEffectPreferenceInputSchema
>;

export type CompletionEffectPreference = CompletionEffectPreferenceInput;

export function defaultCompletionEffectPreference(): CompletionEffectPreference {
	return {
		enabled: false,
		palette: "Haze",
		theme: "Calm",
	};
}

export function themeForPaletteChange(
	_currentTheme: CompletionEffectTheme,
	currentPalette: string,
	nextTheme: CompletionEffectTheme
): Pick<CompletionEffectPreference, "palette" | "theme"> {
	if (isCatalogSelection(nextTheme, currentPalette)) {
		return { palette: currentPalette, theme: nextTheme };
	}
	return {
		palette: COMPLETION_EFFECT_PALETTES[nextTheme][0],
		theme: nextTheme,
	};
}

export function catalogBrowseMotion(): "static" {
	return "static";
}

export interface CompletionEffectsClientSession {
	decorativeWaitUntilMs: number | null;
	feedback: CompletionEffectsFeedback;
	lastCloseCycleId: string | null;
	notice: "Work completed" | null;
	noticeUntilMs: number | null;
	reopenConfirmationRequested: boolean;
	workStatus: string | null;
}

export function idleCompletionEffectsClientSession(): CompletionEffectsClientSession {
	return {
		decorativeWaitUntilMs: null,
		feedback: "none",
		lastCloseCycleId: null,
		notice: null,
		noticeUntilMs: null,
		reopenConfirmationRequested: false,
		workStatus: null,
	};
}

export function startPreview(
	session: CompletionEffectsClientSession
): CompletionEffectsClientSession {
	return { ...session };
}

const FAILED_WRITE_SOURCE: Record<
	Exclude<CloseMutationStatus, "committed" | "replayed">,
	CloseAcceptanceSource
> = {
	conflict: "conflict",
	optimistic: "optimistic",
	pending: "close-step",
	rejected: "rejected",
	timeout: "timeout",
	undo: "undo",
};

export function closeOutcomeToAcceptance(
	input: CloseOutcomeInput
): CloseAcceptance {
	if (
		input.mutationStatus === "committed" ||
		input.mutationStatus === "replayed"
	) {
		if (input.closureResult === "Abandoned") {
			return {
				closeCycleId: input.closeCycleId,
				closureResult: "Abandoned",
				serverAccepted: true,
				source: "abandoned",
				workId: input.workId,
			};
		}
		return {
			closeCycleId: input.closeCycleId,
			closureResult: "Completed",
			serverAccepted: true,
			source: "user-initiated-close",
			workId: input.workId,
		};
	}
	return {
		closeCycleId: input.closeCycleId,
		closureResult: input.closureResult,
		serverAccepted: false,
		source: FAILED_WRITE_SOURCE[input.mutationStatus],
		workId: input.workId,
	};
}

function isUserInitiatedWorkSuccess(event: CloseAcceptance): boolean {
	return (
		event.source === "user-initiated-close" &&
		event.serverAccepted &&
		event.closureResult === "Completed"
	);
}

export function decorativePlayAllowed(
	preference: Pick<CompletionEffectPreference, "enabled">,
	presentation: CompletionEffectsPresentation
): boolean {
	return (
		preference.enabled &&
		!presentation.reduceMotion &&
		presentation.drawingBudgetHeld
	);
}

export function observeCloseAcceptance(
	preference: Pick<CompletionEffectPreference, "enabled">,
	session: CompletionEffectsClientSession,
	event: CloseAcceptance,
	nowMs: number,
	presentation: CompletionEffectsPresentation = defaultCompletionEffectsPresentation
): {
	feedback: CompletionEffectsFeedback;
	session: CompletionEffectsClientSession;
} {
	if (!isUserInitiatedWorkSuccess(event)) {
		return { feedback: "none", session };
	}
	if (session.lastCloseCycleId === event.closeCycleId) {
		return { feedback: "none", session };
	}
	const waiting =
		session.decorativeWaitUntilMs !== null &&
		nowMs < session.decorativeWaitUntilMs;
	const playEffect =
		decorativePlayAllowed(preference, presentation) && !waiting;
	const next: CompletionEffectsClientSession = {
		decorativeWaitUntilMs: playEffect
			? nowMs + DECORATIVE_WAIT_MS
			: session.decorativeWaitUntilMs,
		feedback: playEffect ? "effect" : "base-notice",
		lastCloseCycleId: event.closeCycleId,
		notice: "Work completed",
		noticeUntilMs: nowMs + SUCCESS_NOTICE_MS,
		reopenConfirmationRequested: false,
		workStatus: "Closed",
	};
	return { feedback: next.feedback, session: next };
}

export function previewMotion(
	previewStartedAtMs: number | null,
	nowMs: number,
	reduceMotion = false
): "static" | "playing" {
	if (reduceMotion || previewStartedAtMs === null) {
		return "static";
	}
	if (nowMs - previewStartedAtMs >= PREVIEW_MOTION_MS) {
		return "static";
	}
	return "playing";
}

export function previewFallback(reduceMotion: boolean): PreviewFallback {
	return reduceMotion ? "static-last-frame" : "motion";
}

export function decorativeLayerVisible(
	session: CompletionEffectsClientSession,
	nowMs: number,
	presentation: CompletionEffectsPresentation
): boolean {
	if (!presentation.drawingBudgetHeld || presentation.reduceMotion) {
		return false;
	}
	if (session.feedback !== "effect" || session.decorativeWaitUntilMs === null) {
		return false;
	}
	const startedAtMs = session.decorativeWaitUntilMs - DECORATIVE_WAIT_MS;
	return nowMs >= startedAtMs && nowMs - startedAtMs < DECORATIVE_LAYER_MS;
}

export function visibleSuccessPresentation(
	session: CompletionEffectsClientSession,
	nowMs: number,
	presentation: CompletionEffectsPresentation
): {
	ariaLive: "polite";
	decorativeLayer: boolean;
	notice: boolean;
	reopen: boolean;
	stopControl: false;
} {
	const notice =
		session.notice !== null &&
		session.noticeUntilMs !== null &&
		nowMs < session.noticeUntilMs;
	return {
		ariaLive: "polite",
		decorativeLayer: decorativeLayerVisible(session, nowMs, presentation),
		notice,
		reopen: notice,
		stopControl: false,
	};
}

export function requestReopenFromNotice(
	session: CompletionEffectsClientSession
): CompletionEffectsClientSession {
	if (session.notice === null) {
		return session;
	}
	return { ...session, reopenConfirmationRequested: true };
}

export function clearPresentationOnSurfaceChange(
	session: CompletionEffectsClientSession
): CompletionEffectsClientSession {
	return {
		...session,
		feedback: "none",
		notice: null,
		noticeUntilMs: null,
		reopenConfirmationRequested: false,
	};
}

export function drawingBudgetHeld(frameGapMs: number): boolean {
	return frameGapMs <= DRAWING_FRAME_BUDGET_MS;
}

export const PALETTE_SWATCHES: Record<
	CompletionEffectTheme,
	Record<string, readonly [string, string, string, string]>
> = {
	Arc: {
		Gleam: ["#f4e8c1", "#e8c36a", "#f7f1dc", "#8a6a2a"],
		Halo: ["#f3edd4", "#d7c48a", "#fff8e7", "#6f5a32"],
		Span: ["#d5c6f2", "#8b6cc9", "#efe8fb", "#4c3878"],
		Trace: ["#bfe7ea", "#4aa7b0", "#e7f6f7", "#1f5d64"],
	},
	Calm: {
		Haze: ["#d7dde4", "#9aa7b4", "#eef1f4", "#5d6b78"],
		Linen: ["#efe6d9", "#d2c1a8", "#f7f2ea", "#7a6a55"],
		Moss: ["#d5e0d3", "#8fa88a", "#eef3ed", "#4f6750"],
		Pebble: ["#e4ddd4", "#b7aa9c", "#f3eee8", "#6e6358"],
	},
	Nova: {
		Ember: ["#f3c9a8", "#d46a3a", "#fbe8dc", "#7a3218"],
		Flare: ["#f6e7c2", "#e2b34a", "#fff6e3", "#7a5a14"],
		Orbit: ["#c5d4f5", "#4d6ec8", "#e8eefc", "#243a7a"],
		Pulse: ["#e4c0e8", "#b45bb8", "#f6e8f7", "#6a2d6e"],
	},
	Weave: {
		Cord: ["#edcfc0", "#c57a58", "#f8ebe4", "#6e3f2c"],
		Knot: ["#e0cce4", "#9a6aa3", "#f4eaf5", "#56365c"],
		Lattice: ["#c6e4dc", "#5ea392", "#e7f5f1", "#2f5e54"],
		Loom: ["#cfd6ee", "#6a78b8", "#eceef8", "#3a4470"],
	},
};

export function paletteSwatches(
	theme: CompletionEffectTheme,
	palette: string
): readonly [string, string, string, string] {
	const fallback: readonly [string, string, string, string] = [
		"#d7dde4",
		"#9aa7b4",
		"#eef1f4",
		"#5d6b78",
	];
	return PALETTE_SWATCHES[theme][palette] ?? fallback;
}
