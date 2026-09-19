import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  buildCommandPaletteCommands,
  COMMAND_PALETTE_COMMAND_SHORTCUT,
  executeCommand,
  filterAndLimitCommandPaletteCommands,
} from "../../lib/command-palette-commands";
import CommandPalette from "./command-palette";

const visibleRecord = {
  authorized: true,
  id: "work-visible",
  scope: "Project: Cantiara",
  title: "Ship the launch",
  type: "Work",
  visibleCounterpart: "Work menu",
};

const hiddenRecord = {
  authorized: false,
  id: "work-hidden",
  scope: "Project: Other Workspace",
  title: "Hidden launch plan",
  type: "Work",
  visibleCounterpart: "Work menu",
};

function ignoreOpenChange(_open: boolean) {
  // The server-rendered dialog does not need to update its controlled state.
}

describe("Command Palette command interface", () => {
  test("can defer authorized record command materialization", () => {
    const records = {
      [Symbol.iterator]() {
        throw new Error("Authorized records must stay lazy.");
      },
    };

    const commands = buildCommandPaletteCommands(
      { authorizedRecords: records },
      { includeAuthorizedRecords: false },
    );

    expect(commands.some((command) => command.kind === "open-record")).toBe(
      false,
    );
  });

  test("only exposes authorized records and projects with preview metadata", () => {
    const commands = buildCommandPaletteCommands({
      authorizedProjects: [
        {
          authorized: true,
          id: "project-visible",
          name: "Cantiara",
          visibleCounterpart: "Projects menu",
        },
        {
          authorized: false,
          id: "project-hidden",
          name: "Other Workspace",
          visibleCounterpart: "Projects menu",
        },
      ],
      authorizedRecords: [visibleRecord, hiddenRecord],
      createOptions: [
        {
          id: "work",
          label: "Work",
          scope: "Project",
          target: "New Work",
          visibleCounterpart: "Create menu",
        },
      ],
    });

    const recordCommand = commands.find(
      (command) => command.id === "open-record-work-visible",
    );
    const projectCommand = commands.find(
      (command) => command.id === "switch-project",
    );

    expect(recordCommand).toMatchObject({
      label: "Ship the launch",
      scope: "Project: Cantiara",
      selectionCount: 1,
      shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
      target: "Ship the launch",
      visibleCounterpart: "Work menu",
    });
    expect(
      commands.some((command) => command.id === "open-record-work-hidden"),
    ).toBe(false);
    expect(projectCommand).toMatchObject({
      label: "Switch Project",
      selectionCount: 1,
      target: "Cantiara",
      visibleCounterpart: "Projects menu",
    });

    for (const command of commands) {
      expect(command.visibleCounterpart).not.toBe("");
      expect(command.shortcut).toBe(COMMAND_PALETTE_COMMAND_SHORTCUT);
    }
  });

  test("filters commands without making an inaccessible record searchable", () => {
    const commands = buildCommandPaletteCommands({
      commands: [
        {
          children: [
            {
              authorized: false,
              id: "private-child-command",
              label: "Private child action",
              run: () => undefined,
              scope: "Other Workspace",
              selectionCount: 1,
              shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
              target: "Private record",
              visibleCounterpart: "Private menu",
            },
          ],
          id: "private-command",
          label: "Workspace actions",
          run: () => undefined,
          scope: "Workspace",
          selectionCount: 1,
          shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
          target: "Workspace",
          visibleCounterpart: "Workspace menu",
        },
      ],
      authorizedRecords: [visibleRecord, hiddenRecord],
    });

    const privateCommand = commands.find(
      (command) => command.id === "private-command",
    );
    expect(privateCommand?.children).toBeUndefined();
    expect(
      commands.some((command) => command.id === "open-record-work-visible"),
    ).toBe(true);
  });

  test("fails a command group with no authorized targets without writing", () => {
    const write = vi.fn();
    const commands = buildCommandPaletteCommands({
      commands: [
        {
          children: [
            {
              authorized: false,
              id: "private-child-command",
              label: "Private child action",
              run: write,
              scope: "Other Workspace",
              selectionCount: 1,
              shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
              target: "Private record",
              visibleCounterpart: "Private menu",
            },
          ],
          id: "workspace-actions",
          label: "Workspace actions",
          run: write,
          scope: "Workspace",
          selectionCount: 1,
          shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
          target: "Workspace",
          visibleCounterpart: "Workspace menu",
        },
      ],
    });
    const workspaceActions = commands.find(
      (command) => command.id === "workspace-actions",
    );

    if (!workspaceActions) {
      throw new Error("Expected the workspace action command.");
    }

    expect(workspaceActions.children).toBeUndefined();
    expect(() => executeCommand(workspaceActions)).toThrow(
      "Workspace actions is unavailable in this context.",
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("hands authorized record, project, and create targets to their adapters", async () => {
    const onCreate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onOpenRecord = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    const onSwitchProject = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    const commands = buildCommandPaletteCommands({
      authorizedProjects: [
        {
          id: "project-visible",
          name: "Cantiara",
          visibleCounterpart: "Projects menu",
        },
      ],
      authorizedRecords: [visibleRecord],
      createOptions: [
        {
          id: "work",
          label: "Work",
          scope: "Project",
          target: "New Work",
          visibleCounterpart: "Create menu",
        },
      ],
      onCreate: () => onCreate(),
      onOpenRecord: () => onOpenRecord(),
      onSwitchProject: () => onSwitchProject(),
    });

    const switchProject = commands.find(
      (command) => command.id === "switch-project",
    );
    const create = commands.find((command) => command.id === "create");
    const record = commands.find(
      (command) => command.id === "open-record-work-visible",
    );
    if (!(switchProject && create && record)) {
      throw new Error("Expected all built-in command targets.");
    }

    await executeCommand(switchProject.children?.[0] ?? switchProject);
    await executeCommand(create.children?.[0] ?? create);
    await executeCommand(record);

    expect(onSwitchProject).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onOpenRecord).toHaveBeenCalledTimes(1);
  });

  test("reports an unavailable command instead of silently doing nothing", () => {
    const commands = buildCommandPaletteCommands();
    const create = commands.find((command) => command.id === "create");
    if (!create) {
      throw new Error("Expected the Create command.");
    }

    expect(() => executeCommand(create)).toThrow(
      "Create is unavailable in this context.",
    );
  });

  test("routes reversible commands through the Mutation Contract adapter", async () => {
    const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const execute = vi.fn(
      async ({
        run: mutation,
      }: {
        commandId: string;
        run: () => void | Promise<void>;
      }) => mutation(),
    );
    const command = {
      id: "reversible-command",
      label: "Reversible command",
      reversible: true,
      run,
      scope: "Workspace",
      selectionCount: 1,
      shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
      target: "Selected record",
      visibleCounterpart: "Record menu",
    } as const;

    await executeCommand(command, { execute });

    expect(execute).toHaveBeenCalledWith({
      commandId: "reversible-command",
      run,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("renders the palette title without naming it Search", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={buildCommandPaletteCommands({
          authorizedRecords: [visibleRecord],
        })}
        onOpenChange={ignoreOpenChange}
        open
      />,
    );

    expect(html).toContain("Command Palette");
    expect(html).not.toContain(">Search</");
  });

  test("filters before rendering and caps the mounted command list", () => {
    const records = Array.from({ length: 15_000 }, (_, index) => ({
      authorized: true,
      id: `record-${index}`,
      scope: "Project: Cantiara",
      title: `Reference Work ${String(index).padStart(5, "0")}`,
      type: "Work",
      visibleCounterpart: "Work menu",
    }));

    const commands = filterAndLimitCommandPaletteCommands(
      buildCommandPaletteCommands({ authorizedRecords: records }),
      "Reference Work 14999",
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]?.label).toBe("Reference Work 14999");

    const emptyQueryCommands = filterAndLimitCommandPaletteCommands(
      buildCommandPaletteCommands({ authorizedRecords: records }),
      "",
    );
    expect(emptyQueryCommands).toHaveLength(50);
  });
});
