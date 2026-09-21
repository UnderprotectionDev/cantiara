import type { WorkContextModel } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { describe, expect, test, vi } from "vitest";

import {
  COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID,
  copyWorkContextAsMarkdown,
  createCopyContextAsMarkdownCommand,
} from "./work-context-markdown";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: "Make checkout easier to understand.",
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  title: "Improve checkout clarity",
  type: "Improvement",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const model: WorkContextModel = {
  sources: [],
  whyChain: [],
};

describe("Work Context Card Markdown action", () => {
  test("writes the generated Markdown through the clipboard boundary", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    const markdown = await copyWorkContextAsMarkdown({
      model,
      now: () => "2026-01-01T12:00:00.000Z",
      statusLabel: "Doing",
      work,
      writeText,
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(markdown);
    expect(markdown).toContain("- Produced at: 2026-01-01T12:00:00.000Z");
    expect(markdown).toContain("- Primary source is in the app");
  });

  test("exposes the same copy action as a Command Palette command", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const command = createCopyContextAsMarkdownCommand({
      model,
      now: () => "2026-01-01T12:00:00.000Z",
      statusLabel: "Doing",
      work,
      writeText,
    });

    expect(command).toMatchObject({
      id: COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID,
      label: "Copy Context as Markdown",
      scope: "Work: PAY-1",
      target: "PAY-1 Improve checkout clarity",
      visibleCounterpart: "Work Context Card",
    });

    await command.run();
    expect(writeText).toHaveBeenCalledOnce();
  });
});
