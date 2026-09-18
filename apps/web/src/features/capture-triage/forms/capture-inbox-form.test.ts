import { describe, expect, test } from "vitest";

import { captureFormValuesEqual, captureInput } from "./capture-inbox-form";

describe("Capture Inbox form submission", () => {
  test("only treats an unchanged form as safe to reset after Save", () => {
    const submitted = {
      content: "Preview is blank",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture" as const,
    };

    expect(captureFormValuesEqual(submitted, submitted)).toBe(true);
    expect(
      captureFormValuesEqual(submitted, {
        ...submitted,
        content: "Preview is blank after refresh",
      }),
    ).toBe(false);
  });

  test("submits the selected Project id without asking for an internal value", () => {
    expect(
      captureInput(
        {
          content: "Preview is blank",
          fields: {},
          projectId: "project-1",
          template: "Bug Capture",
        },
        "capture-key-1",
      ),
    ).toMatchObject({
      clientIdempotencyKey: "capture-key-1",
      projectId: "project-1",
      template: "Bug Capture",
    });
  });
});
