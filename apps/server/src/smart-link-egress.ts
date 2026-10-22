// Separate Railway service entrypoint. No product env/auth/services/database; reads only the egress env.

import { smartLinkPreviewInputSchema } from "@cantiara/api/smart-link-preview";
import { serve } from "bun";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isolatedSmartLinkPreview } from "./features/sources-and-freshness/server/isolated-smart-link-preview";
import { createSmartLinkEgressEnv } from "./smart-link-egress-env";

const egressEnv = createSmartLinkEgressEnv();
const app = new Hono();
app.use("*", bodyLimit({ maxSize: 16_384 }));
app.post("/preview", async (context) => {
  const input = smartLinkPreviewInputSchema.safeParse(
    await context.req.json().catch(() => null),
  );
  if (!input.success) {
    return context.json({ error: "URL required" }, 400);
  }
  context.header("Cache-Control", "no-store");
  return context.json(await isolatedSmartLinkPreview(input.data.url));
});
app.get("/health", (context) => context.text("ok"));
serve({
  fetch: app.fetch,
  port: egressEnv.PORT,
  maxRequestBodySize: 16_384,
});
