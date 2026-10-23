import type { GitHubWebhookInbox } from "./github-webhook-inbox";

export const GITHUB_WEBHOOK_PATH = "/api/github/webhook";

/** GitHub caps webhook payloads at 25 MB; the inbox keeps 5 MB and reconcile covers the rest. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Reads the body as UTF-8, counting bytes; `null` as soon as the limit is crossed. */
async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    // biome-ignore lint/performance/noAwaitInLoops: Chunks must be read in order to stop at the limit.
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Thin Hono adapter: reads the raw body and the three GitHub headers, hands
 * them to the inbox and relays its answer. The signature is checked over the
 * exact raw bytes before anything is written, and no field sync runs here.
 */
export async function handleGitHubWebhook(
  request: Request,
  inbox: GitHubWebhookInbox | undefined,
): Promise<Response> {
  if (!inbox) {
    return Response.json({ error: "not-configured" }, { status: 503 });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "payload-too-large" }, { status: 413 });
  }
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return Response.json({ error: "payload-too-large" }, { status: 413 });
  }
  const result = await inbox.receive({
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
    rawBody,
    signature: request.headers.get("x-hub-signature-256"),
  });
  return Response.json(result.body, { status: result.status });
}
