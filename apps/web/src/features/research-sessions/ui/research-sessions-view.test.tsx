// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ResearchSessionEditor } from "./research-sessions-view";

const cancel = () => undefined;
const save = async () => undefined;
test("Research Sessions shows four Consent choices, separate context and a consent gate explanation", () => {
  const html = renderToStaticMarkup(
    <ResearchSessionEditor
      onCancel={cancel}
      onSave={save}
      timeZone="Europe/Istanbul"
    />,
  );
  for (const label of [
    "Research Session",
    "Purpose",
    "Question guide",
    "Not asked",
    "Allowed",
    "Not allowed",
    "Not applicable",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain(
    "Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed.",
  );
  expect(html).toContain(
    "Consent is context, not a legal compliance judgment.",
  );
  expect(html).not.toContain("required Contact");
});
