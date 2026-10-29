// biome-ignore-all lint/performance/useTopLevelRegex: assertions read clearer with inline patterns.
// biome-ignore-all lint/performance/noAwaitInLoops: requests are checked one after another on purpose.

import { createMemoryExternalSurfaceResponseCache } from "@cantiara/api/external-surface-access";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  approveItems,
  createFixtures,
  createPublicSite,
  memberFact,
  PROJECT_ID,
  workFact,
} from "./build-in-public-fixtures";

const YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function published(
  options: {
    attachments?: boolean;
    description?: string | null;
    owner?: { current: string | null };
  } = {},
) {
  const fixtures = createFixtures({
    attachments: options.attachments
      ? { "work-a": [{ id: "att-1", name: "spec.pdf", version: 2 }] }
      : undefined,
    members: [memberFact({ recordId: "doc-1", title: "Public doc" })],
    works: [
      workFact({
        description: options.description ?? null,
        id: "work-a",
        title: "Work A",
      }),
    ],
  });
  await approveItems(fixtures);
  const cache = createMemoryExternalSurfaceResponseCache();
  const site = createPublicSite(fixtures, {
    cache,
    ownerSession: options.owner,
  });
  const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
  return { fixtures, path: `/surface-1/${slug}`, site, slug };
}

describe("Build in Public visitor page", () => {
  test("is read-only with the shared hardening headers and noindex by default", async () => {
    const { path, site } = await published();

    const response = await site.get(path);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(html).not.toMatch(/<(form|input|textarea|select)\b/u);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect((await site.routes.request(path, { method })).status).toBe(404);
    }
  });

  test("shows owner controls only to the signed-in owner and never to a visitor", async () => {
    const owner = { current: ACCOUNT_ID as string | null };
    const { path, site } = await published({ owner });

    const ownerHtml = await (await site.get(path)).text();
    expect(ownerHtml).toContain("Open source record");
    expect(ownerHtml).toContain("Review publish diff");

    // The owner's cached page is not served to the next, anonymous request.
    owner.current = null;
    const visitorHtml = await (await site.get(path)).text();
    expect(visitorHtml).not.toContain("Open source record");
    expect(visitorHtml).not.toContain("Review publish diff");
    expect(visitorHtml).not.toContain("/projects/project-1");
  });

  test("loads an approved YouTube card only on click, with Live external source", async () => {
    const { path, site } = await published({ description: YOUTUBE });

    const response = await site.get(path);
    const html = await response.text();

    expect(html).toContain("Live external source");
    expect(html).toContain("Load video from YouTube");
    expect(html).not.toContain("<iframe");
    expect(html).not.toMatch(/<(img|link)\b|<script[^>]*src=/u);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toContain("sha256-");
  });

  test("a page without an approved card carries no script or frame", async () => {
    const { path, site } = await published();
    const response = await site.get(path);
    expect(await response.text()).not.toContain("<script");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-src 'none'");
  });

  test("lists no sitemap and exposes no page outside the surface routes", async () => {
    const { path, site } = await published();
    // An unknown surface id answers like an unpublished one: bodyless 410.
    for (const unknown of ["/sitemap.xml", "/robots.txt"]) {
      const response = await site.get(unknown);
      expect(response.status).toBe(410);
      expect(await response.text()).toBe("");
    }
    expect(await (await site.get(path)).text()).not.toMatch(/sitemap/iu);
  });
});

describe("Build in Public unpublish", () => {
  test("answers a bodyless 410 Gone with noindex for HTML, assets and ranges, through a warm cache", async () => {
    const { fixtures, path, site } = await published({ attachments: true });
    const assetPath = "/surface-1/assets/work-1/0";

    // Warm every cache entry first.
    expect((await site.get(path)).status).toBe(200);
    expect((await site.get(`${path}/roadmap`)).status).toBe(200);
    expect((await site.get(assetPath)).status).toBe(200);
    const range = await site.get(assetPath, {
      headers: { range: "bytes=0-3" },
    });
    expect(range.status).toBe(206);

    const result = await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);
    expect(result?.published).toBe(false);

    for (const [url, headers] of [
      [path, {}],
      [`${path}/roadmap`, {}],
      [`${path}/changelog`, {}],
      ["/surface-1", {}],
      [assetPath, {}],
      [assetPath, { range: "bytes=0-3" }],
    ] as const) {
      const response = await site.get(url, { headers });
      expect(response.status).toBe(410);
      expect(await response.text()).toBe("");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("location")).toBeNull();
    }
  });

  test("the URL is never reused and nothing redirects to private content", async () => {
    const { fixtures, path, site } = await published();
    await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);

    await approveItems(fixtures);

    expect(fixtures.surfaces).toHaveLength(2);
    expect(fixtures.surfaces[1]?.id).not.toBe("surface-1");
    const old = await site.get(path);
    expect(old.status).toBe(410);
    expect(old.headers.get("location")).toBeNull();
    const fresh = await site.get(
      `/surface-2/${fixtures.surfaces[1]?.slugs.canonical}`,
    );
    expect(fresh.status).toBe(200);
  });
});

describe("Build in Public asset and range", () => {
  test("serves the exact approved file version with fail-closed ranges", async () => {
    const { site } = await published({ attachments: true });

    const full = await site.get("/surface-1/assets/work-1/0");
    expect(full.status).toBe(200);
    expect(await full.text()).toBe("file-att-1-2");
    expect(full.headers.get("content-disposition")).toContain("attachment");
    expect(full.headers.get("accept-ranges")).toBe("bytes");

    const part = await site.get("/surface-1/assets/work-1/0", {
      headers: { range: "bytes=5-" },
    });
    expect(part.status).toBe(206);
    expect(await part.text()).toBe("att-1-2");
    const bad = await site.get("/surface-1/assets/work-1/0", {
      headers: { range: "bytes=500-600" },
    });
    expect(bad.status).toBe(416);
    expect((await site.get("/surface-1/assets/work-9/0")).status).toBe(404);
    expect((await site.get("/surface-1/assets/work-1/7")).status).toBe(404);
  });
});
