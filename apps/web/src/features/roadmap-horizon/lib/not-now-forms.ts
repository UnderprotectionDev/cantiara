import { reconsiderWorkNotNowInputSchema } from "@cantiara/api/work-not-now";

/** Form schema for Reconsidering a Not now trail: the Review later handling. */
export const notNowReconsiderationFormSchema =
  reconsiderWorkNotNowInputSchema.pick({ reviewLaterHandling: true });
