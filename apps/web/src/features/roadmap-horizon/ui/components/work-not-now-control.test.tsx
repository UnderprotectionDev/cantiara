import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { WorkNotNowTrail } from "@cantiara/api/work-not-now";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellProvider } from "@/features/web-macos-client/ui/components/client-shell";
import {
  initialNotNowDialogMode,
  NotNowEntryForm,
  NotNowHistoryPanel,
  default as WorkNotNowControl,
} from "./work-not-now-control";

const RECONSIDERING_BUTTON = /<button[^>]*>Reconsidering<\/button>/;

const activeTrail: WorkNotNowTrail = {
  closedAt: null,
  closedBy: null,
  closedByAccountId: null,
  condition: "After another customer interview.",
  createdAt: "2026-09-26T08:00:00.000Z",
  createdByAccountId: "account-1",
  grounds: [],
  id: "trail-1",
  reason: "The problem needs more evidence.",
  revision: 1,
  status: "Active",
  workId: "work-1",
};

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-22T09:05:00.000Z",
  description: "Validate the customer problem.",
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAT-1",
  notNow: { activeTrail, revision: 1 },
  number: 1,
  plannedStartDate: null,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  reappearDate: null,
  revision: 3,
  status: "In Progress",
  statusChangedAt: "2026-09-22T09:05:00.000Z",
  targetDate: null,
  title: "Validate the customer problem",
  type: "Research",
  updatedAt: "2026-09-22T09:05:00.000Z",
};

function renderControl(profile: WorkProfile, compact = true) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        ClientShellProvider,
        { shell: createClientShell() },
        createElement(WorkNotNowControl, { compact, work: profile }),
      ),
    ),
  );
}

function renderHistoryPanel() {
  return renderToStaticMarkup(
    createElement(NotNowHistoryPanel, {
      activeFromWork: activeTrail,
      archived: false,
      canStart: true,
      connection: "online",
      currentTrail: activeTrail,
      history: [activeTrail],
      historyError: false,
      historyPending: false,
      onReconsider: vi.fn(),
      onStartNew: vi.fn(),
      reconsiderPending: false,
      reviewLaterHandling: "Keep Review later",
      onReviewLaterHandlingChange: vi.fn(),
      sources: [],
      workId: "work-1",
      workContextError: false,
    }),
  );
}

describe("Work Not now control", () => {
  test("shows an inspectable compact mark when the Work has an active trail", () => {
    const html = renderControl(work);

    expect(html).toContain(
      'aria-label="Not now: The problem needs more evidence."',
    );
    expect(html).toContain(">Not now</span>");
  });

  test("hides the compact mark when the Work has no active trail", () => {
    const html = renderControl({
      ...work,
      notNow: { activeTrail: null, revision: 0 },
    });

    expect(html).not.toContain("Not now");
  });

  test("shows explicit Review Later handling choices before reconsidering", () => {
    const html = renderHistoryPanel();

    expect(html).toContain("Keep Review later");
    expect(html).toContain("Remove Review later");
    expect(html).toContain(
      "Preview: Planned Review Later reminders will stay scheduled.",
    );
    expect(html).toContain("Reconsidering");
  });

  test("shows closed history and a start action when no trail is active", () => {
    const closedTrail: WorkNotNowTrail = {
      ...activeTrail,
      closedAt: "2026-09-27T08:00:00.000Z",
      closedBy: "Reconsidering",
      closedByAccountId: "account-1",
      revision: 2,
      status: "Reconsidered",
    };
    const html = renderToStaticMarkup(
      createElement(NotNowHistoryPanel, {
        activeFromWork: null,
        archived: false,
        canStart: true,
        connection: "online",
        currentTrail: null,
        history: [closedTrail],
        historyError: false,
        historyPending: false,
        onReconsider: vi.fn(),
        onStartNew: vi.fn(),
        reconsiderPending: false,
        reviewLaterHandling: "Keep Review later",
        onReviewLaterHandlingChange: vi.fn(),
        sources: [],
        workId: "work-1",
        workContextError: false,
      }),
    );

    expect(html).toContain("The problem needs more evidence.");
    expect(html).toContain("Not now");
    expect(html).not.toMatch(RECONSIDERING_BUTTON);
  });

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

  test("keeps a history entry point on closed or archived Work", () => {
    const historicalNotNow = { activeTrail: null, revision: 2 };
    const closedWork = renderControl(
      { ...work, notNow: historicalNotNow, status: "Closed" },
      false,
    );
    const archivedWork = renderControl(
      {
        ...work,
        archivedAt: "2026-09-27T08:00:00.000Z",
        notNow: historicalNotNow,
        status: "Closed",
      },
      false,
    );

    expect(closedWork).toContain('aria-label="Not now"');
    expect(archivedWork).toContain('aria-label="Not now"');
  });

  test("opens history instead of the entry form when Work cannot start a trail", () => {
    expect(initialNotNowDialogMode(false, false)).toBe("details");
    expect(initialNotNowDialogMode(false, true)).toBe("details");
    expect(initialNotNowDialogMode(true, false)).toBe("form");
    expect(initialNotNowDialogMode(true, true)).toBe("details");
  });
});
