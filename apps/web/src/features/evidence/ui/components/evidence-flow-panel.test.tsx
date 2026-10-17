import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import EvidenceFlowPanel from "./evidence-flow-panel";

test("keeps Evidence Flow collapsed and unqueried until the founder opens it", () => {
  const html = renderToStaticMarkup(
    <EvidenceFlowPanel projectId="project" recordId="work" type="Work" />,
  );
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("Evidence Flow");
  expect(html).not.toContain("<section");
  expect(html).not.toContain("Loading Evidence Flow");
});
