import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { RelationView } from "@cantiara/api/relations";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BlockerResolutionSummary } from "./work-relations";

describe("Work Relations blocker history", () => {
  test("distinguishes an undone reactivation from its restored resolution date", () => {
    const undoAt = "2026-09-23T12:00:00.000Z";
    const resolutionAt = "2026-09-22T09:30:00.000Z";
    const relation = {
      blockingHistory: [
        {
          id: "created",
          isUndo: false,
          note: null,
          occurredAt: "2026-09-21T08:00:00.000Z",
          resolutionAt: null,
          status: "Active",
        },
        {
          id: "resolved",
          isUndo: false,
          note: "Provider access is verified",
          occurredAt: resolutionAt,
          resolutionAt,
          status: "Resolved",
        },
        {
          id: "reactivated",
          isUndo: false,
          note: null,
          occurredAt: "2026-09-23T11:00:00.000Z",
          resolutionAt: null,
          status: "Active",
        },
        {
          id: "undo-reactivation",
          isUndo: true,
          note: "Provider access is verified",
          occurredAt: undoAt,
          resolutionAt,
          status: "Resolved",
        },
      ],
      blockingResolutionNote: "Provider access is verified",
      blockingResolvedAt: resolutionAt,
      blockingStatus: "Resolved",
      kind: "Blocks",
    } satisfies Pick<
      RelationView,
      | "blockingHistory"
      | "blockingResolutionNote"
      | "blockingResolvedAt"
      | "blockingStatus"
      | "kind"
    >;
    const html = renderToStaticMarkup(
      createElement(BlockerResolutionSummary, {
        formattingPreferences: DEFAULT_ACCOUNT_PREFERENCES,
        relation,
      }),
    );

    expect(html).toContain("Undo · Resolved");
    expect(html).toContain("Resolution date");
    expect(html).toContain(`dateTime="${undoAt}"`);
    expect(html).toContain(`dateTime="${resolutionAt}"`);
    expect(html).toContain("Provider access is verified");
  });
});
