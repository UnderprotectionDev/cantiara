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

test("browses document metadata without presenting it as a text search hit", () => {
  const markup = renderToStaticMarkup(
    <UniversalSearchResults
      index="All Documents"
      query=""
      results={[
        {
          ...result,
          category: "Plan",
          folder: "Engineering",
          matchCount: 0,
          recordType: "Document",
          snippet: "hidden document body",
          title: "Engineering plan",
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="All Documents"');
  expect(markup).toContain("Plan");
  expect(markup).toContain("Folder: Engineering");
  expect(markup).toContain("Open source record");
  expect(markup).not.toContain("hidden document body");
  expect(markup).not.toContain("0 matches");
});

test("browses file metadata without presenting it as a text search hit", () => {
  const markup = renderToStaticMarkup(
    <UniversalSearchResults
      index="All Files"
      query=""
      results={[
        {
          ...result,
          archived: false,
          category: "pdf",
          fileMimeType: "application/pdf",
          fileName: "runbook-v2.pdf",
          folder: "Engineering",
          matchCount: 0,
          ownerDocumentId: "document-1",
          recordType: "File Attachment",
          snippet: "runbook-v2.pdf application/pdf",
          title: "Runbook",
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="All Files"');
  expect(markup).toContain("application/pdf");
  expect(markup).toContain("runbook-v2.pdf");
  expect(markup).toContain("Folder: Engineering");
  expect(markup).toContain("Open source record");
  expect(markup).not.toContain("runbook-v2.pdf application/pdf");
  expect(markup).not.toContain("0 matches");
});

test("browses technical diagram type and authority mode distinctly", () => {
  const markup = renderToStaticMarkup(
    <UniversalSearchResults
      index="All Technical Diagrams"
      query=""
      results={[
        {
          ...result,
          authorityMode: "Product-authored Model",
          category: "Data Model",
          matchCount: 0,
          recordType: "Technical Diagram",
          snippet: "secret generated SQL body",
          title: "Workspace data model",
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="All Technical Diagrams"');
  expect(markup).toContain("Data Model");
  expect(markup).toContain("Product-authored Model");
  expect(markup).not.toContain("secret generated SQL body");
  expect(markup).not.toContain("0 matches");
});
