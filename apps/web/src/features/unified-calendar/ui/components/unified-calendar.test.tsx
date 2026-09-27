import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";

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

function calendarDayContent(html: string, date: string) {
  const label = `aria-label="${formatAccountDate(
    date,
    DEFAULT_ACCOUNT_PREFERENCES,
  )}"`;
  const labelIndex = html.indexOf(label);
  if (labelIndex < 0) {
    throw new Error(`Calendar did not render the day region for ${date}.`);
  }
  const contentStart = html.indexOf(">", labelIndex) + 1;
  const contentEnd = html.indexOf("</section>", contentStart);
  return html.slice(contentStart, contentEnd);
}

describe("Unified Calendar", () => {
  test("Day shows only date positions on the selected day", () => {
    const html = renderToStaticMarkup(<UnifiedCalendar {...base} view="Day" />);
    const selectedDay = calendarDayContent(html, base.selectedDate);

    expect(selectedDay).toContain("Reappear date");
    expect(selectedDay).not.toContain("Planned start");
    expect(selectedDay).not.toContain("Target date");
    expect(selectedDay).toContain("Payment flow");
  });

  test.each(["Week", "Month"] as const)(
    "%s shows a start–target range on each spanned day while keeping kinds distinct",
    (view) => {
      const html = renderToStaticMarkup(
        <UnifiedCalendar {...base} view={view} />,
      );

      for (const date of ["2026-09-22", "2026-09-23", "2026-09-24"]) {
        const dayContent = calendarDayContent(html, date);
        expect(dayContent).toContain("Payment flow");
        expect(dayContent).toContain("Planned start · Target date");
      }
      expect(html).toContain("Planned start");
      expect(html).toContain("Target date");
      expect(html).toContain("Reappear date");
      expect(html).toContain(
        formatAccountDate("2026-09-22", DEFAULT_ACCOUNT_PREFERENCES),
      );
      expect(html).toContain(
        formatAccountDate("2026-09-24", DEFAULT_ACCOUNT_PREFERENCES),
      );
    },
  );

  test.each(["Not Started", "In Progress", "Blocked", "Closed"] as const)(
    "scope keeps planned Work with %s status visible",
    (status) => {
      const html = renderToStaticMarkup(
        <UnifiedCalendar
          {...base}
          selectedDate="2026-09-22"
          selectedProjectId="project-1"
          view="Day"
          works={[
            { ...work, status },
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
      const selectedDay = calendarDayContent(html, "2026-09-22");

      expect(selectedDay).toContain("Planned start");
      expect(selectedDay).toContain("Payment flow");
      expect(html).not.toContain("Other project");
    },
  );

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

    const plannedStartDay = calendarDayContent(week, "2026-09-22");
    expect(plannedStartDay).toContain("Planned start");
    expect(plannedStartDay).not.toContain("Planned start · Target date");
    expect(plannedStartDay).not.toContain("Target date");
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

    for (const date of ["2026-09-22", "2026-09-23", "2026-09-24"]) {
      const dayContent = calendarDayContent(html, date);
      expect(dayContent).toContain("Payment flow");
      expect(dayContent).toContain("Planned start · Target date");
    }
  });

  test("Agenda lists selected-month date fields chronologically and opens their sources", () => {
    const laterWork = {
      ...work,
      id: "work-2",
      key: "PAY-2",
      plannedStartDate: "2026-10-03",
      projectId: "project-2",
      reappearDate: "2026-09-21",
      targetDate: null,
      title: "Card recovery",
    };
    const html = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        projects={[...base.projects, { id: "project-2", name: "Recovery" }]}
        view="Agenda"
        works={[work, laterWork]}
      />,
    );

    expect(html).toContain('aria-label="Agenda Calendar"');
    const dateLabels = [
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
    ].map((date) => formatAccountDate(date, DEFAULT_ACCOUNT_PREFERENCES));
    const datePositions = dateLabels.map((date) => html.indexOf(date));

    expect(datePositions.every((position) => position >= 0)).toBe(true);
    expect(datePositions).toEqual(
      [...datePositions].sort((left, right) => left - right),
    );
    expect(html).not.toContain(
      formatAccountDate("2026-10-03", DEFAULT_ACCOUNT_PREFERENCES),
    );
    expect(html.match(/>Open source record</g)).toHaveLength(4);
    expect(
      html.match(
        new RegExp(`href="${workRecordHref("project-1", "work-1")}"`, "g"),
      ),
    ).toHaveLength(3);
    expect(
      html.match(
        new RegExp(`href="${workRecordHref("project-2", "work-2")}"`, "g"),
      ),
    ).toHaveLength(1);
  });

  test.each(["Agenda", "Day", "Month", "Week"] as const)(
    "%s keeps only the selected date kind visible",
    (view) => {
      const html = renderToStaticMarkup(
        <UnifiedCalendar
          {...base}
          selectedDate="2026-09-24"
          selectedDateKinds={["targetDate"]}
          view={view}
        />,
      );

      expect(html).toContain("Target date");
      expect(html).not.toContain("Planned start");
      expect(html).not.toContain("Reappear date");
    },
  );

  test("Agenda applies the selected Project scope to date-kind rows", () => {
    const html = renderToStaticMarkup(
      <UnifiedCalendar
        {...base}
        selectedDateKinds={["targetDate"]}
        selectedProjectId="project-1"
        view="Agenda"
        works={[
          work,
          {
            ...work,
            id: "other-project-work",
            projectId: "project-2",
            title: "Other project",
          },
        ]}
      />,
    );

    expect(html).toContain("Payment flow");
    expect(html).not.toContain("Other project");
    expect(html.match(/>Open source record</g)).toHaveLength(1);
  });
});
