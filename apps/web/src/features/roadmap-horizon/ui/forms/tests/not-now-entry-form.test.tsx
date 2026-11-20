import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { useNotNowEntryForm } from "../../../hooks/use-not-now-entry-form";
import { NotNowEntryForm } from "../not-now-entry-form";

describe("Not now entry form", () => {
  function Fixture() {
    const form = useNotNowEntryForm(
      2,
      "work-1",
      vi.fn(),
      "Remove Review later",
    );
    return createElement(NotNowEntryForm, {
      form,
      connection: "online",
      error: null,
      hasActiveTrail: true,
      hasHistory: true,
      groundOptions: [],
      onShowHistory: vi.fn(),
      pending: false,
      workContextError: false,
      workContextPending: false,
      workId: "work-1",
    });
  }

  test("offers History from the entry form when a previous trail exists", () => {
    const html = renderToStaticMarkup(createElement(Fixture));

    expect(html).toContain("History");
    expect(html).toContain("Preview");
    expect(html).toContain("Remove Review later");
    expect(html).toContain(
      "Preview: Planned Review Later reminders for this Work will be cancelled.",
    );
  });
});
