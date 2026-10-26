import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProductionIncidentSummary } from "@cantiara/api/production-incidents";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProductionIncidentList } from "../production-incident-list";

const FORBIDDEN_COPY =
  /on-call|status page|downtime|\bTTR\b|\bTTD\b|\bTTI\b|reliability|trend/i;

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

function summary(
  title: string,
  status: ProductionIncidentSummary["incident"]["status"],
  linkCount = 0,
): ProductionIncidentSummary {
  return {
    incident: {
      createdAt: "2026-10-20T10:00:00.000Z",
      detectedHow: null,
      id: `incident-${title}`,
      impact: null,
      learning: null,
      occurredAt: "2026-10-19T08:00:00.000Z",
      projectId: "project-1",
      resolution: null,
      revision: 1,
      rootCause: null,
      sourceType: "Production Incident",
      status,
      title,
      updatedAt: "2026-10-20T10:00:00.000Z",
    },
    linkCount,
  };
}

function render(incidents: ProductionIncidentSummary[], readOnly = false) {
  return renderToStaticMarkup(
    <ProductionIncidentList
      createControl={<button type="button">Record Production Incident</button>}
      formatting={DEFAULT_ACCOUNT_PREFERENCES}
      overview={{ incidents, readOnly }}
      projectId="project-1"
    />,
  );
}

describe("Production Incidents list", () => {
  test("groups incidents by Open, Watching and Resolved with time and link count", () => {
    const html = render([
      summary("Old outage", "Resolved", 2),
      summary("Queue delay", "Watching", 1),
      summary("Checkout outage", "Open"),
    ]);
    const order = ["Open", "Watching", "Resolved"].map((status) =>
      html.indexOf(`aria-label="${status}"`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const text of [
      "Production Incidents",
      "Record Production Incident",
      "2 linked records",
      "1 linked record",
      "0 linked records",
      "#source-production-incident-incident-Queue%20delay",
    ]) {
      expect(html).toContain(text);
    }
  });

  test("explains that the record is not a Bug and pages no one", () => {
    const html = render([]);
    expect(html).toContain("not a Bug");
    expect(html).toContain("pages no one");
  });

  test("shows no on-call, status page, timing or trend surface", () => {
    const html = render([summary("Checkout outage", "Open")]);
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });

  test("an archived Project is read-only without a create control", () => {
    const html = render([summary("Checkout outage", "Open")], true);
    expect(html).toContain("read-only");
    expect(html).not.toContain("Record Production Incident</button>");
  });
});
