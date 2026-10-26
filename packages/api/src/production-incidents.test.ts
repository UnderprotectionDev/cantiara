import { productionIncident } from "@cantiara/db/schema/production-incident";
import { describe, expect, test } from "vitest";
import {
  attachedProductionIncidentLinks,
  createProductionIncidentFollowUpInputSchema,
  groupProductionIncidentsByStatus,
  PRODUCTION_INCIDENT_FOLLOW_UP_LABEL,
  PRODUCTION_INCIDENT_LINK_TYPES,
  type ProductionIncidentLink,
  type ProductionIncidentsAccess,
  previewProductionIncidentFollowUpInputSchema,
  setProductionIncidentLinkInputSchema,
} from "./production-incidents";
import {
  createProjectSourceRecordInputSchema,
  PRODUCTION_INCIDENT_STATUS_OPTIONS,
  productionIncidentRecordSchema,
} from "./project-source-records";

const TIMING_OR_SCORE_COLUMN =
  /ttd|tti|ttr|detectedAt|resolvedAt|downtime|score|severity|oncall|page/i;
const command = {
  attached: true,
  baseRevision: 0,
  clientIdempotencyKey: "key-1",
  incidentId: "incident-1",
  projectId: "project-1",
  targetId: "work-1",
  targetType: "Bug",
};
const record = {
  createdAt: "2026-10-20T10:00:00.000Z",
  detectedHow: null,
  id: "incident-1",
  impact: null,
  learning: null,
  occurredAt: "2026-10-19T08:00:00.000Z",
  projectId: "project-1",
  resolution: null,
  revision: 0,
  rootCause: null,
  sourceType: "Production Incident" as const,
  status: "Open" as const,
  title: "Checkout outage",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

describe("Production Incidents contract", () => {
  test("the labels are Open, Watching and Resolved and the incident links five record types", () => {
    expect(PRODUCTION_INCIDENT_STATUS_OPTIONS).toEqual([
      "Open",
      "Watching",
      "Resolved",
    ]);
    expect(PRODUCTION_INCIDENT_LINK_TYPES).toEqual([
      "Bug",
      "GitHub PR",
      "Project Release",
      "Risk",
      "Decision",
    ]);
  });

  test("a link command is a strict human mutation of one of the five types", () => {
    for (const targetType of PRODUCTION_INCIDENT_LINK_TYPES) {
      expect(
        setProductionIncidentLinkInputSchema.parse({ ...command, targetType })
          .targetType,
      ).toBe(targetType);
    }
    for (const extra of [
      { targetType: "Task" },
      { targetType: "Work" },
      { status: "Resolved" },
      { life: "Occurred" },
      { createBug: true },
      { createRisk: true },
      { source: "Sentry" },
      { kind: "agent" },
    ]) {
      expect(
        setProductionIncidentLinkInputSchema.safeParse({ ...command, ...extra })
          .success,
      ).toBe(false);
    }
  });

  test("the incident is its own source record type, not a Bug Work", () => {
    expect(productionIncidentRecordSchema.parse(record).sourceType).toBe(
      "Production Incident",
    );
    expect(
      productionIncidentRecordSchema.safeParse({ ...record, type: "Bug" })
        .success,
    ).toBe(false);
    expect(
      productionIncidentRecordSchema.safeParse({
        ...record,
        sourceType: "Work",
      }).success,
    ).toBe(false);
    // Creation is a human command with timeline fields only, no Bug or Risk to mint.
    const create = createProjectSourceRecordInputSchema.safeParse({
      baseRevision: 0,
      clientIdempotencyKey: "key-1",
      detectedHow: null,
      id: "incident-1",
      impact: null,
      learning: null,
      occurredAt: record.occurredAt,
      projectId: "project-1",
      resolution: null,
      rootCause: null,
      sourceType: "Production Incident",
      title: "Checkout outage",
    });
    expect(create.success).toBe(true);
    for (const extra of [{ createBug: true }, { createRisk: true }]) {
      expect(
        createProjectSourceRecordInputSchema.safeParse({
          ...(create.data as object),
          ...extra,
        }).success,
      ).toBe(false);
    }
  });

  test("the incident table stores the record fields only: no pager, timing, score or trend column", () => {
    const columns = Object.keys(productionIncident).filter(
      (name) => name !== "enableRLS",
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        "occurredAt",
        "impact",
        "detectedHow",
        "resolution",
        "rootCause",
        "learning",
        "status",
      ]),
    );
    expect(columns.join(" ")).not.toMatch(TIMING_OR_SCORE_COLUMN);
  });

  test("the access has exactly the read and the link members: no incident, status or alarm writer", () => {
    const members: (keyof ProductionIncidentsAccess)[] = [
      "createFollowUp",
      "detail",
      "overview",
      "previewFollowUp",
      "setLink",
    ];
    const access: ProductionIncidentsAccess = {
      createFollowUp: () => Promise.resolve(null),
      detail: () => Promise.resolve(null),
      overview: () => Promise.resolve(null),
      previewFollowUp: () => Promise.resolve(null),
      setLink: () => Promise.resolve(null),
    };
    expect(Object.keys(access).sort()).toEqual(members);
  });

  test("follow-up creation needs the preview fingerprint and takes no status, Bug or Risk field", () => {
    const create = {
      baseRevision: 0,
      clientIdempotencyKey: "key-1",
      incidentId: "incident-1",
      previewFingerprint: "abc",
      projectId: "project-1",
      title: "Add a canary",
      workId: "work-9",
      workType: "Task",
    };
    expect(
      createProductionIncidentFollowUpInputSchema.safeParse(create).success,
    ).toBe(true);
    const { previewFingerprint: _omitted, ...withoutPreview } = create;
    expect(
      createProductionIncidentFollowUpInputSchema.safeParse(withoutPreview)
        .success,
    ).toBe(false);
    expect(
      createProductionIncidentFollowUpInputSchema.safeParse({
        ...create,
        previewFingerprint: "",
      }).success,
    ).toBe(false);
    for (const extra of [
      { status: "Resolved" },
      { createBug: true },
      { createRisk: true },
      { workType: "Feature" },
    ]) {
      expect(
        createProductionIncidentFollowUpInputSchema.safeParse({
          ...create,
          ...extra,
        }).success,
      ).toBe(false);
    }
    expect(
      previewProductionIncidentFollowUpInputSchema.safeParse({
        incidentId: "incident-1",
        projectId: "project-1",
        title: "Add a canary",
        workType: "Bug",
      }).success,
    ).toBe(true);
    expect(PRODUCTION_INCIDENT_FOLLOW_UP_LABEL).toBe("Create follow-up work");
  });

  test("groups by status in the catalog order and lists attached links by type", () => {
    const groups = groupProductionIncidentsByStatus([
      { incident: { status: "Resolved" as const } },
      { incident: { status: "Open" as const } },
      { incident: { status: "Open" as const } },
    ]);
    expect(
      groups.map((group) => [group.status, group.incidents.length]),
    ).toEqual([
      ["Open", 2],
      ["Resolved", 1],
    ]);
    const links: ProductionIncidentLink[] = [
      {
        attached: true,
        id: "a",
        revision: 1,
        target: {
          id: "w",
          label: "TK-1",
          status: "Not Started",
          type: "Bug",
          unavailable: false,
        },
      },
      {
        attached: false,
        id: "b",
        revision: 2,
        target: {
          id: "r",
          label: "Risk",
          status: "Open",
          type: "Risk",
          unavailable: false,
        },
      },
    ];
    expect(
      attachedProductionIncidentLinks(links).map((link) => link.id),
    ).toEqual(["a"]);
    expect(attachedProductionIncidentLinks(links, "Risk")).toEqual([]);
  });
});
