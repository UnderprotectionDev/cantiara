import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { env } from "@/env";

import {
  type CommandPaletteCommand,
  type CommandPaletteCommandSource,
  type CommandPaletteRecord,
  CommandPaletteUnavailableError,
} from "./components/command-palette-commands";

export type CommandPaletteProviderSource = CommandPaletteCommandSource;

type ProjectsNavigation = (destination: "/projects") => void;

export function createEmptyCommandPaletteSource(): CommandPaletteProviderSource {
  return {
    authorizedProjects: [],
    authorizedRecords: [],
    commands: [],
    createOptions: [],
  };
}

function createReferenceProjects() {
  return Array.from({ length: 25 }, (_, index) => ({
    authorized: true,
    id: `project-${String(index + 1).padStart(2, "0")}`,
    name: `Reference Project ${String(index + 1).padStart(2, "0")}`,
    visibleCounterpart: "Projects menu",
  }));
}

interface ReferenceRecordCollection extends Iterable<CommandPaletteRecord> {
  readonly length: number;
}

function createReferenceRecords(): ReferenceRecordCollection {
  const workCount = 10_000;
  const documentCount = 5000;

  return {
    *[Symbol.iterator]() {
      for (let index = 0; index < workCount; index += 1) {
        yield {
          authorized: true,
          id: `work-${String(index).padStart(5, "0")}`,
          scope: "Project: Reference Project 01",
          title: `Reference Work ${String(index).padStart(5, "0")}`,
          type: "Work",
          visibleCounterpart: "Work menu",
        };
      }

      for (let index = 0; index < documentCount; index += 1) {
        yield {
          authorized: true,
          id: `document-${String(index).padStart(5, "0")}`,
          scope: "Project: Reference Project 01",
          title: `Reference Document ${String(index).padStart(5, "0")}`,
          type: "Document",
          visibleCounterpart: "Documents menu",
        };
      }
    },
    length: workCount + documentCount,
  };
}

function createUnsupportedReferenceCommand(): CommandPaletteCommand {
  return {
    id: "unsupported-reference-command",
    kind: "common",
    label: "Unsupported reference command",
    run: () => {
      throw new CommandPaletteUnavailableError("Unsupported reference command");
    },
    scope: "Workspace",
    selectionCount: 0,
    shortcut: "Enter",
    target: "Reference fixture",
    visibleCounterpart: "Reference menu",
  };
}

export function createReferenceCommandPaletteSource(
  navigate: ProjectsNavigation,
): CommandPaletteProviderSource {
  return {
    authorizedProjects: createReferenceProjects(),
    authorizedRecords: createReferenceRecords(),
    commands: [createUnsupportedReferenceCommand()],
    createOptions: [
      {
        authorized: true,
        id: "work",
        label: "Work",
        scope: "Project",
        target: "New Work",
        visibleCounterpart: "Create menu",
      },
      {
        authorized: true,
        id: "document",
        label: "Document",
        scope: "Project",
        target: "New Document",
        visibleCounterpart: "Create menu",
      },
    ],
    onCreate: () => navigate("/projects"),
    onOpenRecord: () => navigate("/projects"),
    onSwitchProject: () => navigate("/projects"),
  };
}

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
