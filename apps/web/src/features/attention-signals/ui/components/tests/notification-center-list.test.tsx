import type { NotificationCenter } from "@cantiara/api/attention-signals";
import { deriveNotificationCenter } from "@cantiara/api/attention-signals";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import NotificationCenterList from "../notification-center-list";

const SAVED_QUEUE = /Saved|Bookmark|Inbox/i;

const stored = (signalId: string, eventId: string) =>
  ({
    closedAt: null,
    eventId,
    group: { id: "work-1", kind: "Work" },
    id: eventId,
    occurredAt: "2026-10-27T09:00:00.000Z",
    projectId: null,
    readAt: null,
    reason: `Reason of ${signalId}`,
    signalId,
    targetId: "work-1",
  }) as never;

const render = (center: NotificationCenter) =>
  renderToStaticMarkup(<NotificationCenterList center={center} />);

describe("Notification Center list", () => {
  test("opens Action Required and leaves Information Flow closed", () => {
    const html = render(
      deriveNotificationCenter([
        stored("work-blocked", "e1"),
        stored("github-activity", "e2"),
      ]),
    );
    const [action, flow] = html.split("<details").slice(1);
    expect(action).toContain(" open");
    expect(action).toContain("Action Required (1)");
    expect(action).toContain("work-blocked");
    expect(flow).not.toContain(" open");
    expect(flow).toContain("Information Flow (1)");
  });

  test("shows no inbox, saved queue or completeness claim", () => {
    const html = render(deriveNotificationCenter([]));
    expect(html).toContain("No signals in Action Required.");
    expect(html).toContain("does not claim to show everything");
    expect(html).not.toMatch(SAVED_QUEUE);
  });
});
