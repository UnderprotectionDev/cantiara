import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { env } from "@/env";

import {
  type CommandPaletteProviderSource,
  createEmptyCommandPaletteSource,
  createReferenceCommandPaletteSource,
} from "../lib/command-palette-source";

export type { CommandPaletteProviderSource } from "../lib/command-palette-source";

export function useFounderCommandPaletteSource(): CommandPaletteProviderSource {
  const navigate = useNavigate();

  return useMemo(() => {
    if (env.VITE_COMMAND_PALETTE_E2E_FIXTURE === "reference") {
      return createReferenceCommandPaletteSource((destination) =>
        navigate({ to: destination }),
      );
    }

    return createEmptyCommandPaletteSource();
  }, [navigate]);
}
