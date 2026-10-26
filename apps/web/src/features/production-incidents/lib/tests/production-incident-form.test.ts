import { describe, expect, test } from "vitest";
import {
  EMPTY_PRODUCTION_INCIDENT_DRAFT,
  incidentTimeInput,
  incidentTimeInstant,
  PRODUCTION_INCIDENT_LINK_GROUPS,
  PRODUCTION_INCIDENT_TEXT_FIELDS,
  productionIncidentFormSchema,
  productionIncidentLinkHref,
  productionIncidentsHref,
} from "../production-incident-form";

const valid = {
  ...EMPTY_PRODUCTION_INCIDENT_DRAFT,
  occurredAt: "2026-10-19T08:30",
  title: "Checkout outage",
};

describe("Production Incident form schema", () => {
  test("needs a title and a time; the five texts are optional", () => {
    const parsed = productionIncidentFormSchema("UTC").parse({
      ...valid,
      impact: "  20 minutes of failed checkouts ",
    });
    expect(parsed).toMatchObject({
      detectedHow: null,
      impact: "20 minutes of failed checkouts",
      learning: null,
      resolution: null,
      rootCause: null,
      title: "Checkout outage",
    });
    expect(parsed.occurredAt).toBe(
      incidentTimeInstant("2026-10-19T08:30", "UTC"),
    );
    expect(
      productionIncidentFormSchema("UTC").safeParse({ ...valid, title: "  " })
        .success,
    ).toBe(false);
    expect(
      productionIncidentFormSchema("UTC").safeParse({
        ...valid,
        occurredAt: "",
      }).success,
    ).toBe(false);
    expect(
      productionIncidentFormSchema("UTC").safeParse({
        ...valid,
        occurredAt: "soon",
      }).success,
    ).toBe(false);
  });

  test("has no severity, duration, status or score field", () => {
    for (const extra of [
      { severity: "S1" },
      { duration: "20m" },
      { status: "Resolved" },
      { ttr: "20" },
    ]) {
      expect(
        productionIncidentFormSchema("UTC").safeParse({
          ...valid,
          ...extra,
        }).success,
      ).toBe(false);
    }
  });

  test("round-trips a stored instant through the datetime-local text in the Account zone", () => {
    const instant = "2026-10-19T08:30:00.000Z";
    for (const timeZone of ["UTC", "America/Los_Angeles", "Europe/Istanbul"]) {
      expect(
        incidentTimeInstant(incidentTimeInput(instant, timeZone), timeZone),
      ).toBe(instant);
    }
    expect(incidentTimeInput(instant, "America/Los_Angeles")).toBe(
      "2026-10-19T01:30",
    );
    expect(incidentTimeInput("not a time", "UTC")).toBe("");
    expect(incidentTimeInstant("soon", "UTC")).toBeNull();
  });

  test("labels the fields and the five linkable record types", () => {
    expect(PRODUCTION_INCIDENT_TEXT_FIELDS.map((field) => field.label)).toEqual(
      ["Impact", "Detected how", "Resolution", "Root cause", "Learning"],
    );
    expect(PRODUCTION_INCIDENT_LINK_GROUPS.map((group) => group.type)).toEqual([
      "Bug",
      "GitHub PR",
      "Project Release",
      "Risk",
      "Decision",
    ]);
  });

  test("links open the Project area, the Work or the source record; a GitHub PR has no page", () => {
    expect(productionIncidentsHref("p 1")).toBe(
      "/projects/p%201#project-area-production",
    );
    expect(productionIncidentsHref("p1", "i1")).toBe(
      "/projects/p1#source-production-incident-i1",
    );
    expect(productionIncidentLinkHref("p1", "Bug", "w1")).toBe(
      "/projects/p1#work-w1",
    );
    expect(productionIncidentLinkHref("p1", "Risk", "r1")).toBe(
      "/projects/p1#source-risk-r1",
    );
    expect(productionIncidentLinkHref("p1", "GitHub PR", "g1")).toBeNull();
  });
});
