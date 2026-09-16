import type { Appearance } from "@cantiara/api/account-preferences";
import { describe, expect, test } from "vitest";

import { themeForAppearance } from "./theme-provider";

describe("Account Appearance adapter", () => {
  test("maps saved Account Appearance values to shell themes", () => {
    expect(themeForAppearance("Light")).toBe("light");
    expect(themeForAppearance("Dark")).toBe("dark");
  });

  test("does not treat System as an Account Appearance", () => {
    expect(() => themeForAppearance("System" as unknown as Appearance)).toThrow(
      "Unsupported Account Appearance.",
    );
  });
});
