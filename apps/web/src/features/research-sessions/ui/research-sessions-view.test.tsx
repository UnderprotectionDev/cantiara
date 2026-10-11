// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ResearchSessionNoteEditor } from "./research-session-notes";
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

const unexpectedPreview = () => Promise.reject(new Error("Unexpected preview"));

test("conversion requires an explicit target type before preview and never starts with Confirm", async () => {
  const { ResearchNoteBindingEditor } = await import("./research-note-binding");
  const html = renderToStaticMarkup(
    <ResearchNoteBindingEditor
      mode="create"
      note={{
        id: "q1",
        kind: "Participant quote",
        text: "Use CSV",
        speakerLabel: null,
        relationIds: [],
      }}
      onCancel={cancel}
      onConfirm={unexpectedPreview}
      onPreview={unexpectedPreview}
      record={{
        id: "session-1",
        projectId: "project-1",
        revision: 3,
        title: "CSV interview",
      }}
      targets={{
        projects: [{ id: "project-1", name: "Research" }],
        records: [],
      }}
    />,
  );
  expect(html).toContain("Choose target type");
  expect(html).toContain("Selected text");
  expect(html).not.toContain(">Confirm<");
});
