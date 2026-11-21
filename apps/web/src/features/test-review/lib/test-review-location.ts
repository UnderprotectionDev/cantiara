import { TEST_RESULT_EVENT_KINDS } from "@cantiara/api/test-review";
import { z } from "zod";

const recordId = z.string().trim().min(1).max(255);

export const testReviewLocationSchema = z.object({
  sessionId: recordId,
  mode: z.enum(TEST_RESULT_EVENT_KINDS),
  eventId: recordId.nullable(),
  sessionTestId: recordId.nullable(),
});

export type TestReviewLocation = z.infer<typeof testReviewLocationSchema>;
