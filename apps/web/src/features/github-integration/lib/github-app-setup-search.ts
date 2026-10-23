import { z } from "zod";

const setupSearchSchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  state: z.string().min(1).max(2000),
});

/**
 * The query GitHub appends to the App's Setup URL after an install. Anything
 * else (a direct visit, a missing state) is not a completed install.
 */
export function gitHubAppSetupFromSearch(search: Record<string, unknown>): {
  installationId?: number;
  state?: string;
} {
  const parsed = setupSearchSchema.safeParse(search);
  return parsed.success
    ? { installationId: parsed.data.installation_id, state: parsed.data.state }
    : {};
}

export type GitHubAppSetup = ReturnType<typeof gitHubAppSetupFromSearch>;
