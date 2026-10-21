import { createServer } from "node:http";
import {
  previewFallback,
  type SmartLinkPreview,
} from "@cantiara/api/smart-link-preview";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createSmartLinkPreviewGateway } from "../smart-link-preview-gateway";

const originalUrl = "https://example.org/research";
let result: unknown;
let endpoint = "";
let received = "";
const server = createServer(async (request, response) => {
  received = "";
  for await (const chunk of request) {
    received += chunk.toString();
  }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(result));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fixture endpoint required");
  }
  endpoint = `http://127.0.0.1:${address.port}/preview`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function preview(): SmartLinkPreview {
  return {
    ...previewFallback(originalUrl),
    kind: "preview",
    title: "Research",
    capturedContent: "A dated finding.",
    error: null,
  };
}

describe("Sources and Freshness egress gateway", () => {
  test("returns only a safe link when no egress service is configured", async () => {
    expect(
      await createSmartLinkPreviewGateway(undefined)(originalUrl),
    ).toMatchObject({
      kind: "link",
      url: originalUrl,
      player: null,
    });
  });
  test("posts only the URL to egress and reads its bounded streaming result", async () => {
    result = preview();
    expect(await createSmartLinkPreviewGateway(endpoint)(originalUrl)).toEqual(
      result,
    );
    expect(JSON.parse(received)).toEqual({ url: originalUrl });
  });
  test("refuses changed URLs, unauthorized players, invalid output and oversized responses", async () => {
    for (const invalid of [
      { ...preview(), url: "https://other.org/" },
      { ...preview(), player: { provider: "YouTube", videoId: "dQw4w9WgXcQ" } },
      { ...preview(), image: "https://other.org/image.png" },
      { oversized: "x".repeat(2 * 1024 * 1024 + 1) },
    ]) {
      result = invalid;
      expect(
        // biome-ignore lint/performance/noAwaitInLoops: Each adversarial response uses the same gateway fixture.
        await createSmartLinkPreviewGateway(endpoint)(originalUrl),
      ).toMatchObject({
        kind: "link",
        url: originalUrl,
        player: null,
      });
    }
  });
});
