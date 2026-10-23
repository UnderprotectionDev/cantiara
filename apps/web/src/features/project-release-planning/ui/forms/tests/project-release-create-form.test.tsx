import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProjectReleaseCreateForm } from "../project-release-create-form";

const noop = async () => undefined;
const cancel = () => undefined;
const DATE_COPY = /publish date|target date/i;

describe("Create Project Release form", () => {
  test("asks for Name, Version label and Description, with no date field", () => {
    const html = renderToStaticMarkup(
      <ProjectReleaseCreateForm onCancel={cancel} onCreate={noop} />,
    );
    for (const id of [
      "project-release-name",
      "project-release-version-label",
      "project-release-description",
    ]) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html.match(/required=""/g)).toHaveLength(1);
    expect(html).toContain("Create Project Release");
    expect(html).toContain("Starts as Draft");
    expect(html).not.toContain('type="date"');
    expect(html).not.toMatch(DATE_COPY);
  });
});
