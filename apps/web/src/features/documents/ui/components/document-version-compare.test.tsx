import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import DocumentVersionCompare from "./document-version-compare";

const ignoreRestore = vi.fn();

test("compares a selected Document version with the current version", () => {
  const markup = renderToStaticMarkup(
    <DocumentVersionCompare
      current={{
        revision: 2,
        title: "Revised",
        type: "Spec",
        body: "# Changed\nNew text\n",
      }}
      onRestore={ignoreRestore}
      pending={false}
      selected={{
        revision: 1,
        title: "Original",
        type: "Plan",
        body: "# Original\nOld text\n",
      }}
      unsavedChanges={false}
    />,
  );

  expect(markup).toContain("Version 1 → Version 2");
  expect(markup).toContain("Original → Revised");
  expect(markup).toContain("Plan → Spec");
  expect(markup).toContain("- # Original");
  expect(markup).toContain("+ # Changed");
  expect(markup).toContain("Restore");
});
