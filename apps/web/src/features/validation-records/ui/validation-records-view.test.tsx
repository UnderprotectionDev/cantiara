import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  ValidationRecordEditor,
  ValidationRecordsView,
} from "./validation-records-view";

const record = {
  sourceType: "Validation Record" as const,
  id: "v1",
  projectId: "p1",
  title: "Export interviews",
  method: "Interview five founders",
  result: "Four need CSV",
  context: [{ sourceType: "Assumption" as const, sourceId: "a1" }],
  status: "Active" as const,
  revision: 1,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
};
const cancel = () => undefined;
const save = async () => undefined;
test("Validation Records exposes method, result and keyboard-addressable context without a status outcome gate", () => {
  const html = renderToStaticMarkup(
    <ValidationRecordsView
      counterparts={[]}
      onSave={save}
      onTransition={save}
      readOnly={false}
      records={[record]}
      selectedId="v1"
    />,
  );
  expect(html).toContain("Interview five founders");
  expect(html).toContain("Four need CSV");
  expect(html).toContain("Record unavailable");
  expect(html).not.toContain("Confirmed");
  expect(html).not.toContain("Publish");
  expect(html).not.toContain("Survey");
});
test("Validation Record editor labels its fields and archived Projects hide writes", () => {
  const editor = renderToStaticMarkup(
    <ValidationRecordEditor
      counterparts={[]}
      onCancel={cancel}
      onSave={save}
    />,
  );
  expect(editor).toContain('for="validation-method"');
  expect(editor).toContain('for="validation-result"');
  expect(editor).toContain("Related");
  const archived = renderToStaticMarkup(
    <ValidationRecordsView
      counterparts={[]}
      onSave={save}
      onTransition={save}
      readOnly
      records={[record]}
    />,
  );
  expect(archived).not.toContain(">Create</button>");
  expect(archived).not.toContain(">Edit</button>");
});
