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
  Link: ({ children }: { children: ReactNode }) => (
    <a href="#work">{children}</a>
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
              workId: "work-1",
              workKey: "ALPHA-1",
              workTitle: "First Work",
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
    expect(html).toContain("Open source record");
  });
});
