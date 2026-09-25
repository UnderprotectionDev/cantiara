import { describe, expect, test } from "vitest";

import {
  applyProjectShellConfigurationChange,
  getProjectShellConfiguration,
  projectShellConfigurationChangeSchema,
  resolveProjectShellConfiguration,
  STARTER_CONFIGURATION_OPTIONS,
} from "./project-shell";
import type { RelationEndpointView, RelationView } from "./relations";
import {
  buildWorkContextModel,
  getDefaultWorkContextLayouts,
  getPreparedWorkContextLayout,
  getWorkContextLayout,
  nextWorkContextSection,
  previewWorkContextLayout,
  renderWorkContextMarkdown,
  repairWorkContextLayout,
  sourcesForWorkContextCustomSection,
  sourcesForWorkContextSection,
  WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
  WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS,
  type WorkContextSource,
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
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: "feature-1",
  primarySpecId: "spec-1",
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  statusChangedAt: "2026-01-01T00:00:00.000Z",
  targetDate: null,
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
  let blockingStatus: RelationView["blockingStatus"] | undefined =
    overrides.blockingStatus;
  if (blockingStatus === undefined) {
    blockingStatus = overrides.kind === "Blocks" ? "Active" : null;
  }
  return {
    blockingHistory: [],
    blockingResolvedAt: null,
    blockingResolutionNote: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    direction: "outgoing",
    id: "relation-1",
    inverseLabel: "Related",
    label: overrides.kind,
    revision: 1,
    ...overrides,
    blockingStatus,
  };
}

function contextSource(
  overrides: Partial<WorkContextSource> = {},
): WorkContextSource {
  return {
    broken: null,
    evidenceRole: "Unspecified",
    id: "source-1",
    key: null,
    label: "Source",
    openPath: null,
    projectId: null,
    recordId: "source-1",
    recordType: "Source",
    relationId: "relation-1",
    relationKind: "Evidence",
    status: null,
    title: null,
    workType: null,
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
    expect(nextWorkContextSection("Task", [])?.key).toBe("Description");
    expect(nextWorkContextSection("Task", ["Description"])?.key).toBe(
      "Dependencies",
    );
    expect(
      nextWorkContextSection("Task", [
        "Description",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
      ]),
    ).toBeNull();
  });
});

