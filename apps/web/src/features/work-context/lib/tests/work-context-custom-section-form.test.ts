import { expect, test } from "vitest";
import {
  type CustomSectionValues,
  conditionFromDraft,
  pickOption,
} from "../work-context-custom-section-form";

const values: CustomSectionValues = {
  conditionKind: "record-type",
  evidenceRole: "Supports",
  recordType: "Decision",
  relation: "Related",
  status: "",
  title: "Decisions",
};

test("an empty status condition means any status", () => {
  expect(conditionFromDraft(values)).toEqual({
    kind: "record-type",
    recordType: "Decision",
    status: null,
  });
  expect(conditionFromDraft({ ...values, status: "Blocked" }).status).toBe(
    "Blocked",
  );
});

test("each condition kind keeps only its own selection", () => {
  expect(conditionFromDraft({ ...values, conditionKind: "relation" })).toEqual({
    kind: "relation",
    relation: "Related",
    status: null,
  });
  expect(
    conditionFromDraft({ ...values, conditionKind: "evidence-role" }),
  ).toEqual({ evidenceRole: "Supports", kind: "evidence-role", status: null });
});

test("pickOption ignores values outside the option list", () => {
  expect(pickOption(["a", "b"], "b")).toBe("b");
  expect(pickOption(["a", "b"], "c")).toBeUndefined();
});
