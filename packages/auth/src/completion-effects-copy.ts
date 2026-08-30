export const COMPLETION_EFFECTS_COPY = {
	arc: "Arc",
	calm: "Calm",
	enable: "Enable",
	experimental: "Experimental",
	heading: "Completion effects",
	loading: "Loading completion effects…",
	nova: "Nova",
	palette: "Palette",
	preview: "Preview",
	saved: "Completion effects saved.",
	theme: "Theme",
	unavailable: "Completion effects are unavailable.",
	weave: "Weave",
} as const;

export function completionEffectsChrome() {
	return COMPLETION_EFFECTS_COPY;
}
