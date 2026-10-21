import { expect, test } from "vitest";
import { youtubePlayerRoutes } from "../youtube-player-page";

const SCRIPT_NONCE = /<script nonce="([^"]+)"/u;

test("native YouTube document identifies its HTTPS origin and refuses arbitrary URLs or markup", async () => {
  const response = await youtubePlayerRoutes.request(
    "https://api.example.org/dQw4w9WgXcQ",
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const html = await response.text();
  expect(html).toContain('videoId: "dQw4w9WgXcQ"');
  expect(html).toContain("origin: window.location.origin");
  expect(html).toContain("autoplay: 0");
  expect(html).toContain("https://www.youtube-nocookie.com");
  const nonce = html.match(SCRIPT_NONCE)?.[1];
  expect(nonce).toBeTruthy();
  expect(response.headers.get("content-security-policy")).toContain(
    `'nonce-${nonce}'`,
  );
  expect(response.headers.get("content-security-policy")).not.toContain(
    "unsafe-inline",
  );
  expect(
    (await youtubePlayerRoutes.request("https://api.example.org/%3Cscript%3E"))
      .status,
  ).toBe(400);
  expect(
    (
      await youtubePlayerRoutes.request(
        "https://api.example.org/https%3A%2F%2Fevil.example",
      )
    ).status,
  ).toBe(400);
});

test.each(["chromium", "webkit"] as const)(
  "%s: a sandboxed native bridge sends the HTTPS Referer to YouTube and relays readiness and restrictions",
  async (engine) => {
    const playwright = await import("playwright");
    const browser = await playwright[engine].launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let referer: string | undefined;
      await page.route(
        "https://api.example.org/smart-link/youtube/*",
        async (route) => {
          const response = await youtubePlayerRoutes.request(
            "https://api.example.org/dQw4w9WgXcQ",
          );
          await route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: await response.text(),
          });
        },
      );
      await page.route("https://www.youtube.com/iframe_api", async (route) => {
        await route.fulfill({
          contentType: "application/javascript",
          body: `
window.YT = { Player: function(target, options) {
  const frame = document.createElement("iframe");
  frame.src = "https://www.youtube-nocookie.com/embed/" + options.videoId;
  document.getElementById(target).replaceWith(frame);
  this.destroy = () => frame.remove();
  this.cueVideoById = () => {};
  window.providerError = options.events.onError;
  frame.onload = () => options.events.onReady({ target: this });
} };
window.onYouTubeIframeAPIReady();`,
        });
      });
      await page.route(
        "https://www.youtube-nocookie.com/embed/*",
        async (route) => {
          ({ referer } = route.request().headers());
          await route.fulfill({
            contentType: "text/html",
            body: "YouTube boundary double",
          });
        },
      );
      await page.route("https://tauri.localhost/", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<script>window.statuses=[];addEventListener('message', e => window.statuses.push(e.data.status));</script><iframe sandbox="allow-scripts allow-same-origin allow-presentation" src="https://api.example.org/smart-link/youtube/dQw4w9WgXcQ"></iframe>`,
        }),
      );
      await page.goto("https://tauri.localhost/");
      await page.waitForFunction("window.statuses.includes('ready')");
      expect(referer).toBe("https://api.example.org/");
      const frame = page
        .frames()
        .find((item) => item.url().startsWith("https://api.example.org/"));
      if (!frame) {
        throw new Error("Hosted player required");
      }
      await frame.evaluate("window.providerError()");
      await page.waitForFunction("window.statuses.includes('error')");
      expect(await frame.locator("iframe").count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  30_000,
);
