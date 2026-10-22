import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import AddWorkForm from "../prioritization-session-add-work-form";

const SUBMIT_DISABLED =
  /<button(?=[^>]*disabled)(?=[^>]*type="submit")[^>]*>(Add Work|Save note)/;

describe("Prioritization session add Work form", () => {
  test("renders the labelled select, options and a disabled Add Work submit", () => {
    const html = renderToStaticMarkup(
      createElement(AddWorkForm, {
        addableWorks: [{ id: "w1", key: "W-1", title: "Ship" } as WorkProfile],
        busy: false,
        onAddWork: () => undefined,
        sessionId: "s1",
      }),
    );
    expect(html).toContain("Work to add");
    expect(html).toContain('id="add-work-s1"');
    expect(html).toContain("Select Work");
    expect(html).toContain("W-1 Ship");
    expect(html).toMatch(SUBMIT_DISABLED);
  });
});
