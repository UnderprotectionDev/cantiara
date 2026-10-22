import {
  WORK_CLOSURE_RESULT_OPTIONS,
  WORK_STATUS_OPTIONS,
} from "@cantiara/api/work-lifecycle";
import { z } from "zod";

/** `Bulk Edit` form: `Preview` needs a Status; Closure result and Reason apply to Closed. */
export const bulkEditStatusFormSchema = z.object({
  closureReason: z.string().max(2000),
  closureResult: z.enum(WORK_CLOSURE_RESULT_OPTIONS),
  targetStatus: z.enum(WORK_STATUS_OPTIONS),
});

export type BulkEditStatusFormInput = z.infer<typeof bulkEditStatusFormSchema>;
