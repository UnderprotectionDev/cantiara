import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import DailyFocusView from "./daily-focus-view";

const mocks = vi.hoisted(() => ({
  buttonActions: new Map<string, () => void>(),
  closeInput: vi.fn(),
  dayInput: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@cantiara/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => {
    if (onClick) {
      mocks.buttonActions.set(String(children), onClick);
    }
    return (
      <button onClick={onClick} type="button">
        {children}
      </button>
    );
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
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
    dailyFocusClose: {
      queryOptions: ({ input }: { input: { focusDate: string } }) => {
        mocks.closeInput(input.focusDate);
        return { queryKey: ["dailyFocusClose", input.focusDate] };
      },
    },
    dailyFocusDay: {
      queryOptions: ({ input }: { input: { focusDate: string } }) => {
        mocks.dayInput(input.focusDate);
        return { queryKey: ["dailyFocusDay", input.focusDate] };
      },
    },
  },
}));

describe("Daily Focus selected profile day", () => {
  beforeEach(() => {
    mocks.buttonActions.clear();
    mocks.useMutation.mockReturnValue({
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mocks.buttonActions.clear();
    vi.mocked(useQuery).mockReset();
    mocks.useMutation.mockReset();
    mocks.closeInput.mockReset();
    mocks.dayInput.mockReset();
  });

  test("waits for the Account time zone before choosing a writable day", () => {
    vi.mocked(useQuery).mockReturnValueOnce({ isPending: true } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        onOpenCloseFocus={vi.fn()}
        onReturnToDailyFocus={vi.fn()}
        onSelectDay={vi.fn()}
      />,
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
          candidates: [],
          focusDate: "2026-09-27",
          members: [],
          available: [],
        },
      } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        onOpenCloseFocus={vi.fn()}
        onReturnToDailyFocus={vi.fn()}
        onSelectDay={vi.fn()}
      />,
    );

    expect(mocks.dayInput).toHaveBeenCalledWith("2026-09-27");
    expect(html).toContain('value="2026-09-27"');
    expect(html).toContain("No Work in Daily Focus for this day.");
  });

  test("opens a read-only close view grouped from the selected day's Work", () => {
    const completedWork = {
      id: "work-completed",
      key: "ALPHA-1",
      projectId: "project-alpha",
      projectName: "Alpha",
      reappearDate: null,
      status: "Closed",
      title: "Finish the release notes",
    };
    const openWork = {
      id: "work-open",
      key: "BETA-1",
      projectId: "project-beta",
      projectName: "Beta",
      reappearDate: null,
      status: "In Progress",
      title: "Review the onboarding flow",
    };
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: { locale: "en-GB", timeZone: "Europe/Istanbul" },
      } as never)
      .mockReturnValueOnce({
        data: {
          abandoned: [],
          completed: [completedWork],
          deferred: [],
          stillOpen: [openWork],
        },
      } as never);

    const onReturnToDailyFocus = vi.fn();
    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        day="2026-09-27"
        onOpenCloseFocus={vi.fn()}
        onReturnToDailyFocus={onReturnToDailyFocus}
        onSelectDay={vi.fn()}
        view="close"
      />,
    );

    expect(mocks.closeInput).toHaveBeenCalledExactlyOnceWith("2026-09-27");
    expect(html).toContain("Close focus");
    expect(html).toContain("Completed");
    expect(html).toContain("Still open");
    expect(html).toContain("Finish the release notes");
    expect(html).toContain("Review the onboarding flow");
    expect(html).toContain("Open source record");
    expect(html).toContain("Daily Focus");
    expect(html).not.toContain("Add to Daily Focus");
    expect(html).not.toContain("Remove from Daily Focus");
    expect(mocks.useMutation).not.toHaveBeenCalled();
    mocks.buttonActions.get("Daily Focus")?.();
    expect(onReturnToDailyFocus).toHaveBeenCalledExactlyOnceWith("2026-09-27");
  });

  test("offers Close focus for the selected day", () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: { locale: "en-GB", timeZone: "Europe/Istanbul" },
      } as never)
      .mockReturnValueOnce({
        data: {
          candidates: [],
          focusDate: "2026-09-27",
          members: [],
          available: [],
        },
      } as never);

    const onOpenCloseFocus = vi.fn();
    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        day="2026-09-27"
        onOpenCloseFocus={onOpenCloseFocus}
        onReturnToDailyFocus={vi.fn()}
        onSelectDay={vi.fn()}
      />,
    );

    expect(html).toContain("Close focus");
    mocks.buttonActions.get("Close focus")?.();
    expect(onOpenCloseFocus).toHaveBeenCalledExactlyOnceWith("2026-09-27");
  });

  test("explains the date field behind each candidate and offers accept or reject", () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: { timeZone: "America/Los_Angeles" },
      } as never)
      .mockReturnValueOnce({
        data: {
          available: [],
          candidates: [
            {
              id: "work-1",
              key: "ALPHA-1",
              projectId: "project-1",
              projectName: "Alpha",
              reasons: [{ date: "2026-10-01", label: "Target date is near" }],
              status: "Not Started",
              title: "Prepare the release",
            },
          ],
          focusDate: "2026-09-27",
          members: [],
        },
      } as never);

    const html = renderToStaticMarkup(
      <DailyFocusView
        accountId="founder"
        onOpenCloseFocus={vi.fn()}
        onReturnToDailyFocus={vi.fn()}
        onSelectDay={vi.fn()}
      />,
    );

    expect(html).toContain("Candidates");
    expect(html).toContain("Target date is near:");
    expect(html).toContain('dateTime="2026-10-01"');
    expect(html).toContain("Accept");
    expect(html).toContain("Reject");
  });
});
