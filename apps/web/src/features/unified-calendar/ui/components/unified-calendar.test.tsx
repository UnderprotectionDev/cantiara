import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import UnifiedCalendar from "./unified-calendar";

const work = {
  archivedAt: null,
  id: "work-1",
  key: "PAY-1",
  plannedStartDate: "2026-09-22",
  projectId: "project-1",
  reappearDate: "2026-09-23",
  status: "Not Started" as const,
  targetDate: "2026-09-24",
  title: "Payment flow",
};

const base = {
  preferences: DEFAULT_ACCOUNT_PREFERENCES,
  projects: [{ id: "project-1", name: "Payments" }],
  selectedDate: "2026-09-23",
  selectedProjectId: "all",
  works: [work],
};

describe("Unified Calendar", () => {
  test("Day shows only date positions on the selected day", () => {
    const html = renderToStaticMarkup(<UnifiedCalendar {...base} view="Day" />);

    expect(html).toContain("Reappear date");
    expect(html).not.toContain("Planned start");
    expect(html).not.toContain("Target date");
    expect(html).not.toContain("date-range");
    expect(html).toContain("Payment flow");
  });

  test.each(["Week", "Month"] as const)(
    "%s shows a start–target range on each spanned day while keeping kinds distinct",
    (view) => {
      const html = renderToStaticMarkup(
        <UnifiedCalendar {...base} view={view} />,
      );

      expect(html.match(/data-date-range="work-1"/g)).toHaveLength(3);
      expect(html).toContain("Planned start");
      expect(html).toContain("Target date");
      expect(html).toContain("Reappear date");
      expect(html).toContain("2026-09-22");
      expect(html).toContain("2026-09-24");
    },
  );

  test("scope keeps planned Work regardless of its status", () => {
    const html = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        selectedDate="2026-09-22"
        selectedProjectId="project-1"
        view="Day"
        works={[
          work,
          {
            ...work,
            id: "work-2",
            key: "OTHER-2",
            projectId: "project-2",
            title: "Other project",
          },
        ]}
      />,
    );

    expect(html).toContain("Planned start");
    expect(html).toContain("Payment flow");
    expect(html).not.toContain("Other project");
    expect(html).not.toContain("date-range");
  });

  test("a lone planned start stays a single kind and an empty window is explicit", () => {
    const startOnly = { ...work, reappearDate: null, targetDate: null };
    const week = renderToStaticMarkup(
      <UnifiedCalendar {...base} view="Week" works={[startOnly]} />,
    );
    const emptyDay = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        selectedDate="2026-09-23"
        view="Day"
        works={[startOnly]}
      />,
    );

    expect(week).toContain("Planned start");
    expect(week).not.toContain("date-range");
    expect(emptyDay).toContain("No dated Work in this Calendar view.");
  });

  test("Month contains only dates in the selected month", () => {
    const html = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        view="Month"
        works={[
          {
            ...work,
            id: "previous-month",
            plannedStartDate: "2026-08-31",
            targetDate: null,
            reappearDate: null,
            title: "August Work",
          },
        ]}
      />,
    );

    expect(html).not.toContain("August Work");
    expect(html).not.toContain('data-calendar-day="2026-08-31"');
  });

  test("a start and target still form a range when target precedes start", () => {
    const html = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        view="Week"
        works={[
          {
            ...work,
            plannedStartDate: "2026-09-24",
            targetDate: "2026-09-22",
          },
        ]}
      />,
    );

    expect(html.match(/data-date-range="work-1"/g)).toHaveLength(3);
    expect(html).toContain("Planned start");
    expect(html).toContain("Target date");
  });
});
