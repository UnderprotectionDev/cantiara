import { describe, expect, test } from "vitest";

import {
  buildConvertToRecordPlan,
  confirmConvertToRecordInputSchema,
  DIAGRAM_CARD_LABELS,
  diagramCardProjection,
  isSameConvertToRecordPlan,
  pinDiagramToVersion,
  placeDiagramRecordCardInputSchema,
} from "./technical-diagram-card";
import type { TechnicalDiagramVersion } from "./technical-diagram-version";
import type { TechnicalDiagramSource } from "./technical-diagrams";

const liveModel = {
  links: [{ from: "api", kind: "Calls" as const, label: null, to: "db" }],
  nodes: [
    { id: "api", kind: "Service" as const, label: "API" },
    { id: "db", kind: "Datastore" as const, label: "Database" },
    { id: "queue", kind: "Queue/Event Bus" as const, label: "Jobs" },
  ],
};

const diagram: TechnicalDiagramSource = {
  authorityMode: "Product-authored Model",
  externalSource: null,
  id: "diagram-1",
  model: liveModel,
  origins: [],
  projectId: "project-1",
  revision: 4,
  title: "Platform",
  type: "Technical Architecture",
  view: {
    id: "view-1",
    layout: {},
    name: "Core",
    selectedNodeIds: ["api", "db", "queue"],
  },
};

const version: TechnicalDiagramVersion = {
  authorityMode: "Product-authored Model",
  createdAt: "2026-10-20T08:00:00.000Z",
  diagramId: "diagram-1",
  id: "version-1",
  model: {
    links: [],
    nodes: [
      { id: "api", kind: "Service", label: "Gateway" },
      { id: "db", kind: "Datastore", label: "Database" },
    ],
  },
  name: "Launch",
  number: 2,
  revision: 3,
  type: "Technical Architecture",
};

describe("live and exact diagram cards", () => {
  test("a live card is labeled Live and re-projects the source selection", () => {
    const card = diagramCardProjection(diagram);
    expect(card).toMatchObject({
      pin: "Live",
      versionId: null,
      versionName: null,
      viewName: "Core",
    });
    expect(card.nodes.map(({ id }) => id)).toEqual(["api", "db", "queue"]);
    expect(DIAGRAM_CARD_LABELS.live).not.toBe(DIAGRAM_CARD_LABELS.exact);
  });

  test("an exact card reads the checkpoint, keeps the Exact label and drops elements the version lacks", () => {
    const pinned = pinDiagramToVersion(diagram, version);
    expect(pinned?.exactVersion).toMatchObject({
      kind: "Diagram Version",
      name: "Launch",
      number: 2,
      versionId: "version-1",
    });
    const card = diagramCardProjection(pinned as TechnicalDiagramSource);
    expect(card).toMatchObject({ pin: "Exact", versionNumber: 2 });
    expect(card.nodes.map(({ label }) => label)).toEqual([
      "Gateway",
      "Database",
    ]);
  });

  test("a card never copies or mutates the source and a foreign checkpoint is refused", () => {
    const before = structuredClone(diagram);
    pinDiagramToVersion(diagram, version);
    diagramCardProjection(diagram);
    expect(diagram).toEqual(before);
    expect(
      pinDiagramToVersion(diagram, { ...version, diagramId: "other" }),
    ).toBeNull();
  });
});

describe("record cards", () => {
  test("take only an identity, a closed record type and a position", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    expect(
      placeDiagramRecordCardInputSchema.parse({
        clientIdempotencyKey: key,
        diagramId: "diagram-1",
        sourceId: "risk-1",
        sourceType: "Risk",
      }),
    ).toMatchObject({ x: 0, y: 0 });
    for (const extra of [{ title: "Copy" }, { status: "Open" }]) {
      expect(() =>
        placeDiagramRecordCardInputSchema.parse({
          clientIdempotencyKey: key,
          diagramId: "diagram-1",
          sourceId: "risk-1",
          sourceType: "Risk",
          ...extra,
        }),
      ).toThrow();
    }
    expect(() =>
      placeDiagramRecordCardInputSchema.parse({
        clientIdempotencyKey: key,
        diagramId: "diagram-1",
        sourceId: "doc-1",
        sourceType: "Document",
      }),
    ).toThrow();
  });
});

describe("Convert to record and link plan", () => {
  const source = { diagram, projectName: "Cantiara", version };
  const input = {
    nodeId: "api",
    target: "Work" as const,
    workType: "Task" as const,
  };

  test("names target, fields, exact version and origin before any write", () => {
    const plan = buildConvertToRecordPlan(source, input);
    expect(plan).toMatchObject({
      authorityEffect: "None",
      originLocation: {
        diagramId: "diagram-1",
        nodeId: "api",
        versionId: "version-1",
        versionNumber: 2,
      },
      record: { title: "Gateway", type: "Work", workType: "Task" },
      recordCount: 1,
      targetProject: { id: "project-1", name: "Cantiara" },
      version: { kind: "Diagram Version", name: "Launch", number: 2 },
    });
    expect(plan?.record.body).toContain("Diagram Version 2 Launch");
  });

  test("only a non-Work target drops the Work type", () => {
    expect(
      buildConvertToRecordPlan(source, { ...input, target: "Open Question" })
        ?.record.workType,
    ).toBeNull();
  });

  test("a node only the live model has cannot be converted", () => {
    expect(
      buildConvertToRecordPlan(source, { ...input, nodeId: "queue" }),
    ).toBeNull();
    expect(
      buildConvertToRecordPlan(
        { ...source, version: { ...version, diagramId: "other" } },
        input,
      ),
    ).toBeNull();
  });

  test("a confirmation must equal the re-derived plan and takes no extra fields", () => {
    const plan = buildConvertToRecordPlan(source, input);
    const edited = {
      ...plan,
      record: { ...plan?.record, title: "Changed" },
    };
    expect(isSameConvertToRecordPlan(plan, plan)).toBe(true);
    expect(isSameConvertToRecordPlan(edited, plan)).toBe(false);
    const key = "22222222-2222-4222-8222-222222222222";
    expect(() =>
      confirmConvertToRecordInputSchema.parse({
        clientIdempotencyKey: key,
        extra: true,
        plan,
      }),
    ).toThrow();
    expect(
      confirmConvertToRecordInputSchema.parse({
        clientIdempotencyKey: key,
        plan,
      }).plan.authorityEffect,
    ).toBe("None");
  });
});
