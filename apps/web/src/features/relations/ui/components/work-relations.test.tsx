import type { RelationView, UsedInSummary } from "@cantiara/api/relations";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { RelationsContent } from "./work-relations";

const sourceEndpoint = {
  broken: null,
  key: "REL-1",
  label: "REL-1",
  originPosition: null,
  projectId: "project-1",
  recordId: "source-1",
  recordType: "Work" as const,
  title: "Source record",
};

const relationBacklink: RelationView = {
  createdAt: "2026-09-20T09:00:00.000Z",
  direction: "incoming",
  id: "relation-1",
  inverseLabel: "Related",
  kind: "Related",
  label: "Related",
  revision: 0,
  source: sourceEndpoint,
  target: {
    ...sourceEndpoint,
    key: "REL-2",
    label: "REL-2",
    recordId: "current-1",
    title: "Current record",
  },
};

const usedIn: UsedInSummary = {
  relationBacklinks: [relationBacklink],
  usageLinks: [
    {
      createdAt: "2026-09-20T09:01:00.000Z",
      id: "usage-1",
      kind: "Live block",
      source: {
        recordId: "current-1",
        recordType: "Work",
      },
      surface: {
        ...sourceEndpoint,
        key: "REL-3",
        label: "REL-3",
        recordId: "surface-1",
        title: "Containing record",
      },
    },
  ],
};

const ignoreRemove = () => null;

describe("Used in relations surface", () => {
  test("keeps backlinks and usage links in separate groups with source links", () => {
    const html = renderToStaticMarkup(
      <RelationsContent
        isError={false}
        isPending={false}
        onRemove={ignoreRemove}
        outgoing={[]}
        removePending={false}
        usedIn={usedIn}
        workId="current-1"
      />,
    );

    expect(html).toContain(">Used in</h5>");
    expect(html).toContain(">Relations</h5>");
    expect(html).toContain(">Usage links</h6>");
    expect(html).toContain('href="#work-source-1"');
    expect(html).toContain('href="#work-surface-1"');
    expect(html.match(/Open source record/g)).toHaveLength(2);
    expect(html).not.toContain("Usage links</h5>");
  });
});
