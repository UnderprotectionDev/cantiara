import type { NotificationCenter } from "@cantiara/api/attention-signals";
import { deriveNotificationCenter } from "@cantiara/api/attention-signals";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import NotificationCenterList from "../notification-center-list";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const SAVED_QUEUE = /Saved|Bookmark|Inbox/i;

const stored = (
  signalId: string,
  eventId: string,
  overrides: Record<string, unknown> = {},
) =>
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
    ...overrides,
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
    expect(html).toContain("No signals in this section.");
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
      "Mark as read",
      "Close",
      "Create Follow-up Work",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(SAVED_QUEUE);
  });

  test("explains a missing exact event and shows the follow-up preview before apply", () => {
    const center = deriveNotificationCenter([
      stored("work-blocked", "e1", { projectId: "project-1" }),
    ]);
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
    expect(html).toContain("Open source record");
    expect(html).toContain("projects/project-1#work-work-1");
    expect(html).toContain("Origin: Notification e1");
    expect(html).toContain("The notification stays open");
    expect(html).toContain("Apply");
  });

  test("a deleted source shows no link into the tombstone", () => {
    const center = deriveNotificationCenter(
      [
        stored("work-blocked", "e1", {
          group: { id: "gone", kind: "Work" },
          projectId: "project-1",
        }),
      ],
      new Set(["Work:gone"]),
    );
    const signal = center.sections[0]?.groups[0]?.signals[0];
    expect(signal?.tombstone).toBe(true);
    const html = renderToStaticMarkup(
      <NotificationCenterList
        center={center}
        panels={{
          opened: {
            output: {
              explanation: "The source record was deleted.",
              outcome: "tombstone",
            },
            signalRowId: signal?.id ?? "",
          },
          preview: null,
        }}
      />,
    );
    expect(html).toContain("The source record was deleted.");
    expect(html).not.toContain("Open source record");
  });
});
