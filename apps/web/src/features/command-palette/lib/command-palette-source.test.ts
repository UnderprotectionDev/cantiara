import { describe, expect, test, vi } from "vitest";
import {
  buildCommandPaletteCommands,
  buildCommandPaletteRecordCommands,
} from "./command-palette-commands";
import {
  createEmptyCommandPaletteSource,
  createReferenceCommandPaletteSource,
} from "./command-palette-source";

describe("Command Palette application adapters", () => {
  test("keeps the current shell honest when domain adapters are unavailable", () => {
    const source = createEmptyCommandPaletteSource();

    expect(source.authorizedProjects).toEqual([]);
    expect(source.authorizedRecords).toEqual([]);
    expect(source.createOptions).toEqual([]);
    expect(source.commands).toEqual([]);
  });

  test("provides the reference workspace through one authorized source", async () => {
    const navigate = vi.fn();
    const source = createReferenceCommandPaletteSource(navigate);
    const commands = buildCommandPaletteCommands(source);

    expect(source.authorizedProjects).toHaveLength(25);
    expect(source.authorizedRecords).toHaveLength(15_000);
    expect(source.createOptions).toHaveLength(2);
    expect(commands).toHaveLength(15_003);

    const record = commands.find(
      (command) => command.id === "open-record-work-09999",
    );
    if (!record) {
      throw new Error("Expected a reference Work command.");
    }

    await record.run();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  test("materializes only the bounded authorized record page", () => {
    const source = createReferenceCommandPaletteSource(vi.fn());
    const commands = buildCommandPaletteRecordCommands(
      source.authorizedRecords,
      vi.fn(),
      "",
    );

    expect(commands).toHaveLength(50);
    expect(commands[0]?.id).toBe("open-record-work-00000");
    expect(commands.at(-1)?.id).toBe("open-record-work-00049");
  });

  test("does not materialize an unauthorized record from the lazy source", () => {
    const commands = buildCommandPaletteRecordCommands(
      [
        {
          authorized: false,
          id: "hidden-work",
          scope: "Project: Other Workspace",
          title: "Hidden Work",
          type: "Work",
          visibleCounterpart: "Work menu",
        },
        {
          authorized: true,
          id: "visible-work",
          scope: "Project: Cantiara",
          title: "Visible Work",
          type: "Work",
          visibleCounterpart: "Work menu",
        },
      ],
      vi.fn(),
      "Hidden Work",
    );

    expect(commands).toEqual([]);
  });
});
