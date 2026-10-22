import { z } from "zod";

export const upEditFormSchema = z.object({
  upSql: z.string().max(500_000),
});
