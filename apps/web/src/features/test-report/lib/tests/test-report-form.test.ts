import { expect, test } from "vitest";
import {
  EMPTY_TEST_SESSION_FORM,
  parseTestSessionForm,
  parseTestSessionImport,
} from "../test-report-form";

test("an invalid manual form exposes the schema's first issue message", () => {
  const parsed = parseTestSessionForm(EMPTY_TEST_SESSION_FORM);
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    expect(parsed.error.issues[0]?.message).toBeTruthy();
  }
});

test("an invalid import exposes the schema's first issue message", () => {
  const parsed = parseTestSessionImport({
    content: "x",
    format: "yaml" as "json",
  });
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    expect(parsed.error.issues[0]?.message).toBeTruthy();
  }
});
