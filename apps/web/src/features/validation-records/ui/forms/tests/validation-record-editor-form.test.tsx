import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ValidationRecordEditor } from "../validation-record-editor-form";

const cancel = () => undefined;
const save = async () => undefined;

test("Validation Record editor labels its fields", () => {
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
});