describe("Work Context Card configurable layouts", () => {
  test("prepares List and resolves Kanban settings for saved Work views", () => {
    const configuration = getProjectShellConfiguration("Blank Project");
    const { workContextLayouts: _layouts, ...beforeKanbanSettings } = {
      ...configuration,
      preparedWorkViews: configuration.preparedWorkViews.filter(
        (view) => view !== "List",
      ),
    };

    const resolved = resolveProjectShellConfiguration(
      beforeKanbanSettings,
      "Blank Project",
    );

    expect(configuration.preparedWorkViews).toContain("List");
    expect(resolved.workStatusSoftWipLimits).toEqual({
      Blocked: null,
      Closed: null,
      "In Progress": null,
      "Not Started": null,
    });
    expect(resolved.workFocusThreshold).toBeNull();
    expect(resolved.workSort).toEqual({
      direction: "ascending",
      field: "number",
    });
  });

  test("persists a soft WIP limit, focus threshold, and saved view sort", () => {
    const configuration = getProjectShellConfiguration("Blank Project");

    const withSoftWip = applyProjectShellConfigurationChange(
      configuration,
      {
        kind: "set-work-status-soft-wip-limit",
        limit: 3,
        semantic: "In Progress",
      },
      "Blank Project",
    );
    const withFocus = applyProjectShellConfigurationChange(
      withSoftWip,
      { kind: "set-work-focus-threshold", threshold: 5 },
      "Blank Project",
    );
    const next = applyProjectShellConfigurationChange(
      withFocus,
      {
        direction: "descending",
        field: "updatedAt",
        kind: "set-work-sort",
      },
      "Blank Project",
    );

    expect(next.workStatusSoftWipLimits["In Progress"]).toBe(3);
    expect(next.workFocusThreshold).toBe(5);
    expect(next.workSort).toEqual({
      direction: "descending",
      field: "updatedAt",
    });
  });

  test("starts every Work type with the prepared sections and no custom query", () => {
    const layouts = getDefaultWorkContextLayouts();

    expect(Object.keys(layouts)).toEqual([...WORK_TYPE_OPTIONS]);
    expect(layouts.Feature).toEqual({
      customSections: [],
      hiddenSections: [],
      sectionOrder: EXPECTED_SECTIONS.Feature,
    });
    expect(WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS).toContain("Primary spec");
    expect(WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS).toEqual([
      "Supports",
      "Contradicts",
      "Provides context",
      "Inconclusive",
      "Unspecified",
    ]);
  });

  test("repairs a persisted configuration from before Work Context layouts", () => {
    const current = getProjectShellConfiguration("Blank Project");
    const { workContextLayouts: _legacyLayouts, ...legacy } = current;

    const resolved = resolveProjectShellConfiguration(legacy, "Blank Project");

    expect(resolved.workContextLayouts.Task).toEqual(
      getDefaultWorkContextLayouts().Task,
    );
  });

  test("repairs a stale persisted layout without resetting the Project configuration", () => {
    const current = getProjectShellConfiguration("Blank Project");
    const stale = {
      ...current,
      workContextLayouts: {
        ...current.workContextLayouts,
        Task: {
          customSections: [],
          hiddenSections: [],
          sectionOrder: ["Description", "Legacy Section", "Dependencies"],
        },
      },
    };

    const resolved = resolveProjectShellConfiguration(stale, "Blank Project");

    expect(resolved.workContextLayouts.Task).toEqual({
      customSections: [],
      hiddenSections: [],
      sectionOrder: [
        "Description",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
      ],
    });
    expect(resolved.enabledAreas).toEqual(current.enabledAreas);
    expect(resolved.workStatusLabels).toEqual(current.workStatusLabels);
    expect(resolved.preparedStages).toEqual(current.preparedStages);
  });

  test("repairs a layout by keeping valid custom sections and dropping stale keys", () => {
    const repaired = repairWorkContextLayout("Task", {
      customSections: [
        {
          condition: {
            kind: "record-type",
            recordType: "Decision",
            status: null,
          },
          id: "custom-decisions",
          title: "Decision trail",
        },
        {
          condition: { kind: "query", query: "status = Closed" },
          id: "custom-free-query",
          title: "Not allowed",
        },
      ],
      hiddenSections: ["Description", "Ghost Section"],
      sectionOrder: ["Description", "custom-decisions", "Description"],
    });

    expect(repaired).toEqual({
      customSections: [
        {
          condition: {
            kind: "record-type",
            recordType: "Decision",
            status: null,
          },
          id: "custom-decisions",
          title: "Decision trail",
        },
      ],
      hiddenSections: ["Description"],
      sectionOrder: [
        "Description",
        "custom-decisions",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
      ],
    });
    expect(repairWorkContextLayout("Task", repaired)).toEqual(repaired);
  });

  test("falls back to the prepared layout when the persisted layout is unreadable", () => {
    expect(repairWorkContextLayout("Task", null)).toEqual(
      getDefaultWorkContextLayouts().Task,
    );
    expect(repairWorkContextLayout("Task", "not a layout")).toEqual(
      getDefaultWorkContextLayouts().Task,
    );
  });

  test("does not report hidden or added sections as moved when the order is stable", () => {
    const configuration = getProjectShellConfiguration("Blank Project");
    const before = getWorkContextLayout(
      "Task",
      configuration.workContextLayouts,
    );
    const after = {
      customSections: [
        {
          condition: {
            kind: "record-type" as const,
            recordType: "Decision" as const,
            status: null,
          },
          id: "custom-decisions",
          title: "Decision trail",
        },
      ],
      hiddenSections: ["Dependencies" as const],
      sectionOrder: [
        "Description",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
        "custom-decisions",
      ],
    };

    expect(previewWorkContextLayout("Task", before, after)).toEqual({
      added: ["Decision trail"],
      hidden: ["Dependencies"],
      moved: [],
      shown: [],
    });
  });

  test("previews a hidden, reordered, and custom section before apply", () => {
    const configuration = getProjectShellConfiguration("Blank Project");
    const layout = getWorkContextLayout(
      "Task",
      configuration.workContextLayouts,
    );
    const nextLayout = {
      ...layout,
      customSections: [
        {
          condition: {
            kind: "record-type" as const,
            recordType: "Decision" as const,
            status: null,
          },
          id: "custom-decisions",
          title: "Decision trail",
        },
      ],
      hiddenSections: ["Dependencies" as const],
      sectionOrder: [
        "GitHub & Tests",
        "Description",
        "custom-decisions",
        "Target Release",
        "Dependencies",
      ],
    };

    expect(previewWorkContextLayout("Task", layout, nextLayout)).toEqual({
      added: ["Decision trail"],
      hidden: ["Dependencies"],
      moved: ["GitHub & Tests", "Description"],
      shown: [],
    });

    const next = applyProjectShellConfigurationChange(
      configuration,
      { kind: "set-work-context-layout", layout: nextLayout, workType: "Task" },
      "Blank Project",
    );
    expect(next.workContextLayouts.Task).toEqual(nextLayout);
    expect(next.preparedStages).toEqual(configuration.preparedStages);
  });

  test("accepts only the closed catalog and relation-reachable sources", () => {
    const decision = relation({
      id: "decision-context",
      kind: "Related",
      source: endpoint({ recordId: work.id }),
      target: endpoint({
        key: "DEC-1",
        projectId: work.projectId,
        recordId: "decision-1",
        recordType: "Decision",
        status: "In Progress",
        title: "Use hosted checkout",
      }),
    });
    const model = buildWorkContextModel({
      relations: [decision],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });
    const customSection = {
      condition: {
        kind: "record-type" as const,
        recordType: "Decision" as const,
        status: "In Progress" as const,
      },
      id: "custom-decisions",
      title: "Decision trail",
    };

    expect(
      sourcesForWorkContextCustomSection(customSection, model.sources),
    ).toEqual([expect.objectContaining({ recordType: "Decision" })]);
    expect(
      sourcesForWorkContextCustomSection(
        {
          ...customSection,
          condition: {
            ...customSection.condition,
            status: "Closed",
          },
        },
        model.sources,
      ),
    ).toEqual([]);

    const milestone = relation({
      id: "milestone-context",
      kind: "Contributes to Milestone",
      source: endpoint({ recordId: work.id }),
      target: endpoint({ recordId: "milestone-1", recordType: "Milestone" }),
    });
    const milestoneModel = buildWorkContextModel({
      relations: [milestone],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });
    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            kind: "relation",
            relation: "Contributes to Milestone",
            status: null,
          },
          id: "custom-milestones",
          title: "Milestone trail",
        },
        milestoneModel.sources,
      ),
    ).toEqual([expect.objectContaining({ recordType: "Milestone" })]);
  });

  test("does not accept a free query or an incomplete section order", () => {
    const configuration = getProjectShellConfiguration("Blank Project");
    const layout = getWorkContextLayout(
      "Task",
      configuration.workContextLayouts,
    );
    const freeQueryChange = {
      kind: "set-work-context-layout" as const,
      layout: {
        ...layout,
        customSections: [
          {
            condition: {
              kind: "record-type" as const,
              query: "status = Closed",
              recordType: "Decision" as const,
              status: null,
            },
            id: "custom-query",
            title: "Not allowed",
          },
        ],
        sectionOrder: [...layout.sectionOrder, "custom-query"],
      },
      workType: "Task" as const,
    };

    expect(
      projectShellConfigurationChangeSchema.safeParse(freeQueryChange),
    ).toMatchObject({ success: false });
    expect(() =>
      applyProjectShellConfigurationChange(
        configuration,
        {
          kind: "set-work-context-layout",
          layout: { ...layout, sectionOrder: layout.sectionOrder.slice(1) },
          workType: "Task",
        },
        "Blank Project",
      ),
    ).toThrow("every prepared and custom section exactly once");
  });

  test("matches primary-feature record-type conditions by structure, not display label", () => {
    const featureWork = {
      ...work,
      id: "feature-1",
      key: "PAY-2",
      primaryFeatureId: null,
      primarySpecId: null,
      title: "Checkout clarity",
      type: "Feature" as const,
    };
    const includesFeature = relation({
      id: "includes-feature",
      kind: "Includes",
      source: endpoint({
        key: work.key,
        label: work.key,
        projectId: work.projectId,
        recordId: work.id,
        recordType: "Work",
        status: work.status,
        title: work.title,
        workType: work.type,
      }),
      target: endpoint({
        key: "PAY-7",
        label: "PAY-7",
        projectId: work.projectId,
        recordId: "feature-2",
        recordType: "Feature",
        title: "Guest checkout",
        workType: "Feature",
      }),
    });
    const model = buildWorkContextModel({
      projectWorks: [featureWork],
      relations: [includesFeature],
      work,
    });

    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            kind: "record-type",
            recordType: "Primary Feature",
            status: null,
          },
          id: "custom-primary-features",
          title: "Primary features",
        },
        model.customSources,
      ),
    ).toEqual([
      expect.objectContaining({
        recordType: "Work",
        relationKind: null,
        workType: "Feature",
      }),
      expect.objectContaining({
        recordId: "feature-2",
        recordType: "Feature",
        relationKind: "Includes",
      }),
    ]);
    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            kind: "record-type",
            recordType: "Primary spec",
            status: null,
          },
          id: "custom-primary-specs",
          title: "Primary specs",
        },
        model.customSources,
      ),
    ).toEqual([]);
  });

  test("treats an unset Evidence Role as Unspecified", () => {
    const evidenceRelation = relation({
      id: "evidence-role-unspecified",
      kind: "Evidence",
      source: endpoint({ recordId: work.id, recordType: "Work" }),
      target: endpoint({
        recordId: "source-1",
        recordType: "Source",
        title: "Checkout notes",
      }),
    });
    const model = buildWorkContextModel({
      relations: [evidenceRelation],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });

    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            evidenceRole: "Unspecified",
            kind: "evidence-role",
            status: null,
          },
          id: "custom-unspecified-evidence",
          title: "Unspecified evidence",
        },
        model.sources,
      ),
    ).toHaveLength(1);
    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            evidenceRole: "Supports",
            kind: "evidence-role",
            status: null,
          },
          id: "custom-supporting-evidence",
          title: "Supporting evidence",
        },
        model.sources,
      ),
    ).toEqual([]);
  });

  test("keeps relation-specific custom conditions when one record has two links", () => {
    const sharedEndpoint = endpoint({
      recordId: "source-1",
      recordType: "Source",
      title: "Checkout notes",
    });
    const evidenceRelation = Object.assign(
      relation({
        id: "evidence-supports",
        kind: "Evidence",
        source: endpoint({ recordId: work.id, recordType: "Work" }),
        target: sharedEndpoint,
      }),
      { evidenceRole: "Supports" },
    ) as RelationView;
    const relatedRelation = relation({
      id: "related-source",
      kind: "Related",
      source: endpoint({ recordId: work.id, recordType: "Work" }),
      target: sharedEndpoint,
    });
    const model = buildWorkContextModel({
      relations: [relatedRelation, evidenceRelation],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });

    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            evidenceRole: "Supports",
            kind: "evidence-role",
            status: null,
          },
          id: "custom-supporting-evidence",
          title: "Supporting evidence",
        },
        model.customSources,
      ),
    ).toEqual([expect.objectContaining({ relationId: "evidence-supports" })]);
    expect(
      sourcesForWorkContextCustomSection(
        {
          condition: {
            kind: "relation",
            relation: "Related",
            status: null,
          },
          id: "custom-related",
          title: "Related records",
        },
        model.customSources,
      ),
    ).toEqual([expect.objectContaining({ relationId: "related-source" })]);
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

  test("keeps accessible supported sources and their permitted external link", () => {
    const githubPullRequest = relation({
      id: "github-pr-relation",
      kind: "Evidence",
      source: endpoint({
        recordId: work.id,
        recordType: "Work",
      }),
      target: endpoint({
        key: "PR-7",
        label: "GitHub PR",
        recordId: "github-pr-1",
        recordType: "GitHub PR",
        title: "Clarify checkout labels",
        url: "https://github.com/cantiara/web/pull/7",
      }),
    });

    const model = buildWorkContextModel({
      relations: [githubPullRequest],
      work: { ...work, primaryFeatureId: null, primarySpecId: null },
    });

    expect(model.sources).toEqual([
      expect.objectContaining({
        recordType: "GitHub PR",
        title: "Clarify checkout labels",
        url: "https://github.com/cantiara/web/pull/7",
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

describe("Work Context Card Priority Foundations", () => {
  test("keeps source values and Feedback counts separate without ranking", () => {
    const feedbackSources = Array.from({ length: 5 }, (_, index) =>
      relation({
        direction: "incoming",
        id: `feedback-${index + 1}`,
        kind: "Evidence",
        source: endpoint({
          key: `FB-${index + 1}`,
          projectId: work.projectId,
          recordId: `feedback-${index + 1}`,
          recordType: "Feedback",
          title: `Feedback ${index + 1}`,
        }),
        target: endpoint({
          recordId: work.id,
          recordType: "Work",
        }),
      }),
    );
    const model = buildWorkContextModel({
      relations: [
        relation({
          id: "goal",
          kind: "Contributes to Goal",
          source: endpoint({ recordId: work.id, recordType: "Work" }),
          target: endpoint({
            projectId: work.projectId,
            recordId: "goal-1",
            recordType: "Project Goal",
            title: "Make checkout understandable",
          }),
        }),
        relation({
          direction: "incoming",
          id: "blocker",
          kind: "Blocks",
          source: endpoint({
            key: "PAY-9",
            projectId: work.projectId,
            recordId: "blocker-1",
            recordType: "Work",
            status: "Closed",
            title: "Waiting for payment provider",
            workType: "Task",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        relation({
          blockingStatus: "Resolved",
          direction: "incoming",
          id: "resolved-blocker",
          kind: "Blocks",
          source: endpoint({
            key: "PAY-10",
            projectId: work.projectId,
            recordId: "resolved-blocker-1",
            recordType: "Work",
            status: "Closed",
            title: "Completed payment provider access",
            workType: "Task",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        relation({
          id: "risk",
          kind: "Evidence",
          source: endpoint({ recordId: work.id, recordType: "Work" }),
          target: endpoint({
            recordId: "risk-1",
            recordType: "Risk",
            title: "Checkout confusion remains",
          }),
        }),
        relation({
          id: "milestone",
          kind: "Contributes to Milestone",
          source: endpoint({ recordId: work.id, recordType: "Work" }),
          target: endpoint({
            recordId: "milestone-1",
            recordType: "Milestone",
            title: "Checkout beta",
          }),
        }),
        relation({
          id: "decision",
          kind: "Implements",
          source: endpoint({ recordId: work.id, recordType: "Work" }),
          target: endpoint({
            recordId: "decision-1",
            recordType: "Decision",
            title: "Prefer inline payment guidance",
          }),
        }),
        relation({
          direction: "incoming",
          id: "source",
          kind: "Evidence",
          source: endpoint({
            recordId: "source-1",
            recordType: "Source",
            title: "Support call transcript",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        ...feedbackSources,
        relation({
          id: "feedback-archived",
          kind: "Evidence",
          source: endpoint({
            broken: {
              canOpenSourceRecord: true,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "Archived",
            },
            key: "FB-ARCHIVED",
            recordId: "feedback-archived",
            recordType: "Feedback",
            title: "Archived checkout feedback",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        relation({
          id: "feedback-in-trash",
          kind: "Evidence",
          source: endpoint({
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "In Trash",
            },
            recordId: "feedback-in-trash",
            recordType: "Feedback",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        relation({
          id: "feedback-deleted",
          kind: "Evidence",
          source: endpoint({
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-01-01T00:00:00.000Z",
              reason: "Permanently deleted",
            },
            recordId: "feedback-deleted",
            recordType: "Feedback",
          }),
          target: endpoint({ recordId: work.id, recordType: "Work" }),
        }),
        relation({
          id: "feedback-participant-1",
          kind: "Participant",
          source: endpoint({
            recordId: "feedback-1",
            recordType: "Feedback",
          }),
          target: endpoint({ recordId: "contact-1", recordType: "Contact" }),
        }),
        relation({
          id: "feedback-participant-2",
          kind: "Participant",
          source: endpoint({
            recordId: "feedback-2",
            recordType: "Feedback",
          }),
          target: endpoint({ recordId: "contact-1", recordType: "Contact" }),
        }),
        relation({
          id: "contact-company",
          kind: "Belongs to Company",
          source: endpoint({ recordId: "contact-1", recordType: "Contact" }),
          target: endpoint({ recordId: "company-1", recordType: "Company" }),
        }),
      ],
      priorityValues: {
        effort: "3 days",
        priorityMetrics: [
          {
            id: "evidence-strength",
            name: "Evidence strength",
            projectId: work.projectId,
            value: "High",
          },
        ],
        targetDate: "2026-10-01",
      },
      work,
    });

    const foundations = model.priorityFoundations;
    const criterionValue = foundations.values.find(
      (value) => value.label === "Evidence strength",
    );

    expect(foundations.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Project Goal",
          value: "Make checkout understandable",
        }),
        expect.objectContaining({ label: "Target date", value: "2026-10-01" }),
        expect.objectContaining({ label: "Effort", value: "3 days" }),
        expect.objectContaining({
          label: "Evidence strength",
          value: "High",
          source: expect.objectContaining({
            criterionId: "evidence-strength",
            kind: "Priority criterion",
            projectId: work.projectId,
          }),
        }),
      ]),
    );
    expect(model.sources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordId: "resolved-blocker-1" }),
      ]),
    );
    expect(model.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordId: "blocker-1",
          relationKind: "Blocks",
          status: "Closed",
        }),
      ]),
    );
    expect(foundations.counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Feedback", count: 6 }),
        expect.objectContaining({ label: "Unique Contact", count: 1 }),
        expect.objectContaining({ label: "Unique Company", count: 1 }),
        expect.objectContaining({ label: "Risk", count: 1 }),
        expect.objectContaining({ label: "Milestone", count: 1 }),
      ]),
    );
    expect(
      foundations.counts.find((count) => count.label === "Feedback")?.sources,
    ).toHaveLength(6);
    expect(
      foundations.counts
        .find((count) => count.label === "Feedback")
        ?.sources.some((source) => source.broken?.reason === "Archived"),
    ).toBe(true);
    expect(
      foundations.counts
        .find((count) => count.label === "Feedback")
        ?.sources.some((source) => source.broken?.reason === "In Trash"),
    ).toBe(false);
    expect(
      foundations.counts
        .find((count) => count.label === "Feedback")
        ?.sources.some(
          (source) => source.broken?.reason === "Permanently deleted",
        ),
    ).toBe(false);
    expect(foundations.values).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Score" })]),
    );
    expect(criterionValue?.source).not.toHaveProperty("recordId");
  });
});

describe("Work Context Card Markdown copy", () => {
  test("renders readable context and excludes inaccessible or private content", () => {
    const activeBlocker = contextSource({
      id: "blocker-1",
      key: "PAY-8",
      label: "Work",
      recordId: "blocker-1",
      recordType: "Work",
      relationKind: "Blocks",
      status: "Blocked",
      title: "Resolve payment provider timeout",
      workType: "Bug",
    });
    const closedBlocker = contextSource({
      id: "blocker-2",
      key: "PAY-9",
      label: "Work",
      recordId: "blocker-2",
      recordType: "Work",
      relationKind: "Blocks",
      status: "Closed",
      title: "Old payment issue",
      workType: "Bug",
    });
    const primarySpec = contextSource({
      id: "spec-1",
      key: "SPEC-1",
      label: "Primary spec",
      recordId: "spec-1",
      recordType: "Document version",
      relationKind: "Primary spec",
      title: "Checkout clarity spec",
    });
    const decision = contextSource({
      id: "decision-1",
      key: "DEC-1",
      label: "Decision",
      recordId: "decision-1",
      recordType: "Decision",
      title: "Use a single checkout summary",
    });
    const githubPullRequest = contextSource({
      id: "github-pr-1",
      key: "PR-7",
      label: "GitHub PR",
      recordId: "github-pr-1",
      recordType: "GitHub PR",
      title: "Clarify checkout labels",
      url: "https://github.com/cantiara/web/pull/7",
    });
    const inaccessibleRisk = contextSource({
      broken: {
        canOpenSourceRecord: false,
        establishedAt: "2026-01-01T00:00:00.000Z",
        reason: "Redacted for security",
      },
      id: "private-risk",
      key: "RISK-1",
      label: "Risk",
      recordId: "private-risk",
      recordType: "Risk",
      title: "Private risk must not leak",
    });

    const markdown = renderWorkContextMarkdown({
      model: {
        customSources: [
          activeBlocker,
          closedBlocker,
          primarySpec,
          decision,
          githubPullRequest,
          inaccessibleRisk,
        ],
        sources: [
          activeBlocker,
          closedBlocker,
          primarySpec,
          decision,
          githubPullRequest,
          inaccessibleRisk,
        ],
        whyChain: [primarySpec, decision, inaccessibleRisk],
        priorityFoundations: { counts: [], values: [] },
      },
      producedAt: "2026-01-01T12:00:00.000Z",
      statusLabel: "Doing",
      work: {
        ...work,
        captureProvenance: {
          attachment: null,
          captureId: "capture-1",
          capturedAt: "2026-01-01T11:00:00.000Z",
          content: "super-secret capture content",
          fields: {},
          link: null,
          origin: null,
          template: null,
        },
        checklist: [
          { completed: true, id: "check-1", text: "Confirm checkout labels" },
          { completed: false, id: "check-2", text: "Add a summary screen" },
        ],
      },
    });

    expect(markdown).toContain("# PAY-1 Improve checkout clarity");
    expect(markdown).toContain("- Work key: PAY-1");
    expect(markdown).toContain("- Title: Improve checkout clarity");
    expect(markdown).toContain("- Type: Improvement");
    expect(markdown).toContain("- Status: Doing");
    expect(markdown).toContain("- Produced at: 2026-01-01T12:00:00.000Z");
    expect(markdown).toContain("- Primary source is in the app");
    expect(markdown).toContain("## Description");
    expect(markdown).toContain("The checkout flow is hard to understand.");
    expect(markdown).toContain("- [x] Confirm checkout labels");
    expect(markdown).toContain("- [ ] Add a summary screen");
    expect(markdown).toContain("## Why am I doing this work?");
    expect(markdown).toContain("SPEC-1 Checkout clarity spec");
    expect(markdown).toContain("## Related Decision, Risk, and Open Question");
    expect(markdown).toContain("DEC-1 Use a single checkout summary");
    expect(markdown).toContain("## Active blockers");
    expect(markdown).toContain(
      "- Blocked by: PAY-8 Resolve payment provider timeout",
    );
    expect(markdown).toContain("PAY-8 Resolve payment provider timeout");
    expect(markdown).toContain("- Blocked by: PAY-9 Old payment issue");
    expect(markdown).toContain("## GitHub and external links");
    expect(markdown).toContain("https://github.com/cantiara/web/pull/7");
    expect(markdown).not.toContain("super-secret capture content");
    expect(markdown).not.toContain("Redacted for security");
    expect(markdown).not.toContain("private-risk");
    expect(markdown).not.toContain("Private risk must not leak");
  });
});
