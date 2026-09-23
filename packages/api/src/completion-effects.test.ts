import { describe, expect, test } from "vitest";

import {
  COMPLETION_EFFECT_CATALOG,
  completionEffectsPreferencesSchema,
  DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
} from "./completion-effects";

describe("Completion Effects API contract", () => {
  test("starts disabled with the quiet catalog selection", () => {
    expect(DEFAULT_COMPLETION_EFFECTS_PREFERENCES).toEqual({
      enabled: false,
      palette: "Haze",
      theme: "Calm",
    });
  });

  test("has exactly four named palettes for each closed theme", () => {
    expect(Object.keys(COMPLETION_EFFECT_CATALOG)).toEqual([
      "Calm",
      "Weave",
      "Arc",
      "Nova",
    ]);
    expect(COMPLETION_EFFECT_CATALOG).toEqual({
      Calm: ["Haze", "Pebble", "Linen", "Moss"],
      Weave: ["Loom", "Cord", "Lattice", "Knot"],
      Arc: ["Gleam", "Trace", "Halo", "Span"],
      Nova: ["Ember", "Pulse", "Orbit", "Flare"],
    });
    for (const palettes of Object.values(COMPLETION_EFFECT_CATALOG)) {
      expect(palettes).toHaveLength(4);
    }
  });

  test("rejects unknown names and palettes that belong to another theme", () => {
    expect(
      completionEffectsPreferencesSchema.safeParse({
        enabled: true,
        palette: "Unlisted",
        theme: "Calm",
      }).success,
    ).toBe(false);
    expect(
      completionEffectsPreferencesSchema.safeParse({
        enabled: true,
        palette: "Loom",
        theme: "Calm",
      }).success,
    ).toBe(false);
    expect(
      completionEffectsPreferencesSchema.safeParse({
        enabled: true,
        palette: "Haze",
        theme: "Moodboard",
      }).success,
    ).toBe(false);
  });

  test("accepts every named theme and matching palette", () => {
    for (const [theme, palettes] of Object.entries(COMPLETION_EFFECT_CATALOG)) {
      for (const palette of palettes) {
        expect(
          completionEffectsPreferencesSchema.safeParse({
            enabled: true,
            palette,
            theme,
          }).success,
        ).toBe(true);
      }
    }
  });
});
