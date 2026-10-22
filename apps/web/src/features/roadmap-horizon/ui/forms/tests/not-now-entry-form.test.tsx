import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { NotNowEntryForm } from "../not-now-entry-form";

describe("Not now entry form", () => {
  test("offers History from the entry form when a previous trail exists", () => {
    const html = renderToStaticMarkup(
      createElement(NotNowEntryForm, {
        baseRevision: 2,
        connection: "online",
        draft: {
          condition: "",
          groundRelationIds: [],
          reason: "",
          reviewLaterHandling: "Remove Review later",
        },
        error: null,
        hasActiveTrail: true,
        hasHistory: true,
        groundOptions: [],
        onDraftChange: vi.fn(),
        onError: vi.fn(),
        onPreview: vi.fn(),
        onShowHistory: vi.fn(),
        pending: false,
        workContextError: false,
        workContextPending: false,
        workId: "work-1",
      }),
    );

    expect(html).toContain("History");
    expect(html).toContain("Preview");
    expect(html).toContain("Remove Review later");
    expect(html).toContain(
      "Preview: Planned Review Later reminders for this Work will be cancelled.",
    );
  });
});
