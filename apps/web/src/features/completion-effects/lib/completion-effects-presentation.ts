import type {
  CompletionEffectPalette,
  CompletionEffectTheme,
} from "@cantiara/api/completion-effects";

export const COMPLETION_EFFECT_THEME_DESCRIPTIONS = {
  Calm: "Soft forms settle into a quiet finish.",
  Weave: "Crossing lines gather and release.",
  Arc: "Open curves draw a brief path of light.",
  Nova: "Small points gather into a short burst.",
} satisfies Record<CompletionEffectTheme, string>;

export const COMPLETION_EFFECT_MOTION_DESCRIPTIONS = {
  Calm: "Soft shapes drift upward and settle.",
  Weave: "Lines trace across one another and release.",
  Arc: "Curves sweep once around the center.",
  Nova: "Small points gather and gently spread.",
} satisfies Record<CompletionEffectTheme, string>;

export const COMPLETION_EFFECT_PALETTE_COLORS = {
  Haze: ["#93A6A6", "#C5C9C2", "#DCD4C7", "#6E8587"],
  Pebble: ["#8A8176", "#B4A99A", "#D7CFC2", "#5F6667"],
  Linen: ["#B99873", "#D5C0A1", "#ECE2D1", "#887C6B"],
  Moss: ["#71856B", "#A2B096", "#D0D4BD", "#556D62"],
  Loom: ["#9D6F58", "#C99A6E", "#647E83", "#D4C4AA"],
  Cord: ["#A96D5C", "#CEAA7D", "#72817E", "#625E59"],
  Lattice: ["#687F8E", "#B98570", "#BBC0B3", "#D4C6AF"],
  Knot: ["#8E7768", "#A3A58C", "#C6A77F", "#62786F"],
  Gleam: ["#D8AD5C", "#CD765F", "#7D9E9A", "#657C8D"],
  Trace: ["#759391", "#BD8D72", "#77869B", "#D3C1A5"],
  Halo: ["#D1B77D", "#E6D6BE", "#A88D9A", "#74969C"],
  Span: ["#637E90", "#C28F70", "#9A9C7E", "#D0BFA2"],
  Ember: ["#C96143", "#D99C57", "#796C66", "#BA8872"],
  Pulse: ["#C66C61", "#8C6D91", "#93AAA0", "#D7B36A"],
  Orbit: ["#657C98", "#B28E6D", "#7EA198", "#C2A5AB"],
  Flare: ["#D98237", "#C65745", "#718F93", "#9D8BA7"],
} satisfies Record<
  CompletionEffectPalette,
  readonly [string, string, string, string]
>;

export const COMPLETION_EFFECT_DURATION_MS = 1200;
export const COMPLETION_EFFECT_PREVIEW_DURATION_MS =
  COMPLETION_EFFECT_DURATION_MS;
export const COMPLETION_EFFECT_CLIENT_WAIT_MS = 30_000;
export const COMPLETION_EFFECT_MAX_FRAME_INTERVAL_MS = 50;
export const COMPLETION_EFFECT_SLOW_FRAME_COUNT = 2;
export const WORK_COMPLETED_NOTICE_DURATION_MS = 10_000;
