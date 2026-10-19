import type {
  UserFlowNodeKind,
  UserFlowNodeTone,
} from "@cantiara/api/user-flow";

/**
 * Fixed palette of the limited node style. Background and foreground are
 * always set together (independent of the app theme) so the text contrast holds
 * in light and dark. A tone is decoration: the card also prints the tone name
 * and always the node `kind`, so colour is never the only carrier of meaning.
 */
export interface ToneColors {
  background: string;
  border: string;
  foreground: string;
}

export const TONE_COLORS: Record<UserFlowNodeTone, ToneColors> = {
  amber: { background: "#fef3c7", border: "#b45309", foreground: "#78350f" },
  blue: { background: "#dbeafe", border: "#1d4ed8", foreground: "#1e3a8a" },
  default: { background: "#ffffff", border: "#6b7280", foreground: "#1f2937" },
  green: { background: "#dcfce7", border: "#15803d", foreground: "#14532d" },
  red: { background: "#fee2e2", border: "#b91c1c", foreground: "#7f1d1d" },
  violet: { background: "#ede9fe", border: "#6d28d9", foreground: "#4c1d95" },
};

export const MIN_TEXT_CONTRAST = 4.5;

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.039_28 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
    channel(Number.parseInt(hex.slice(start, start + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/**
 * Card corner radius per kind. The shape is derived from `kind` alone; there
 * is no stored shape, so a shape can never act as a second type system.
 */
export const KIND_RADIUS: Record<UserFlowNodeKind, string> = {
  Action: "0.5rem",
  Decision: "1.5rem",
  Screen: "0.25rem",
  Section: "0",
  "State/Outcome": "2.5rem",
};
