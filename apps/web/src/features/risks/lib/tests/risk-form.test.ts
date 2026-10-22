import { expect, test } from "vitest";
import { riskFormSchema } from "../risk-form";

const draft = {
  description: "",
  impact: "",
  life: "Open" as const,
  probability: "",
  rationale: "",
  response: "",
  title: "Vendor lock-in",
};

function firstMessage(
  options: Parameters<typeof riskFormSchema>[0],
  value: typeof draft | (Omit<typeof draft, "life"> & { life: "Accepted" }),
) {
  const parsed = riskFormSchema(options).safeParse(value);
  return parsed.success ? null : parsed.error.issues[0]?.message;
}

test("a Title is required unless only the Status changes", () => {
  expect(
    firstMessage(
      { baseLife: undefined, changingStatus: false },
      {
        ...draft,
        title: " ",
      },
    ),
  ).toBe("Enter a Title before saving.");
  expect(
    firstMessage(
      { baseLife: "Open", changingStatus: true },
      {
        ...draft,
        life: "Open",
        title: "",
      },
    ),
  ).toBe("Choose a different Status.");
});

test("accepting a Risk needs a Rationale", () => {
  expect(
    firstMessage(
      { baseLife: "Open", changingStatus: true },
      {
        ...draft,
        life: "Accepted",
      },
    ),
  ).toBe("Enter a Rationale before accepting a Risk.");
  expect(
    firstMessage(
      { baseLife: "Open", changingStatus: true },
      {
        ...draft,
        life: "Accepted",
        rationale: "Cost of change is higher",
      },
    ),
  ).toBeNull();
});
