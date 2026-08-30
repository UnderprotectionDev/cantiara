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

export const COMPLETION_EFFECT_THEME_COPY = {
	Arc: COMPLETION_EFFECTS_COPY.arc,
	Calm: COMPLETION_EFFECTS_COPY.calm,
	Nova: COMPLETION_EFFECTS_COPY.nova,
	Weave: COMPLETION_EFFECTS_COPY.weave,
} as const;

export const COMPLETION_EFFECT_PALETTE_COPY = {
	Cord: "Cord",
	Ember: "Ember",
	Flare: "Flare",
	Gleam: "Gleam",
	Halo: "Halo",
	Haze: "Haze",
	Knot: "Knot",
	Lattice: "Lattice",
	Linen: "Linen",
	Loom: "Loom",
	Moss: "Moss",
	Orbit: "Orbit",
	Pebble: "Pebble",
	Pulse: "Pulse",
	Span: "Span",
	Trace: "Trace",
} as const;

export function completionEffectsChrome() {
	return COMPLETION_EFFECTS_COPY;
}
