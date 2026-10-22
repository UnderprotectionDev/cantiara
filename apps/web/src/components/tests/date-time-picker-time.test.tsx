// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test handlers are inline spies.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DateTimePicker, onDateTimeDateChange } from "@/components/date-picker";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(value: string, onChange: (next: string) => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <DateTimePicker ariaLabel="When" onChange={onChange} value={value} />,
    );
  });
  return host.querySelector(
    'input[aria-label="When time"]',
  ) as HTMLInputElement;
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("changing the time keeps the chosen date", () => {
  const onChange = vi.fn();
  const input = mount("2026-10-10T14:00", onChange);
  type(input, "09:15");
  expect(onChange).toHaveBeenCalledWith("2026-10-10T09:15");
});

test("clearing the time falls back to midnight on the chosen date", () => {
  const onChange = vi.fn();
  const input = mount("2026-10-10T14:00", onChange);
  type(input, "");
  expect(onChange).toHaveBeenCalledWith("2026-10-10T00:00");
});

test("a time typed before any date is held back until a date is chosen", () => {
  const onChange = vi.fn();
  const input = mount("", onChange);
  expect(input.value).toBe("");
  type(input, "08:30");
  expect(onChange).not.toHaveBeenCalled();
  expect(input.value).toBe("08:30");
});

test("an unset value shows an empty time and a set date shows midnight by default", () => {
  expect(mount("", vi.fn()).value).toBe("");
  act(() => root?.unmount());
  host?.remove();
  expect(mount("2026-10-10", vi.fn()).value).toBe("00:00");
});

test("clearing the date drops the typed time instead of restoring it", () => {
  // Clear: nothing of the old value stays behind.
  expect(onDateTimeDateChange("2026-10-10T14:00", "", "14:00")).toEqual({
    draftTime: "",
    value: "",
  });
  // Picking a date keeps the typed time, and midnight when none exists.
  expect(onDateTimeDateChange("", "2026-10-10", "08:30")).toEqual({
    draftTime: "08:30",
    value: "2026-10-10T08:30",
  });
  expect(onDateTimeDateChange("2026-10-10T14:00", "2026-11-01", "")).toEqual({
    draftTime: "",
    value: "2026-11-01T14:00",
  });
  expect(onDateTimeDateChange("2026-10-10", "2026-10-11", "")).toEqual({
    draftTime: "",
    value: "2026-10-11T00:00",
  });
  // Re-picking the chosen day keeps it, like a native date field.
  expect(onDateTimeDateChange("2026-10-10T14:00", "2026-10-10", "")).toEqual({
    draftTime: "",
    value: "2026-10-10T14:00",
  });
});
