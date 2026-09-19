import { useSelector } from "@tanstack/react-store";
import { createContext, useContext } from "react";

import type { ClientShell, ClientShellState } from "../store/client-shell";

export const ClientShellContext = createContext<ClientShell | null>(null);

export function useClientShell() {
  const shell = useContext(ClientShellContext);
  if (!shell) {
    throw new Error("ClientShellProvider is required.");
  }
  return shell;
}

export function useClientShellState(): ClientShellState {
  return useSelector(useClientShell());
}

export function useClientShellConnection() {
  return useClientShellState().connection;
}
