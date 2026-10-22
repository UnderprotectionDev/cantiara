import { expect, type Locator, type Page } from "@playwright/test";
import { differenceInCalendarMonths, format, parse, parseISO } from "date-fns";

const NEXT_MONTH = /next month/i;
const PREVIOUS_MONTH = /previous month/i;

/**
 * Drives the shared DatePicker: opens the trigger button, pages the DayPicker
 * grid to the month of `isoDate` (`yyyy-MM-dd`) and clicks the day.
 */
export async function pickDate(page: Page, trigger: Locator, isoDate: string) {
  const target = parseISO(isoDate);
  await trigger.click();
  const calendar = page.locator('[data-slot="calendar"]');
  const grid = calendar.getByRole("grid").first();
  await grid.waitFor();
  const caption = await grid.getAttribute("aria-label");
  const shown = parse((caption ?? "").trim(), "LLLL yyyy", new Date());
  const months = differenceInCalendarMonths(target, shown);
  // Click the navigation button inside the page, yielding a task between
  // clicks so DayPicker re-renders first: far dates would otherwise need
  // hundreds of slow Playwright clicks.
  await calendar
    .getByRole("button", { name: months > 0 ? NEXT_MONTH : PREVIOUS_MONTH })
    .evaluate(async (button, clicks) => {
      const control = button as HTMLButtonElement;
      for (let step = 0; step < clicks; step += 1) {
        control.click();
        // biome-ignore lint/performance/noAwaitInLoops: each click must render before the next.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }, Math.abs(months));
  await expect(grid).toHaveAttribute("aria-label", format(target, "LLLL yyyy"));
  await calendar
    .getByRole("button", {
      name: new RegExp(
        `${format(target, "MMMM")} ${target.getDate()}(st|nd|rd|th)?,? ${format(target, "yyyy")}`,
      ),
    })
    .click();
  // The popover plays an exit animation: wait until it is gone so the next
  // pick never sees two calendars.
  await expect(calendar).toHaveCount(0);
}

/** Drives the shared DateTimePicker with a `yyyy-MM-ddTHH:mm` value. */
export async function pickDateTime(
  page: Page,
  scope: Locator | Page,
  label: string,
  value: string,
) {
  const [date = "", time = ""] = value.split("T");
  await pickDate(
    page,
    scope.getByLabel(`${label} date`, { exact: true }),
    date,
  );
  await scope.getByLabel(`${label} time`, { exact: true }).fill(time);
}

/** Asserts a DateTimePicker shows the `yyyy-MM-ddTHH:mm` value. */
export async function expectDateTime(
  scope: Locator | Page,
  label: string,
  value: string,
) {
  const [date = "", time = ""] = value.split("T");
  await expect(
    scope.getByLabel(`${label} date`, { exact: true }),
  ).toContainText(format(parseISO(date), "PP"));
  await expect(scope.getByLabel(`${label} time`, { exact: true })).toHaveValue(
    time,
  );
}
