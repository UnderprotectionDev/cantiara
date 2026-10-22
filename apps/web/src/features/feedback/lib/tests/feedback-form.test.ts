import { expect, test } from "vitest";
import { createFeedbackFormSchema } from "../feedback-form";

const valid = {
  attachmentIds: ["a1"],
  channel: "  email ",
  companyId: "",
  contactId: "c1",
  link: " ",
  occurredAt: "2026-05-01T10:30",
  originalMessage: "It is slow",
  title: "Slow export",
};

test("maps the form to the create draft", () => {
  const parsed = createFeedbackFormSchema.safeParse(valid);
  expect(parsed.success).toBe(true);
  expect(parsed.data).toEqual({
    attachmentIds: ["a1"],
    channel: "email",
    companyId: null,
    contactId: "c1",
    link: null,
    occurredAt: new Date("2026-05-01T10:30").toISOString(),
    originalMessage: "It is slow",
    title: "Slow export",
  });
});

test.each([{ title: "  " }, { originalMessage: "" }, { occurredAt: "" }])(
  "refuses %o with the required-fields message",
  (patch) => {
    const parsed = createFeedbackFormSchema.safeParse({ ...valid, ...patch });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Enter a Title, an Original message and Occurred at.",
    );
  },
);

test.each([{ link: "ftp://example.com/page" }, { channel: "e".repeat(101) }])(
  "applies the API contract's own limits: %o",
  (patch) => {
    const parsed = createFeedbackFormSchema.safeParse({ ...valid, ...patch });
    expect(parsed.success).toBe(false);
  },
);
