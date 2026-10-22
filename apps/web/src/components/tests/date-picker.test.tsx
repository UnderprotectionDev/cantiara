// biome-ignore-all lint/performance/noJsxPropsBind: Static-markup render tests pass inline no-op handlers.
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { DatePicker, DateTimePicker } from "@/components/date-picker";

test("DatePicker names its trigger and shows the formatted value or placeholder", () => {
  const empty = renderToStaticMarkup(
    <DatePicker
      ariaLabel="Target date"
      id="target"
      onChange={() => undefined}
      placeholder="Select a target date"
      value=""
    />,
  );
  expect(empty).toContain('aria-label="Target date"');
  expect(empty).toContain('id="target"');
  expect(empty).toContain("Select a target date");

  const filled = renderToStaticMarkup(
    <DatePicker
      ariaLabel="Target date"
      onChange={() => undefined}
      value="2026-10-01"
    />,
  );
  expect(filled).toContain("Oct 1, 2026");
});

test("DatePicker treats an invalid value as unset", () => {
  const html = renderToStaticMarkup(
    <DatePicker
      ariaLabel="Due date"
      onChange={() => undefined}
      placeholder="Pick"
      value="not-a-date"
    />,
  );
  expect(html).toContain("Pick");
});

test("DateTimePicker splits the value into a date trigger and a time input", () => {
  const html = renderToStaticMarkup(
    <DateTimePicker
      ariaLabel="Occurred at"
      onChange={() => undefined}
      value="2026-10-01T09:30"
    />,
  );
  expect(html).toContain('aria-label="Occurred at date"');
  expect(html).toContain("Oct 1, 2026");
  expect(html).toContain('aria-label="Occurred at time"');
  expect(html).toContain('type="time"');
  expect(html).toContain('value="09:30"');
});
