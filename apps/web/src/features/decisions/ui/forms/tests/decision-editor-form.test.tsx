import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DecisionEditor } from "../decision-editor-form";

const noop = () => undefined;
const save = async () => undefined;

test("Decision creation uses labelled title, decision text and optional rationale", () => {
  const html = renderToStaticMarkup(
    <DecisionEditor onCancel={noop} onSave={save} />,
  );
  expect(html).toContain('id="decision-title"');
  expect(html).toContain("Decision text");
  expect(html).toContain("Rationale");
  expect(html).toContain(">Save</button>");
  expect(html).toContain(">Cancel</button>");
  expect(html).not.toContain("Superseded");
});
