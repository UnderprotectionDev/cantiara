import { expect, test } from "vitest";
import { createSmartLinkPreview } from "../smart-link-preview";

test("Source Check records the actual final URL and HTTP result without approving a version", async () => {
  const preview = createSmartLinkPreview({
    resolve: async () => ["93.184.216.34"],
    request: async (
      url,
    ): Promise<{
      status: number;
      headers: Record<string, string>;
      body: Uint8Array;
    }> =>
      url.pathname === "/old"
        ? { status: 302, headers: { location: "/new" }, body: new Uint8Array() }
        : {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: new TextEncoder().encode("Updated finding."),
          },
  });
  expect(await preview("https://example.org/old")).toMatchObject({
    kind: "preview",
    fetchResult: {
      finalUrl: "https://example.org/new",
      httpStatus: 200,
      contentType: "text/plain",
    },
  });
});

test("failed Source Check exposes a deleted page instead of a current capture", async () => {
  const preview = createSmartLinkPreview({
    resolve: async () => ["93.184.216.34"],
    request: async () => ({
      status: 404,
      headers: { "content-type": "text/html" },
      body: new Uint8Array(),
    }),
  });
  expect(await preview("https://example.org/deleted")).toMatchObject({
    kind: "link",
    capturedContent: "",
    error: expect.stringContaining("HTTP 404"),
    fetchResult: {
      finalUrl: "https://example.org/deleted",
      httpStatus: 404,
      contentType: "text/html",
    },
  });
});
