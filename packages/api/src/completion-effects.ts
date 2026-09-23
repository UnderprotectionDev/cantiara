import { z } from "zod";

export const COMPLETION_EFFECT_CATALOG = {
  Calm: ["Haze", "Pebble", "Linen", "Moss"],
  Weave: ["Loom", "Cord", "Lattice", "Knot"],
  Arc: ["Gleam", "Trace", "Halo", "Span"],
  Nova: ["Ember", "Pulse", "Orbit", "Flare"],
} as const;

export type CompletionEffectTheme = keyof typeof COMPLETION_EFFECT_CATALOG;
export type CompletionEffectPalette =
  (typeof COMPLETION_EFFECT_CATALOG)[CompletionEffectTheme][number];

const completionEffectThemes = Object.keys(COMPLETION_EFFECT_CATALOG) as [
  CompletionEffectTheme,
  ...CompletionEffectTheme[],
];
const completionEffectPalettes = Object.values(
  COMPLETION_EFFECT_CATALOG,
).flat() as [CompletionEffectPalette, ...CompletionEffectPalette[]];

export const completionEffectThemeSchema = z.enum(completionEffectThemes);
export const completionEffectPaletteSchema = z.enum(completionEffectPalettes);

export const completionEffectsPreferencesSchema = z
  .object({
    enabled: z.boolean(),
    palette: completionEffectPaletteSchema,
    theme: completionEffectThemeSchema,
  })
  .strict()
  .superRefine(({ palette, theme }, context) => {
    const allowedPalettes: readonly string[] = COMPLETION_EFFECT_CATALOG[theme];
    if (!allowedPalettes.includes(palette)) {
      context.addIssue({
        code: "custom",
        message: `Palette must belong to ${theme}.`,
        path: ["palette"],
      });
    }
  });

export const DEFAULT_COMPLETION_EFFECTS_PREFERENCES = {
  enabled: false,
  palette: "Haze",
  theme: "Calm",
} as const satisfies CompletionEffectsPreferences;

export type CompletionEffectsPreferences = z.infer<
  typeof completionEffectsPreferencesSchema
>;

export interface CompletionEffectsPreferencesSnapshot
  extends CompletionEffectsPreferences {
  isSaved: boolean;
  revision: number;
  savedAt: string | null;
}

export interface CompletionEffectsPreferencesAccess {
  get: (accountId: string) => Promise<CompletionEffectsPreferencesSnapshot>;
}
