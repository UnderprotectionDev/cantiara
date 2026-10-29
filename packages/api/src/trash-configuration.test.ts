import { describe, expect, test } from "vitest";

import { customFieldValueStillMeaningful } from "./trash-configuration";

describe("Configuration Trash meaning rule", () => {
  const field = { options: ["S", "M"], type: "Single select" };

  test("a default stays meaningful while type and option still exist", () => {
    expect(
      customFieldValueStillMeaningful(field, { kind: "option", option: "M" }),
    ).toBe(true);
  });

  test("a removed option or changed type means the default changed meaning", () => {
    expect(
      customFieldValueStillMeaningful(field, { kind: "option", option: "XL" }),
    ).toBe(false);
    expect(
      customFieldValueStillMeaningful(
        { options: [], type: "Text" },
        { kind: "option", option: "M" },
      ),
    ).toBe(false);
    expect(
      customFieldValueStillMeaningful(
        { options: ["S"], type: "Multi select" },
        { kind: "options", options: ["S", "M"] },
      ),
    ).toBe(false);
  });
});
