// @vitest-environment happy-dom
import type { Appearance } from "@cantiara/api/account-preferences";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test } from "vitest";

import { ThemeProvider, themeForAppearance } from "../theme-provider";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

  test("marks the document with only the saved Appearance so canvases do not follow the OS", () => {
    const root = createRoot(document.createElement("div"));
    const classes = document.documentElement.classList;

    act(() => {
      root.render(<ThemeProvider defaultTheme="light">{null}</ThemeProvider>);
    });
    expect(classes.contains("light")).toBe(true);
    expect(classes.contains("dark")).toBe(false);

    act(() => {
      root.render(<ThemeProvider defaultTheme="dark">{null}</ThemeProvider>);
    });
    expect(classes.contains("dark")).toBe(true);
    expect(classes.contains("light")).toBe(false);

    act(() => root.unmount());
  });
});
