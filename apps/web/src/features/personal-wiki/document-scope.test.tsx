import type { Document } from "@cantiara/api/documents";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import DocumentNavigation from "@/features/documents/ui/components/document-navigation";
import { documentsInScope } from "./document-scope";

const documents: Document[] = [
  {
    id: "wiki-document",
    projectId: null,
    title: "Connection recovery",
    body: "",
    type: "General",
    revision: 1,
    createdAt: "",
    updatedAt: "",
    folder: "Troubleshooting",
    parentDocumentId: null,
  },
  {
    id: "project-document",
    projectId: "project-one",
    title: "Connection recovery",
    body: "",
    type: "General",
    revision: 1,
    createdAt: "",
    updatedAt: "",
    folder: "Troubleshooting",
    parentDocumentId: null,
  },
  {
    id: "other-project-document",
    projectId: "project-two",
    title: "Incident review",
    body: "",
    type: "General",
    revision: 1,
    createdAt: "",
    updatedAt: "",
    folder: "Troubleshooting",
    parentDocumentId: null,
  },
];

const selectDocument = () => null;

test("mixed Document results retain a scope badge and separate homes even with identical titles and Folders", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={documents}
      onSelect={selectDocument}
      selectedId={null}
    />,
  );
  const rows = markup.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
  expect(rows).toHaveLength(3);
  expect(rows[0]).toContain(">Personal Wiki<");
  expect(rows[1]).toContain(">Project: project-one<");
  expect(rows[2]).toContain(">Project: project-two<");
  expect(markup.match(/>Troubleshooting</g)).toHaveLength(3);
  expect(markup).toContain('data-document-id="wiki-document"');
  expect(markup).toContain('data-document-id="project-document"');
});

test("scope is an accessible description without replacing the Document title or selection identity", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={documents.slice(0, 1)}
      onSelect={selectDocument}
      selectedId="wiki-document"
    />,
  );
  expect(markup).toContain('aria-describedby="document-scope-wiki-document"');
  expect(markup).toContain('id="document-scope-wiki-document"');
  expect(markup).toContain('aria-current="page"');
  expect(markup).toContain(">Connection recovery</button>");
});

test("Personal Wiki and exact Project filters preserve existing Document identities and exclude other homes", () => {
  expect(documentsInScope(documents, { kind: "wiki" })).toEqual([documents[0]]);
  expect(
    documentsInScope(documents, { kind: "project", projectId: "project-one" }),
  ).toEqual([documents[1]]);
  expect(
    documentsInScope(documents, { kind: "project", projectId: "missing" }),
  ).toEqual([]);
  expect(documentsInScope(documents, { kind: "all" })).toEqual(documents);
  expect(documentsInScope(documents, { kind: "wiki" })[0]).toBe(documents[0]);
});

test("a temporary Project-filtered view excludes Wiki and other Projects rather than presenting a shared home", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={documents}
      onSelect={selectDocument}
      scope={{ kind: "project", projectId: "project-one" }}
      selectedId={null}
    />,
  );
  expect(markup).toContain('data-document-id="project-document"');
  expect(markup).not.toContain('data-document-id="wiki-document"');
  expect(markup).not.toContain('data-document-id="other-project-document"');
});

test("a parent reference in another scope cannot turn a Wiki Document into a Project child", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={[
        { ...documents[0], parentDocumentId: "project-document" },
        documents[1],
      ]}
      onSelect={selectDocument}
      selectedId={null}
    />,
  );
  const rows = markup.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
  const wikiRow = rows.find((row) =>
    row.includes('data-document-id="wiki-document"'),
  );
  expect(wikiRow).toContain('data-depth="1"');
  expect(wikiRow).toContain(">Personal Wiki<");
  expect(markup).not.toContain('data-depth="2"');
});
