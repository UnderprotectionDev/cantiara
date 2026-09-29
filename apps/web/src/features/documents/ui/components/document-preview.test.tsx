import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import DocumentPreview from "./document-preview";

test("renders CRLF Mermaid fences as Mermaid previews", () => {
  const source = "```mermaid\r\ngraph TD; A-->B;\r\n```\r\n";
  const markup = renderToStaticMarkup(<DocumentPreview source={source} />);

  expect(markup).toContain(
    "<code>```mermaid\ngraph TD; A--&gt;B;\r\n```</code>",
  );
});
