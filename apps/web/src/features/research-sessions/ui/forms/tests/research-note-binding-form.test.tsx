// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

const cancel = () => undefined;
const unexpectedPreview = () => Promise.reject(new Error("Unexpected preview"));

test("conversion requires an explicit target type before preview and never starts with Confirm", async () => {
  const { ResearchNoteBindingEditor } = await import(
    "../research-note-binding-form"
  );
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
