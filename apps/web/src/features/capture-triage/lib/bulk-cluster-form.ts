import { z } from "zod";

/** `Add cluster` form: the cluster name is trimmed and must not be empty. */
export const addBulkClusterFormSchema = z.object({
  name: z.string().trim().min(1),
});
