// Egress-only environment. Must not import the product env module.

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function createSmartLinkEgressEnv(
  runtimeEnv: Record<string, string | undefined> = process.env,
) {
  return createEnv({
    server: {
      PORT: z.coerce.number().int().positive().default(3002),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}
