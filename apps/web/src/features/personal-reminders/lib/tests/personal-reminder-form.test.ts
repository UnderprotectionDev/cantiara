import { afterEach, expect, test, vi } from "vitest";
import {
  defaultFireAt,
  localDateTimeValue,
  supportsOpenCondition,
} from "../personal-reminder-form";

afterEach(() => {
  vi.useRealTimers();
});

test("formats a local datetime-local value without seconds", () => {
  expect(localDateTimeValue(new Date(2026, 9, 5, 7, 3, 59))).toBe(
    "2026-10-05T07:03",
  );
});

test("the default reminder is one hour ahead, at a whole minute", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 5, 7, 3, 59));
  expect(defaultFireAt()).toBe("2026-10-05T08:03");
});

test("only conditional source types offer the open condition", () => {
  expect(supportsOpenCondition("Work")).toBe(true);
  expect(supportsOpenCondition("Document")).toBe(false);
});
