import { expect, test } from "vitest";
import {
  assumptionFormSchema,
  openQuestionAnswerFormSchema,
  openQuestionCreateFormSchema,
} from "../uncertainty-record-form";

function message(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.success ? null : result.error?.issues[0]?.message;
}

test("an Assumption needs a Title and Statement", () => {
  expect(
    message(
      assumptionFormSchema.safeParse({
        rationale: "",
        statement: "",
        title: "Users sync",
      }),
    ),
  ).toBe("Enter a Title and Statement before saving.");
  expect(
    assumptionFormSchema.safeParse({
      rationale: "",
      statement: "Users sync daily",
      title: "Sync",
    }).success,
  ).toBe(true);
});

test("an Open Question needs a Title and Question; an answer needs text", () => {
  expect(
    message(
      openQuestionCreateFormSchema.safeParse({ question: "", title: "T" }),
    ),
  ).toBe("Enter a Title and Question before saving.");
  expect(
    message(openQuestionAnswerFormSchema.safeParse({ answer: "  " })),
  ).toBe("Enter an Answer before saving.");
});
