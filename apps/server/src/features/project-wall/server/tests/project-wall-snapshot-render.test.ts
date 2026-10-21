import type { ProjectWallSnapshotData } from "@cantiara/api/project-wall-presentation";
import { describe, expect, test } from "vitest";

import { projectWallSnapshotHtml } from "../project-wall-snapshot-render";

const DATA: ProjectWallSnapshotData = {
  cards: [
    {
      highlight: "blue",
      kindLabel: "Work",
      lines: ["Key: CAN-1", "Status: <In Progress>"],
      title: "Ship <onboarding>",
      x: 0,
      y: 0,
    },
    {
      highlight: null,
      kindLabel: "Decision",
      lines: [],
      title: "Use a flat wall",
      x: 600,
      y: 300,
    },
  ],
  generatedAt: "2026-02-01T10:00:00.000Z",
  generatedOn: "2026-02-01",
  links: [{ from: 0, label: "blocks", to: 1 }],
  moment: "Story - Region of 2 cards as of 2026-02-01",
  scopeLabel: "Region of 2 cards",
};

const LIVE_LINK = /<a[\s>]|href=|<script|https?:|\/projects\//i;

describe("Project Wall snapshot HTML", () => {
  test("is static: no anchor, URL, script or source path", () => {
    const html = projectWallSnapshotHtml(DATA);
    expect(html).not.toMatch(LIVE_LINK);
    expect(html).toContain("default-src 'none'");
  });

  test("escapes text, lays out both cards and draws the Visual link", () => {
    const html = projectWallSnapshotHtml(DATA);
    expect(html).toContain("Ship &lt;onboarding&gt;");
    expect(html).toContain("Status: &lt;In Progress&gt;");
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain("blocks");
    expect(html).toContain("Frozen copy");
  });
});
