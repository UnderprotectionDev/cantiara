import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import DailyFocusView from "./daily-focus-view";

const mocks = vi.hoisted(() => ({
  dayInput: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isError: false, isPending: false }),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    hash,
    params,
  }: {
    children: ReactNode;
    hash?: string;
    params?: { projectId: string };
  }) => (
    <a href={`/projects/${params?.projectId ?? "project"}#${hash ?? "work"}`}>
      {children}
    </a>
  ),
}));
vi.mock("@/utils/orpc", () => ({
  accountPreferencesQueryOptions: () => ({}),
  orpc: {
    dailyFocusDay: {
      queryOptions: ({ input }: { input: { focusDate: string } }) => {
        mocks.dayInput(input.focusDate);
        return { queryKey: ["dailyFocusDay", input.focusDate] };
      },
    },
  },
}));

describe("Daily Focus selected profile day", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(useQuery).mockReset();
    mocks.dayInput.mockReset();
  });

  test("waits for the Account time zone before choosing a writable day", () => {
    vi.mocked(useQuery).mockReturnValueOnce({ isPending: true } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView accountId="founder" onSelectDay={vi.fn()} />,
    );

    expect(mocks.dayInput).not.toHaveBeenCalled();
    expect(html).toContain("Loading Work…");
    expect(html).not.toContain("Selected day");
    expect(html).not.toContain("Add to Daily Focus");
  });

  test("opens the Account's calendar day without bringing yesterday's Work forward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T00:30:00.000Z"));
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: { timeZone: "America/Los_Angeles" },
      } as never)
      .mockReturnValueOnce({
        data: {
          focusDate: "2026-09-27",
          members: [],
          available: [],
          events: [],
        },
      } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView accountId="founder" onSelectDay={vi.fn()} />,
    );

    expect(mocks.dayInput).toHaveBeenCalledWith("2026-09-27");
    expect(html).toContain('value="2026-09-27"');
    expect(html).toContain("No Work in Daily Focus for this day.");
  });

  test("shows derived events with profile time, Project scope, and source link", () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: {
          dateFormat: "locale",
          locale: "en-US",
          timeZone: "America/Los_Angeles",
        },
      } as never)
      .mockReturnValueOnce({
        data: {
          available: [],
          events: [
            {
              id: "history-reopened",
              kind: "Reopened",
              occurredAt: "2026-09-27T17:30:00.000Z",
              projectId: "project-alpha",
              projectName: "Alpha",
              sourceId: "work-1",
              sourceKey: "ALPHA-1",
              sourceTitle: "First Work",
              sourceType: "Work",
            },
            {
              id: "decision-1",
              kind: "Recorded",
              occurredAt: "2026-09-27T17:35:00.000Z",
              projectId: "project-alpha",
              projectName: "Alpha",
              sourceId: "decision-1",
              sourceKey: null,
              sourceTitle: "First release scope",
              sourceType: "Decision",
            },
            {
              id: "milestone-1",
              kind: "Reached",
              occurredAt: "2026-09-27T17:40:00.000Z",
              projectId: "project-alpha",
              projectName: "Alpha",
              sourceId: "milestone-1",
              sourceKey: null,
              sourceTitle: "Private beta",
              sourceType: "Milestone",
            },
            {
              id: "release-1",
              kind: "Published",
              occurredAt: "2026-09-27T17:45:00.000Z",
              projectId: "project-alpha",
              projectName: "Alpha",
              sourceId: "release-1",
              sourceKey: null,
              sourceTitle: "First release",
              sourceType: "Project Release",
            },
            {
              id: "incident-1",
              kind: "Resolved",
              occurredAt: "2026-09-27T17:50:00.000Z",
              projectId: "project-alpha",
              projectName: "Alpha",
              sourceId: "incident/1",
              sourceKey: null,
              sourceTitle: "Queue delay",
              sourceType: "Production Incident",
            },
          ],
          focusDate: "2026-09-27",
          members: [],
        },
      } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        day="2026-09-27"
        onSelectDay={vi.fn()}
      />,
    );

    expect(html).toContain("What happened today?");
    expect(html).toContain("Reopened");
    expect(html).toContain("10:30 AM");
    expect(html).toContain("Alpha");
    expect(html).toContain("ALPHA-1 First Work");
    expect(html).toContain('href="/projects/project-alpha#work-work-1"');
    expect(html).toContain(
      'href="/projects/project-alpha#source-decision-decision-1"',
    );
    expect(html).toContain(
      'href="/projects/project-alpha#source-milestone-milestone-1"',
    );
    expect(html).toContain(
      'href="/projects/project-alpha#source-project-release-release-1"',
    );
    expect(html).toContain(
      'href="/projects/project-alpha#source-production-incident-incident%2F1"',
    );
    expect(html.match(/Open source record/g)).toHaveLength(5);
  });
});
