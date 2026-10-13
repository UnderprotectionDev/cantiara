import type { Document } from "@cantiara/api/documents";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import DocumentNavigation from "./document-navigation";

const selectDocument = () => null;

const documents: Document[] = [
  {
    id: "child",
    projectId: "project",
    title: "Child",
    body: "",
    type: "General",
    revision: 1,
    createdAt: "",
    updatedAt: "",
    parentDocumentId: "root",
    folder: "Planning",
  },
  {
    id: "root",
    projectId: "project",
    title: "Root",
    body: "",
    type: "General",
    revision: 1,
    createdAt: "",
    updatedAt: "",
    parentDocumentId: null,
    folder: "Planning",
  },
];

test("groups Documents by Folder and renders parent before child without changing identity", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={documents}
      onSelect={selectDocument}
      selectedId={null}
    />,
  );
  expect(markup).toContain("Planning");
  expect(markup.indexOf(">Root<")).toBeLessThan(markup.indexOf(">Child<"));
  expect(markup).toContain('data-depth="2"');
});

test("keeps a visible child navigable when its parent is absent from the Archive-filtered list", () => {
  const markup = renderToStaticMarkup(
    <DocumentNavigation
      documents={documents.slice(0, 1)}
      onSelect={selectDocument}
      selectedId="child"
    />,
  );
  expect(markup).toContain(">Child<");
  expect(markup).toContain('aria-current="page"');
});
