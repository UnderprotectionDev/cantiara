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

  test("offers open, read, close and a follow-up preview, and no Saved queue", () => {
    const html = renderToStaticMarkup(
      <NotificationCenterList
        actions={{
          onCreateFollowUp: () => undefined,
          onMark: () => undefined,
          onOpen: () => undefined,
          onPreviewFollowUp: () => undefined,
        }}
        center={deriveNotificationCenter([stored("work-blocked", "e1")])}
      />,
    );
    for (const label of [
      "Open source",
      "Mark read",
      "Close",
      "Create Follow-up Work",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(SAVED_QUEUE);
  });

  test("explains a missing exact event and shows the follow-up preview before apply", () => {
    const center = deriveNotificationCenter([stored("work-blocked", "e1")]);
    const signal = center.sections[0]?.groups[0]?.signals[0];
    const html = renderToStaticMarkup(
      <NotificationCenterList
        actions={{
          onCreateFollowUp: () => undefined,
          onMark: () => undefined,
          onOpen: () => undefined,
          onPreviewFollowUp: () => undefined,
        }}
        center={center}
        panels={{
          opened: {
            output: {
              explanation: "The exact source event e1 can no longer be found.",
              group: { id: "work-1", kind: "Work" },
              missingEventId: "e1",
              outcome: "record",
            },
            signalRowId: signal?.id ?? "",
          },
          preview: {
            fingerprint: "f",
            relations: [{ id: "e1", kind: "Notification", relation: "Origin" }],
            signalRowId: signal?.id ?? "",
            work: {
              description: "",
              projectId: "project-1",
              title: "Follow up: x",
              type: "Task",
            },
          },
        }}
      />,
    );
    expect(html).toContain("can no longer be found");
    expect(html).toContain("Origin: Notification e1");
    expect(html).toContain("The notification stays open");
    expect(html).toContain("Apply");
  });
});
