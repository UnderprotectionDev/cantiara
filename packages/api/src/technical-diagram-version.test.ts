import { describe, expect, test } from "vitest";

import {
  assertVersionBind,
  createCheckpoint,
  createDiagramVersionInputSchema,
  DIAGRAM_VERSION_LABELS,
  DiagramVersionError,
  diagramVersionReference,
  restoreDiagramVersionInputSchema,
  restoreFromCheckpoint,
  type VersionedDiagram,
} from "./technical-diagram-version";

const live = (overrides: Partial<VersionedDiagram> = {}): VersionedDiagram => ({
  authorityMode: "Product-authored Model",
  id: "arch",
  model: {
    links: [],
    nodes: [{ id: "api", kind: "Service", label: "API" }],
  },
  revision: 3,
  type: "Technical Architecture",
  ...overrides,
});

const checkpoint = (diagram = live()) =>
  createCheckpoint(diagram, {
    createdAt: "2026-10-21T08:00:00.000Z",
    id: "v-1",
    name: "Before split",
    number: 1,
  });

const firstLabel = (model: unknown) =>
  (model as { nodes: Array<{ label: string }> }).nodes[0]?.label;

describe("Diagram Version checkpoint", () => {
  test("uses the exact English labels", () => {
    expect(DIAGRAM_VERSION_LABELS).toEqual({
      version: "Diagram Version",
      view: "Diagram View",
    });
  });

  test("copies the live model and is not changed by later live edits", () => {
    const diagram = live();
    const version = checkpoint(diagram);
    (diagram.model as { nodes: Array<{ label: string }> }).nodes[0] = {
      label: "Renamed",
    };
    expect(version).toMatchObject({
      authorityMode: "Product-authored Model",
      diagramId: "arch",
      number: 1,
      revision: 3,
      type: "Technical Architecture",
    });
    expect(firstLabel(version.model)).toBe("API");
  });

  test("never mints an authority mode and refuses an External Source Link", () => {
    expect(
      checkpoint(live({ authorityMode: "Imported Independent Copy" }))
        .authorityMode,
    ).toBe("Imported Independent Copy");
    expect(() =>
      checkpoint(
        live({
          authorityMode: "External Source Link",
          model: { links: [], nodes: [] },
        }),
      ),
    ).toThrow(DiagramVersionError);
  });

  test("is not a Git tag or an image export: it carries no tag, file or pixels", () => {
    expect(Object.keys(checkpoint()).sort()).toEqual([
      "authorityMode",
      "createdAt",
      "diagramId",
      "id",
      "model",
      "name",
      "number",
      "revision",
      "type",
    ]);
  });

  test("exposes an exact reference by version identity, never by the live record", () => {
    expect(diagramVersionReference(checkpoint())).toEqual({
      diagramId: "arch",
      kind: "Diagram Version",
      name: "Before split",
      number: 1,
      versionId: "v-1",
    });
  });

  test("requires a name and a confirmation key; takes no model or mode", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    expect(
      createDiagramVersionInputSchema.safeParse({
        clientIdempotencyKey: key,
        diagramId: "arch",
        name: "  ",
      }).success,
    ).toBe(false);
    expect(
      createDiagramVersionInputSchema.safeParse({
        authorityMode: "Imported Independent Copy",
        clientIdempotencyKey: key,
        diagramId: "arch",
        name: "x",
      }).success,
    ).toBe(false);
  });
});

describe("restore", () => {
  test("returns the checkpoint model as the next live revision", () => {
    const version = checkpoint();
    const current = live({
      model: { links: [], nodes: [{ id: "x", kind: "Component", label: "X" }] },
      revision: 5,
    });
    const restored = restoreFromCheckpoint(current, version, 5);
    expect(restored.revision).toBe(6);
    expect(restored.model).toEqual(version.model);
    expect(restored.model).not.toBe(version.model);
    expect(version.revision).toBe(3);
  });

  test("refuses a stale revision, another diagram and an External Source Link", () => {
    const version = checkpoint();
    expect(() =>
      restoreFromCheckpoint(live({ revision: 5 }), version, 4),
    ).toThrow(DiagramVersionError);
    expect(() =>
      restoreFromCheckpoint(live({ id: "other", revision: 5 }), version, 5),
    ).toThrow(DiagramVersionError);
    expect(() =>
      restoreFromCheckpoint(
        live({ authorityMode: "External Source Link", revision: 5 }),
        version,
        5,
      ),
    ).toThrow(DiagramVersionError);
  });

  test("input names the expected live revision", () => {
    expect(
      restoreDiagramVersionInputSchema.safeParse({
        diagramId: "arch",
        expectedRevision: 5,
        versionId: "v-1",
      }).success,
    ).toBe(true);
    expect(
      restoreDiagramVersionInputSchema.safeParse({
        diagramId: "arch",
        versionId: "v-1",
      }).success,
    ).toBe(false);
  });
});

describe("exact Sequence lifeline bind", () => {
  const bind = {
    boundLabel: "API",
    diagramId: "arch",
    nodeId: "api",
  };

  test("accepts a node of that exact Architecture version", () => {
    expect(() => assertVersionBind(checkpoint(), bind)).not.toThrow();
  });

  test("validates against the checkpoint, so a moved source never retargets it", () => {
    const version = checkpoint();
    // The live node may be renamed after the checkpoint; the pin still holds.
    expect(() => assertVersionBind(version, bind)).not.toThrow();
    expect(() =>
      assertVersionBind(version, { ...bind, boundLabel: "Gateway" }),
    ).toThrow(DiagramVersionError);
  });

  test("refuses an unknown version, another diagram, a missing node and a non-Architecture version", () => {
    expect(() => assertVersionBind(null, bind)).toThrow(DiagramVersionError);
    expect(() =>
      assertVersionBind(checkpoint(), { ...bind, diagramId: "other" }),
    ).toThrow(DiagramVersionError);
    expect(() =>
      assertVersionBind(checkpoint(), { ...bind, nodeId: "gone" }),
    ).toThrow(DiagramVersionError);
    expect(() =>
      assertVersionBind(
        checkpoint(
          live({
            model: { relations: [], tables: [] },
            type: "Data Model",
          }),
        ),
        bind,
      ),
    ).toThrow(DiagramVersionError);
  });
});
