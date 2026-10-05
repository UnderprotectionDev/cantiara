import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  draftValues,
  WorkTypeField,
  workDraftInitialValues,
} from "./work-draft-form";

const collectionMissWarning =
  "This Work may not appear in this Smart Collection.";

const savedDraft = {
  checklist: [],
  createdAt: "2026-10-04T08:00:00.000Z",
  customFieldValues: [],
  description: "Broken checkout flow",
  id: "draft-1",
  projectId: "project-1",
  revision: 3,
  title: "Fix checkout",
  type: "Bug" as const,
  updatedAt: "2026-10-04T09:00:00.000Z",
};

describe("Work Draft New work prefill seam", () => {
  test("prefills the Type field from the Smart Collection equality", () => {
    expect(workDraftInitialValues("Bug")).toEqual({
      customFieldValues: [],
      description: "",
      title: "",
      type: "Bug",
    });
  });

  test("keeps the default Work type when New work carries no type", () => {
    expect(workDraftInitialValues().type).toBe("Task");
  });

  test("renders the miss warning with status semantics for screen readers", () => {
    const markup = renderToStaticMarkup(
      WorkTypeField({
        disabled: false,
        onChange: () => undefined,
        value: "Task",
        warning: collectionMissWarning,
      }),
    );

    expect(markup).toContain("Type");
    expect(markup).toContain('aria-describedby="work-draft-type-warning"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain(collectionMissWarning);
  });

  test("omits the warning reference when the Work matches the collection", () => {
    const markup = renderToStaticMarkup(
      WorkTypeField({
        disabled: true,
        onChange: () => undefined,
        value: "Bug",
        warning: null,
      }),
    );

    expect(markup).toContain("Bug");
    expect(markup).not.toContain("work-draft-type-warning");
  });

  test("Resume restores the saved Draft type from the Draft values", () => {
    expect(draftValues(savedDraft).type).toBe("Bug");
    expect(draftValues(savedDraft).title).toBe("Fix checkout");
  });
});
