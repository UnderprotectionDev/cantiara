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
        data: { focusDate: "2026-09-27", members: [], available: [] },
      } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView accountId="founder" onSelectDay={vi.fn()} />,
    );

    expect(mocks.dayInput).toHaveBeenCalledWith("2026-09-27");
    expect(html).toContain('value="2026-09-27"');
    expect(html).toContain("No Work in Daily Focus for this day.");
  });
});
