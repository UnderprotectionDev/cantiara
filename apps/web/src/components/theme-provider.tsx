import type { Appearance } from "@cantiara/api/account-preferences";
import { createStore, useSelector } from "@tanstack/react-store";
import type * as React from "react";
import { createContext, useContext, useEffect, useMemo } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  setTheme: (theme: Theme) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStore = createStore<Theme>("dark");

export function themeForAppearance(appearance: Appearance): Theme {
  switch (appearance) {
    case "Light":
      return "light";
    case "Dark":
      return "dark";
    default:
      throw new RangeError("Unsupported Account Appearance.");
  }
}

function setTheme(theme: Theme) {
  themeStore.setState(() => theme);
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const theme = useSelector(themeStore);

  useEffect(() => {
    themeStore.setState(() => defaultTheme);
  }, [defaultTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    // React Flow 13 follows the OS color scheme unless an ancestor has
    // `.light` or `.dark`, so mark Light too to keep the saved Appearance.
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  const value = useMemo(() => ({ setTheme, theme }), [theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return value;
}
