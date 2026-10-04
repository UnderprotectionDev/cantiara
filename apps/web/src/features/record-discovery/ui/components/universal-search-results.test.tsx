import {
  type UniversalSearchResult,
  universalSearchRecordTypes,
} from "@cantiara/api/record-discovery";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import UniversalSearchResults from "./universal-search-results";

const result: UniversalSearchResult = {
  archived: false,
  category: null,
  closureResult: "Completed",
  id: "work-1",
  key: "CANT-1",
  matchCount: 2,
  ownerDocumentId: null,
  projectArchivedAt: null,
  projectId: "project-1",
  projectName: "Current Project",
  recordType: "Work",
  scopeName: "Current Project",
  scopeType: "Project",
  snippet: "PostgreSQL recovery from PostgreSQL errors",
  status: "Closed",
  title: "Repair PostgreSQL access",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

test("shows the source type, state, scope, highlighted context, and source link", () => {
  const markup = renderToStaticMarkup(
    <UniversalSearchResults query="PostgreSQL" results={[result]} />,
  );

  expect(markup).toContain("Work");
  expect(markup).toContain("Closed");
  expect(markup).toContain("Completed");
  expect(markup).toContain("Project: Current Project");
  expect(markup).toContain("<mark>PostgreSQL</mark>");
  expect(markup).toContain("2 matches");
  expect(markup).toContain('href="/projects/project-1#work-work-1"');
  expect(universalSearchRecordTypes).toContain("File Attachment");
});

test("renders result titles and matched context as escaped text", () => {
  const markup = renderToStaticMarkup(
    <UniversalSearchResults
      query="attack"
      results={[
        {
          ...result,
          snippet: "<script>alert(1)</script> attack",
          title: "<img src=x>",
        },
      ]}
    />,
  );

  expect(markup).toContain("&lt;img src=x&gt;");
  expect(markup).toContain(
    "&lt;script&gt;alert(1)&lt;/script&gt; <mark>attack</mark>",
  );
  expect(markup).not.toContain("<img");
  expect(markup).not.toContain("<script>");
});
