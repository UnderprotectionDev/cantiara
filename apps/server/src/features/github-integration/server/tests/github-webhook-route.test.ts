import { describe, expect, test } from "vitest";

import { createMemoryHarness } from "../github-integration-memory-store";
import { handleGitHubWebhook } from "../github-webhook-route";

function request(body: string, headers: Record<string, string>) {
  return new Request("https://api.example.test/api/github/webhook", {
    body,
    headers,
    method: "POST",
  });
}

describe("GitHub webhook HTTP route", () => {
  test("verifies the raw body signature, then answers 202 with the delivery id", async () => {
    const harness = createMemoryHarness();
    const body = '{"zen":"Keep it logically awesome."}';
    const accepted = await handleGitHubWebhook(
      request(body, {
        "x-github-delivery": "route-1",
        "x-github-event": "ping",
        "x-hub-signature-256": harness.sign(body),
      }),
      harness.inbox,
    );
    expect(accepted.status).toBe(202);
    expect(await accepted.json()).toMatchObject({ deliveryId: "route-1" });
    const duplicate = await handleGitHubWebhook(
      request(body, {
        "x-github-delivery": "route-1",
        "x-github-event": "ping",
        "x-hub-signature-256": harness.sign(body),
      }),
      harness.inbox,
    );
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ duplicate: true });
  });

  test("answers 401 and writes nothing for a bad signature", async () => {
    const harness = createMemoryHarness();
    const rejected = await handleGitHubWebhook(
      request("{}", {
        "x-github-delivery": "route-2",
        "x-github-event": "ping",
        "x-hub-signature-256": "sha256=00",
      }),
      harness.inbox,
    );
    expect(rejected.status).toBe(401);
    expect(harness.inboxRows.deliveries.size).toBe(0);
  });

  test("answers 503 without an inbox and 413 for an oversized body", async () => {
    const harness = createMemoryHarness();
    expect(
      (await handleGitHubWebhook(request("{}", {}), undefined)).status,
    ).toBe(503);
    const oversized = await handleGitHubWebhook(
      request("{}", { "content-length": String(6 * 1024 * 1024) }),
      harness.inbox,
    );
    expect(oversized.status).toBe(413);
  });

  test("answers 413 for a chunked body without Content-Length that exceeds the byte limit", async () => {
    const harness = createMemoryHarness();
    const chunk = new Uint8Array(1024 * 1024).fill(0x7b);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 50) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
    });
    const chunked = new Request("https://api.example.test/api/github/webhook", {
      body: stream,
      duplex: "half",
      method: "POST",
    } as RequestInit);
    const rejected = await handleGitHubWebhook(chunked, harness.inbox);
    expect(rejected.status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });

  test("counts multi-byte characters as bytes against the limit", async () => {
    const harness = createMemoryHarness();
    // 3 million two-byte characters: 3M UTF-16 units, 6 MB of bytes.
    const body = "é".repeat(3_000_000);
    const rejected = await handleGitHubWebhook(
      request(body, {}),
      harness.inbox,
    );
    expect(rejected.status).toBe(413);
  });
});
