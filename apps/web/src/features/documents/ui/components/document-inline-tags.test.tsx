import type { DocumentInlineTag } from "@cantiara/api/documents";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import DocumentInlineTags from "./document-inline-tags";

const tags: DocumentInlineTag[] = [
  { tagId: "release-tag", name: "release", start: 0, end: 8 },
];

const ignoreSelection = vi.fn();

function renderTags(body: string) {
  return renderToStaticMarkup(
    <DocumentInlineTags
      body={body}
      onSelect={ignoreSelection}
      savedBody="#release"
      tags={tags}
    />,
  );
}

test("disables Tags buttons while the current Document body is unsaved", () => {
  expect(renderTags("#release draft")).toContain('disabled=""');
});

test("enables Tags buttons when the current Document body is saved", () => {
  expect(renderTags("#release")).not.toContain('disabled=""');
});
