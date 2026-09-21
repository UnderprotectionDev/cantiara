import { describe, expect, test } from "vitest";

import { STARTER_CONFIGURATION_OPTIONS } from "./project-shell";
import type { RelationEndpointView, RelationView } from "./relations";
import {
  buildWorkContextModel,
  getPreparedWorkContextLayout,
  nextPreparedWorkContextSection,
  sourcesForWorkContextSection,
} from "./work-context";
import type { WorkProfile } from "./work-lifecycle";
import { WORK_TYPE_OPTIONS } from "./work-lifecycle";

const EXPECTED_SECTIONS = {
  Bug: [
    "Observed/Expected Behavior",
    "Affected Releases",
    "Evidence",
    "GitHub & Tests",
  ],
  Feature: [
    "Problem/Opportunity",
    "Expected Outcome",
    "Evidence & Decisions",
    "Risks & Open Questions",
    "Included Work",
    "GitHub & Tests",
    "Target Release",
  ],
  Improvement: [
    "Current Situation",
    "Expected Outcome",
    "Evidence",
    "GitHub & Tests",
  ],
  Research: [
    "Research Question",
    "Sources & Evidence",
    "Decisions",
    "Related Work",
  ],
  Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: "The checkout flow is hard to understand.",
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: "feature-1",
  primarySpecId: "spec-1",
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  title: "Improve checkout clarity",
  type: "Improvement",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function endpoint(
  overrides: Partial<RelationEndpointView> = {},
): RelationEndpointView {
  return {
    broken: null,
    key: null,
    label: null,
    originPosition: null,
    projectId: null,
    recordId: "record-1",
    recordType: "Work",
    status: null,
    title: null,
    workType: null,
    ...overrides,
  };
}

function relation(
  overrides: Partial<RelationView> &
    Pick<RelationView, "kind" | "source" | "target">,
): RelationView {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    direction: "outgoing",
    id: "relation-1",
    inverseLabel: "Related",
    label: overrides.kind,
    revision: 1,
    ...overrides,
  };
}

describe("Work Context Card prepared layouts", () => {
  test("uses the closed prepared section set for every Work type", () => {
    for (const type of WORK_TYPE_OPTIONS) {
      expect(getPreparedWorkContextLayout(type).sections).toEqual(
        EXPECTED_SECTIONS[type],
      );
    }
  });

  test("keeps the same type layout across every Starter Configuration", () => {
    for (const type of WORK_TYPE_OPTIONS) {
      const layouts = STARTER_CONFIGURATION_OPTIONS.map(() =>
        getPreparedWorkContextLayout(type),
      );

      expect(layouts).toHaveLength(4);
      expect(layouts.map((layout) => layout.sections)).toEqual(
        STARTER_CONFIGURATION_OPTIONS.map(() => EXPECTED_SECTIONS[type]),
      );
    }
  });

  test("keeps Title, Type, Status, and Planning visible before context", () => {
    expect(getPreparedWorkContextLayout("Feature").initialFields).toEqual([
      "Title",
      "Type",
      "Status",
      "Planning",
    ]);
  });

  test("opens one hidden section at a time through Add Context", () => {
    expect(nextPreparedWorkContextSection("Task", [])).toBe("Description");
    expect(nextPreparedWorkContextSection("Task", ["Description"])).toBe(
      "Dependencies",
    );
    expect(
      nextPreparedWorkContextSection("Task", [
        "Description",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
      ]),
    ).toBeNull();
  });
});

