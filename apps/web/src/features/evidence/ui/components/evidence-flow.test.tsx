import type { EvidenceFlowRow } from "@cantiara/api/document-evidence";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import EvidenceFlow from "./evidence-flow";

const noop = vi.fn();

function row(
  id: string,
  overrides: Partial<EvidenceFlowRow> = {},
): EvidenceFlowRow {
  return {
    id,
    sourceType: "Document",
    pin: {
      source: {
        recordType: "Document",
        recordId: "doc",
        projectId: "project",
        revision: 2,
        componentId: null,
      },
      start: 0,
      end: 5,
      excerpt: "local",
      before: "",
      after: "",
    },
    role: "Supporting",
    interpretation: null,
    source: {
      recordId: "doc",
      projectId: "project",
      title: "Pricing notes",
      brokenReason: null,
      canOpenSourceRecord: true,
    },
    elementMissing: false,
    newerVersionExists: false,
    relatedAt: "2026-01-02T10:00:00.000Z",
    ...overrides,
  };
}

test("lists explicit evidence in order as an accessible list with separate facts", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow
      onSourceTypeChange={noop}
      rows={[
        row("a", { interpretation: "Looks thin" }),
        row("b", { sourceType: "Source", role: "Unspecified" }),
      ]}
      sourceType={null}
    />,
  );
  expect(html).toContain("Evidence Flow");
  expect(html).toContain("<ol");
  expect(html.indexOf("Looks thin")).toBeLessThan(html.indexOf("Unspecified"));
  expect(html).toContain("Evidence Role: Supporting");
  expect(html).toContain("Founder interpretation: Looks thin");
  expect(html).toContain("Version 2");
  expect(html).toContain("<p>Evidence <time");
  expect(html).not.toContain("Related");
  expect(html).toContain(
    '<a href="/projects/project#document-doc">Open source record</a>',
  );
  for (const word of ["score", "majority", "recommend", "theme", "Insight"]) {
    expect(html).not.toContain(word);
  }
});

test("offers a source type filter and shows an empty state without inventing rows", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow onSourceTypeChange={noop} rows={[]} sourceType="Source" />,
  );
  expect(html).toContain("Source type");
  expect(html).toContain("No explicit evidence");
  expect(html).not.toContain("<ol");
});

test("shows Archived and a safe broken reference without content", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow
      onSourceTypeChange={noop}
      rows={[
        row("a", {
          source: {
            recordId: "doc",
            projectId: "project",
            title: "Old",
            brokenReason: "Archived",
            canOpenSourceRecord: true,
          },
        }),
        row("b", {
          pin: null,
          role: null,
          source: {
            recordId: "gone",
            projectId: null,
            title: null,
            brokenReason: "In Trash",
            canOpenSourceRecord: false,
          },
        }),
      ]}
      sourceType={null}
    />,
  );
  expect(html).toContain("<p>Archived</p>");
  expect(html).toContain("In Trash");
  expect(html).toContain("Unavailable source");
  expect(html).not.toContain("local</p>Evidence Role: null");
  expect(html.match(/Open source record/g)?.length).toBe(1);
});

test("names a missing owned component without retargeting or leaking text", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow
      onSourceTypeChange={noop}
      rows={[
        row("a", {
          sourceType: "Research Session",
          pin: null,
          role: null,
          elementMissing: true,
          source: {
            recordId: "session",
            projectId: "project",
            title: "Interview 4",
            brokenReason: null,
            canOpenSourceRecord: true,
          },
        }),
      ]}
      sourceType={null}
    />,
  );
  expect(html).toContain("Source element no longer exists");
  expect(html).toContain("Research Session: Interview 4");
  expect(html).not.toContain("Evidence Role");
  expect(html).not.toContain("Open source record");
});

test("opens only Document records, because Source and Research Session have no exact-record route yet", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow
      onSourceTypeChange={noop}
      rows={[
        row("a", {
          sourceType: "Source",
          pin: null,
          role: null,
          source: {
            recordId: "source",
            projectId: "project",
            title: "Pricing page",
            brokenReason: null,
            canOpenSourceRecord: true,
          },
        }),
      ]}
      sourceType={null}
    />,
  );
  expect(html).toContain("Pricing page");
  expect(html).not.toContain("Open source record");
});

test("shows a loading status instead of the empty message before rows arrive", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlow
      onSourceTypeChange={noop}
      rows={undefined}
      sourceType={null}
    />,
  );
  expect(html).toContain('role="status">Loading Evidence Flow…');
  expect(html).not.toContain("No explicit evidence");
  expect(html).not.toContain("<ol");
});
