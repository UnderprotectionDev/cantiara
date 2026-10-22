// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ResearchSessionNoteEditor } from "../research-session-note-form";

const cancel = () => undefined;
const save = async () => undefined;

test("Research Sessions requires an explicit note type and explains each kind without a mixed body", () => {
  const html = renderToStaticMarkup(
    <ResearchSessionNoteEditor
      consent="Not allowed"
      onCancel={cancel}
      onSave={save}
    />,
  );
  expect(html).toContain("Choose note type");
  expect(html).toContain("Participant quote");
  expect(html).toContain("Observation");
  expect(html).toContain("Founder interpretation");
  expect(html).not.toContain("<textarea");
});
