// biome-ignore-all lint/suspicious/useAwait: Network boundary doubles implement a promise-based transport.
// biome-ignore-all lint/performance/noAwaitInLoops: Adversarial cases run sequentially at the same preview seam.
import { describe, expect, test } from "vitest";
import {
  createSmartLinkPreview,
  type PreviewTransport,
} from "./smart-link-preview";

function previewNetwork(addresses = ["93.184.216.34"]) {
  const transport: PreviewTransport = {
    resolve: async () => addresses,
    request: async () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: new TextEncoder().encode(
        "<title>Research &amp; evidence</title><script>steal()</script><p>A dated finding.</p>",
      ),
    }),
  };
  return transport;
}

describe("Sources and Freshness isolated preview", () => {
  test("returns a transient preview and sanitized capture without creating a Source", async () => {
    const preview = await createSmartLinkPreview(previewNetwork())(
      "https://example.org/research",
    );
    expect(preview).toMatchObject({
      kind: "preview",
      url: "https://example.org/research",
      domain: "example.org",
      title: "Research & evidence",
      capturedContent: "A dated finding.",
      player: null,
    });
    expect(preview).not.toHaveProperty("sourceId");
    expect(preview).not.toHaveProperty("html");
  });
  test("refuses private, reserved, mixed DNS answers, credentials and non-HTTP inputs", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "192.168.1.2",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "192.0.2.3",
      "::1",
      "fe80::1",
      "fc00::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "4000::1",
      "3fff::1",
      "192.0.0.9",
    ]) {
      expect(
        (
          await createSmartLinkPreview(previewNetwork([address]))(
            "https://example.org",
          )
        ).kind,
        address,
      ).toBe("link");
    }
    expect(
      (
        await createSmartLinkPreview(
          previewNetwork(["93.184.216.34", "10.0.0.2"]),
        )("https://example.org")
      ).kind,
    ).toBe("link");
    for (const url of [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:pass@example.org",
      '<iframe src="https://youtube.com"></iframe>',
    ]) {
      expect(await createSmartLinkPreview(previewNetwork())(url)).toMatchObject(
        { kind: "link", url: "", player: null },
      );
    }
  });
  test("rejects redirect-to-private and revalidates a hostname on each hop", async () => {
    const network = previewNetwork();
    network.request = async () => ({
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data" },
      body: new Uint8Array(),
    });
    expect(
      (await createSmartLinkPreview(network)("https://example.org")).kind,
    ).toBe("link");
    let resolutions = 0;
    network.resolve = async () => {
      resolutions += 1;
      return resolutions === 1 ? ["93.184.216.34"] : ["127.0.0.1"];
    };
    network.request = async () => ({
      status: 302,
      headers: { location: "/again" },
      body: new Uint8Array(),
    });
    expect(
      (await createSmartLinkPreview(network)("https://example.org")).kind,
    ).toBe("link");
  });
  test("keeps only a link for oversized, encoded and executable responses", async () => {
    const responses: Record<string, string>[] = [
      { "content-type": "text/html", "content-length": "20971521" },
      { "content-type": "application/javascript" },
      { "content-type": "text/html", "content-encoding": "gzip" },
    ];
    for (const headers of responses) {
      const network = previewNetwork();
      network.request = async () => ({
        status: 200,
        headers,
        body: new Uint8Array(),
      });
      expect(
        (await createSmartLinkPreview(network)("https://example.org")).kind,
      ).toBe("link");
    }
  });

  test("permits only a verified YouTube video and never uses external embed markup", async () => {
    const network = previewNetwork();
    const htmlRequest = network.request;
    network.request = async (url, address, signal) =>
      url.pathname === "/oembed"
        ? {
            status: 200,
            headers: { "content-type": "application/json" },
            body: new TextEncoder().encode(
              '{"title":"Research video","html":"<iframe src=evil></iframe>"}',
            ),
          }
        : htmlRequest(url, address, signal, 20 * 1024 * 1024);
    expect(
      await createSmartLinkPreview(network)(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ),
    ).toMatchObject({
      player: { provider: "YouTube", videoId: "dQw4w9WgXcQ" },
    });
    for (const url of [
      "https://vimeo.com/12345",
      "https://www.youtube.com.evil.org/watch?v=dQw4w9WgXcQ",
      "https://example.org/embed",
    ]) {
      expect((await createSmartLinkPreview(network)(url)).player).toBeNull();
    }
    network.request = async (url, address, signal) =>
      url.pathname === "/oembed"
        ? { status: 403, headers: {}, body: new Uint8Array() }
        : htmlRequest(url, address, signal, 20 * 1024 * 1024);
    expect(
      await createSmartLinkPreview(network)("https://youtu.be/dQw4w9WgXcQ"),
    ).toMatchObject({
      player: null,
      error: "Video unavailable. Open the original URL.",
    });
  });
  test("omits an image whose address redirects into a private network", async () => {
    const network = previewNetwork();
    network.safeImage = async () => "data:image/webp;base64,SAFE";
    network.request = async (url): ReturnType<PreviewTransport["request"]> =>
      url.pathname === "/research"
        ? {
            status: 200,
            headers: { "content-type": "text/html" },
            body: new TextEncoder().encode(
              '<title>Research</title><meta property="og:image" content="/image"><p>Finding</p>',
            ),
          }
        : {
            status: 302,
            headers: { location: "http://127.0.0.1/image" },
            body: new Uint8Array(),
          };
    expect(
      await createSmartLinkPreview(network)("https://example.org/research"),
    ).toMatchObject({ kind: "preview", title: "Research", image: null });
  });
  test("keeps the text preview when optional image metadata contains an invalid URL", async () => {
    const network = previewNetwork();
    network.safeImage = async () => "data:image/webp;base64,SAFE";
    network.request = async () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: new TextEncoder().encode(
        '<title>Research</title><meta property="og:image" content="http://[invalid"><p>Finding</p>',
      ),
    });
    expect(
      await createSmartLinkPreview(network)("https://example.org/research"),
    ).toMatchObject({ kind: "preview", title: "Research", image: null });
  });
  test("previews YouTube from bounded provider metadata without downloading its executable page shell", async () => {
    const network = previewNetwork();
    network.request = async (url) => {
      if (url.pathname !== "/oembed") {
        throw new Error("Page shell must not be needed");
      }
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: new TextEncoder().encode('{"title":"Research video"}'),
      };
    };
    expect(
      await createSmartLinkPreview(network)("https://youtu.be/dQw4w9WgXcQ"),
    ).toMatchObject({
      kind: "preview",
      title: "Research video",
      capturedContent: "Research video",
      player: { provider: "YouTube", videoId: "dQw4w9WgXcQ" },
    });
  });
});
