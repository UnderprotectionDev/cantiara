import { describe, expect, test } from "vitest";

import {
  diagramGroups,
  hiddenDiagramNodeIds,
  neutralDiagramView,
  resolveTechnicalDiagramViewport,
  technicalDiagramViewportSchema,
} from "./technical-diagram-viewport";

const FRAME = { height: 400, width: 800 };
const model = {
  links: [
    { from: "b", kind: "Contains" as const, label: null, to: "api" },
    { from: "b", kind: "Contains" as const, label: null, to: "inner" },
    { from: "inner", kind: "Contains" as const, label: null, to: "db" },
  ],
  nodes: [
    { id: "b", kind: "Boundary" as const, label: "Backend" },
    { id: "inner", kind: "Boundary" as const, label: "Inner" },
    { id: "api", kind: "Service" as const, label: "API" },
    { id: "db", kind: "Datastore" as const, label: "DB" },
    { id: "ext", kind: "External System" as const, label: "Ext" },
  ],
};
const groups = diagramGroups(model);
const content = {
  groups,
  nodes: [
    { id: "b", position: { x: 0, y: 0 } },
    { id: "api", position: { x: 50, y: 50 } },
    { id: "db", position: { x: 2000, y: 0 } },
    { id: "ext", position: { x: 5000, y: 5000 } },
  ],
};

describe("Technical Diagram personal viewport", () => {
  test("a Boundary is a group whose members include nested ones", () => {
    expect(groups.find(({ id }) => id === "b")?.memberIds.sort()).toEqual([
      "api",
      "db",
      "inner",
    ]);
    expect([...hiddenDiagramNodeIds(groups, ["inner"])]).toEqual(["db"]);
  });

  test("restores a saved position that still shows a node", () => {
    const saved = { center: { x: 100, y: 50 }, collapsed: [], zoom: 1 };
    expect(
      resolveTechnicalDiagramViewport({ content, frame: FRAME, saved }),
    ).toEqual({
      collapsed: [],
      mode: "restore",
      viewport: { center: saved.center, zoom: 1 },
    });
  });

  test("nothing saved, an empty region or an empty diagram fits", () => {
    expect(
      resolveTechnicalDiagramViewport({ content, frame: FRAME, saved: null }),
    ).toEqual({ collapsed: [], mode: "fit" });
    const away = { center: { x: 900, y: 900 }, collapsed: [], zoom: 1 };
    expect(
      resolveTechnicalDiagramViewport({ content, frame: FRAME, saved: away })
        .mode,
    ).toBe("fit");
    expect(
      resolveTechnicalDiagramViewport({
        content: { groups: [], nodes: [] },
        frame: FRAME,
        saved: { center: { x: 0, y: 0 }, collapsed: [], zoom: 1 },
      }).mode,
    ).toBe("fit");
  });

  test("nodes hidden by a collapse do not make a position meaningful; deleted groups are dropped", () => {
    const saved = {
      center: { x: 2000, y: 0 },
      collapsed: ["b", "deleted"],
      zoom: 1,
    };
    expect(
      resolveTechnicalDiagramViewport({ content, frame: FRAME, saved }),
    ).toEqual({ collapsed: ["b"], mode: "fit" });
  });

  test("Fit view is neutral and expands every collapsed group", () => {
    expect(neutralDiagramView()).toEqual({ collapsed: [], mode: "fit" });
  });

  test("the viewport holds only center, zoom and collapse", () => {
    expect(
      technicalDiagramViewportSchema.safeParse({
        center: { x: 0, y: 0 },
        selection: ["a"],
        zoom: 1,
      }).success,
    ).toBe(false);
    expect(
      technicalDiagramViewportSchema.safeParse({
        center: { x: 0, y: 0 },
        zoom: 99,
      }).success,
    ).toBe(false);
  });
});
