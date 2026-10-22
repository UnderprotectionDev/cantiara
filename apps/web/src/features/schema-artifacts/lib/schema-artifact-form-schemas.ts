import { z } from "zod";

export const upEditFormSchema = z.object({
  upSql: z.string().max(500_000),
});

export const confirmArtifactFormSchema = z.object({
  confirmedDestructiveOperationIds: z.array(z.string().min(1)),
  supersedes: z.string().min(1).nullable(),
});
