import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProductionIncidentDetail as Detail } from "@cantiara/api/production-incidents";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProductionIncidentDetail } from "../production-incident-detail";

const FORBIDDEN_COPY =
  /on-call|status page|downtime|\bTTR\b|\bTTD\b|\bTTI\b|reliability|Create follow-up work/i;

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const noop = async () => undefined;
const actions = {
  onAddLink: noop,
  onChangeStatus: noop,
  onRemoveLink: noop,
  onSave: noop,
};

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    candidates: [
      {
        id: "risk-2",
        label: "Data loss",
        status: "Open",
        type: "Risk",
        unavailable: false,
      },
    ],
    incident: {
      createdAt: "2026-10-20T10:00:00.000Z",
      detectedHow: "Customer email",
      id: "incident-1",
      impact: "Checkout failed for 20 minutes",
      learning: "Add a canary",
      occurredAt: "2026-10-19T08:00:00.000Z",
      projectId: "project-1",
      resolution: null,
      revision: 2,
      rootCause: "Pool exhausted",
      sourceType: "Production Incident",
      status: "Watching",
      title: "Checkout outage",
      updatedAt: "2026-10-20T10:00:00.000Z",
    },
    links: [
      {
        attached: true,
        id: "link-1",
        revision: 1,
        target: {
          id: "work-1",
          label: "TK-1 Checkout 500s",
          status: "In Progress",
          type: "Bug",
          unavailable: false,
        },
      },
      {
        attached: true,
        id: "link-2",
        revision: 1,
        target: {
          id: "pr-1",
          label: "tidekit#42 Fix checkout",
          status: "merged",
          type: "GitHub PR",
          unavailable: false,
        },
      },
      {
        attached: false,
        id: "link-3",
        revision: 2,
        target: {
          id: "risk-1",
          label: "Removed risk",
          status: "Open",
          type: "Risk",
          unavailable: false,
        },
      },
    ],
    readOnly: false,
    ...overrides,
  };
}

function render(value: Detail) {
  return renderToStaticMarkup(
    <ProductionIncidentDetail
      actions={actions}
      detail={value}
      formatting={DEFAULT_ACCOUNT_PREFERENCES}
      projectId="project-1"
    />,
  );
}

describe("Production Incident detail", () => {
  test("shows the timeline fields, the three statuses and the linked records read-only", () => {
    const html = render(detail());
    for (const text of [
      "Production Incident",
      "Checkout outage",
      "Occurred at",
      "Impact",
      "Detected how",
      "Resolution",
      "Root cause",
      "Learning",
      "Checkout failed for 20 minutes",
      "Pool exhausted",
      "Open",
      "Watching",
      "Resolved",
      "TK-1 Checkout 500s",
      "In Progress",
      "tidekit#42 Fix checkout",
      "Link record",
      "Edit incident",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("Removed risk");
    expect(html).toContain("#work-work-1");
  });

  test("states that status and links change no other record, and offers no follow-up or paging", () => {
    const html = render(detail());
    expect(html).toContain("pages no one and changes no linked");
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });

  test("an archived Project hides every write control", () => {
    const html = render(detail({ readOnly: true }));
    expect(html).not.toContain("Edit incident");
    expect(html).not.toContain("Link record");
    expect(html).not.toContain("Remove link");
    expect(html).toContain("Checkout outage");
  });

  test("an archived or trashed target stays listed without its content", () => {
    const html = render(
      detail({
        links: [
          {
            attached: true,
            id: "link-1",
            revision: 1,
            target: {
              id: "work-1",
              label: null,
              status: null,
              type: "Bug",
              unavailable: true,
            },
          },
        ],
      }),
    );
    expect(html).toContain("Unavailable record");
    expect(html).not.toContain("TK-1");
  });
});