describe("Work Context Card live sources", () => {
  test("chains nearest live sources in order without copying their content", () => {
    const model = buildWorkContextModel({
      projectWorks: [
        {
          ...work,
          id: "feature-1",
          key: "PAY-2",
          primaryFeatureId: null,
          primarySpecId: null,
          title: "Checkout clarity",
          type: "Feature",
        },
      ],
      relations: [
        relation({
          direction: "incoming",
          id: "origin-research",
          inverseLabel: "Derived",
          kind: "Origin",
          label: "Derived",
          source: endpoint({
            key: "PAY-3",
            label: "PAY-3",
            projectId: "project-1",
            recordId: "research-1",
            status: "Closed",
            title: "Checkout interviews",
            workType: "Research",
          }),
          target: endpoint({
            key: work.key,
            label: work.key,
            projectId: work.projectId,
            recordId: work.id,
            status: work.status,
            title: work.title,
            workType: work.type,
          }),
        }),
        relation({
          id: "goal-relation",
          kind: "Contributes to Goal",
          source: endpoint({
            key: work.key,
            label: work.key,
            projectId: work.projectId,
            recordId: work.id,
            status: work.status,
            title: work.title,
            workType: work.type,
          }),
          target: endpoint({
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "No access",
            },
            recordId: "goal-1",
            recordType: "Project Goal",
          }),
        }),
        relation({
          id: "decision-relation",
          kind: "Implements",
          source: endpoint({
            key: work.key,
            label: work.key,
            projectId: work.projectId,
            recordId: work.id,
            status: work.status,
            title: work.title,
            workType: work.type,
          }),
          target: endpoint({
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "No access",
            },
            key: "DEC-1",
            label: "DEC-1",
            projectId: null,
            recordId: "decision-1",
            recordType: "Decision",
            title: null,
          }),
        }),
        relation({
          id: "primary-spec-relation",
          kind: "Primary spec",
          source: endpoint({
            recordId: work.id,
            recordType: "Work",
          }),
          target: endpoint({
            key: "SPEC-1",
            label: "SPEC-1",
            projectId: work.projectId,
            recordId: work.primarySpecId ?? "spec-1",
            recordType: "Document version",
            title: "Checkout spec",
          }),
        }),
        relation({
          id: "ignored-related",
          kind: "Related",
          source: endpoint({
            recordId: work.id,
            recordType: "Work",
          }),
          target: endpoint({
            key: "PAY-9",
            label: "PAY-9",
            projectId: "project-1",
            recordId: "related-1",
            title: "Unrelated context",
            workType: "Task",
          }),
        }),
      ],
      work,
    });

    expect(model.whyChain.map((source) => source.label)).toEqual([
      "Project Goal",
      "Origin Research",
      "Primary Feature",
      "Primary spec",
      "Decision",
    ]);
    expect(model.whyChain[1]).toMatchObject({
      key: "PAY-3",
      status: "Closed",
      title: "Checkout interviews",
      workType: "Research",
    });
    expect(model.whyChain).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          broken: null,
          key: "SPEC-1",
          label: "Primary spec",
          title: "Checkout spec",
        }),
      ]),
    );
    expect(model.whyChain).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Unrelated context" }),
      ]),
    );
    expect(sourcesForWorkContextSection("Related Work", model.sources)).toEqual(
      [
        expect.objectContaining({
          id: "relation:ignored-related",
          relationKind: "Related",
          title: "Unrelated context",
        }),
      ],
    );
    expect(model.whyChain).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Use hosted checkout" }),
      ]),
    );
    expect(model.whyChain).not.toContainEqual(
      expect.objectContaining({ title: work.description }),
    );
  });

  test("keeps broken sources content-free and maps them to the owning section", () => {
    const model = buildWorkContextModel({
      relations: [
        relation({
          id: "risk-relation",
          kind: "Evidence",
          source: endpoint({
            recordId: work.id,
            recordType: "Work",
          }),
          target: endpoint({
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "Redacted for security",
            },
            key: null,
            label: null,
            recordId: "risk-1",
            recordType: "Risk",
            title: null,
          }),
        }),
      ],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });

    const risk = model.sources.find((source) => source.label === "Risk");
    if (!risk) {
      throw new Error("Expected the Risk source in the why chain.");
    }
    expect(risk).toMatchObject({
      broken: { reason: "Redacted for security" },
      label: "Risk",
      title: null,
    });
    expect(risk.key).toBeNull();
    expect(
      sourcesForWorkContextSection("Risks & Open Questions", model.sources),
    ).toEqual([risk]);
  });

  test("keeps an inaccessible Evidence source content-free", () => {
    const evidence = relation({
      id: "evidence-relation",
      kind: "Evidence",
      source: endpoint({
        broken: {
          canOpenSourceRecord: false,
          establishedAt: "2026-01-01T00:00:00.000Z",
          reason: "No access",
        },
        key: null,
        label: null,
        projectId: null,
        recordId: "source-1",
        recordType: "Source",
        title: null,
      }),
      target: endpoint({
        recordId: work.id,
        recordType: "Work",
      }),
    });

    const model = buildWorkContextModel({
      relations: [evidence],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });

    expect(
      sourcesForWorkContextSection("Evidence & Decisions", model.sources),
    ).toEqual([
      expect.objectContaining({
        id: "relation:evidence-relation",
        recordType: "Source",
      }),
    ]);
  });

  test("does not invent a Primary spec tombstone without a resolved source", () => {
    const model = buildWorkContextModel({
      relations: [],
      work,
    });

    expect(model.sources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Primary spec" }),
      ]),
    );
  });

  test("marks an archived Primary Feature while keeping its live identity", () => {
    const archivedFeature = {
      ...work,
      archivedAt: "2026-01-02T00:00:00.000Z",
      id: "feature-1",
      key: "PAY-2",
      primaryFeatureId: null,
      primarySpecId: null,
      title: "Checkout clarity",
      type: "Feature" as const,
    };
    const model = buildWorkContextModel({
      projectWorks: [archivedFeature],
      relations: [],
      work: { ...work, primarySpecId: null },
    });

    expect(model.sources).toHaveLength(1);
    expect(model.sources[0]).toMatchObject({
      broken: { canOpenSourceRecord: true, reason: "Archived" },
      key: "PAY-2",
      label: "Primary Feature",
      title: "Checkout clarity",
    });
  });
});
