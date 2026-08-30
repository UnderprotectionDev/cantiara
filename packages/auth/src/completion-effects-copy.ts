export const COMPLETION_EFFECTS_COPY = {
	arc: "Arc",
	arcMotion: "Arc holds as a light trail in the last frame.",
	calm: "Calm",
	calmMotion: "Calm settles as quiet marks in the last frame.",
	enable: "Enable",
	experimental: "Experimental",
	heading: "Completion effects",
	loading: "Loading completion effects…",
	nova: "Nova",
	novaMotion: "Nova holds as a still burst in the last frame.",
	palette: "Palette",
	preview: "Preview",
	reopen: "Reopen",
	saved: "Completion effects saved.",
	theme: "Theme",
	unavailable: "Completion effects are unavailable.",
	weave: "Weave",
	weaveMotion: "Weave rests as bound strands in the last frame.",
	workCompleted: "Work completed",
} as const;

export const COMPLETION_EFFECT_THEME_COPY = {
	Arc: COMPLETION_EFFECTS_COPY.arc,
	Calm: COMPLETION_EFFECTS_COPY.calm,
	Nova: COMPLETION_EFFECTS_COPY.nova,
	Weave: COMPLETION_EFFECTS_COPY.weave,
} as const;

export const COMPLETION_EFFECT_THEME_MOTION_COPY = {
	Arc: COMPLETION_EFFECTS_COPY.arcMotion,
	Calm: COMPLETION_EFFECTS_COPY.calmMotion,
	Nova: COMPLETION_EFFECTS_COPY.novaMotion,
	Weave: COMPLETION_EFFECTS_COPY.weaveMotion,
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
