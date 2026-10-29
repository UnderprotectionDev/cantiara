// biome-ignore-all lint/performance/useTopLevelRegex: assertions read clearer with inline patterns.
// biome-ignore-all lint/performance/noAwaitInLoops: requests are checked one after another on purpose.

import {
  WIKI_INDEXING_WARNING,
  type WikiPublishingError,
} from "@cantiara/api/wiki-publishing";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  createFixtures,
  createPublicSite,
  ROOT_BODY,
  ROOT_ID,
} from "./wiki-publishing-fixtures";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function published(
  options: {
    approve?: (ids: string[]) => string[];
    rootBody?: string;
    slug?: string;
    summary?: string;
  } = {},
) {
  const fixtures = createFixtures({ rootBody: options.rootBody });
  const preview = await fixtures.access.preview(ACCOUNT_ID, ROOT_ID);
  if (!preview) {
    throw new Error("preview expected");
  }
  const ids = preview.embeds.map((embed) => embed.id);
  const result = await fixtures.access.publish(ACCOUNT_ID, {
    approval: {
      approvedEmbedIds: options.approve ? options.approve(ids) : ids,
      fingerprint: preview.fingerprint,
      publishAnyway: true,
      slug: options.slug,
      summary: options.summary,
    },
    documentId: ROOT_ID,
  });
  if (!result) {
    throw new Error("publish expected");
  }
  const site = createPublicSite(fixtures);
  return { fixtures, path: `/${result.surfaceId}/page`, result, site };
}

describe("Wiki public page", () => {
  test("shows the approved snapshot read-only, without Workspace writes, palette, search or visitor surfaces", async () => {
    const { path, site } = await published({
      approve: (ids) => ids.filter((id) => !id.startsWith("backlink:")),
    });

    const response = await site.get(path);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Child notes");
    expect(html).toContain("Snapshot of Open bugs view on 2026-10-29");
    expect(html).not.toContain("Private journal");
    expect(html).not.toContain("CODE-123");
    expect(html).not.toMatch(/<(form|input|textarea|select)\b/u);
    expect(html.toLowerCase()).not.toMatch(
      /comment|vote|subscribe|feedback|search|command palette/u,
    );
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const write = await site.routes.request(path, { method });
      expect(write.status).toBe(404);
    }
  });

  test("sends the shared hardening headers", async () => {
    const { path, site } = await published();

    const response = await site.get(path);

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toMatch(/<a [^>]*href="http[^>]*>/u);
  });

  test("outbound links carry rel noreferrer and images never load on paint", async () => {
    const { path, site } = await published({
      rootBody: `${ROOT_BODY}\n\n[Docs](https://example.com/docs) ![shot](https://tracker.example/p.png)`,
    });

    const html = await (await site.get(path)).text();

    expect(html).toContain(
      'rel="noreferrer noopener nofollow" href="https://example.com/docs"',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("tracker.example");
  });
});

describe("Wiki indexing", () => {
  test("is noindex by default in the header and the page, and metadata never enables it", async () => {
    const { fixtures, path, result, site } = await published({
      slug: "release-habits",
      summary: "How I ship",
    });

    const response = await site.get(path);
    const html = await response.text();

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<meta name="description" content="How I ship">');
    expect(fixtures.surfaces.get(result.surfaceId)?.indexingEnabled).toBe(
      false,
    );
    const publication = await fixtures.access.publication(ACCOUNT_ID, ROOT_ID);
    expect(publication).toMatchObject({
      indexingEnabled: false,
      path: `/w/${result.surfaceId}/release-habits`,
    });
  });

  test("needs the explicit acknowledgement that third-party copies cannot be recalled", async () => {
    const { fixtures, path, site } = await published();
    expect(WIKI_INDEXING_WARNING).toContain("cannot be fully recalled");

    await expect(
      fixtures.access.setIndexing(ACCOUNT_ID, {
        acknowledgeThirdPartyCopies: false,
        documentId: ROOT_ID,
        enabled: true,
      }),
    ).rejects.toMatchObject({
      code: "WIKI_PUBLISHING_INDEXING_UNACKNOWLEDGED",
    } satisfies Partial<WikiPublishingError>);
    expect((await site.get(path)).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow",
    );

    await fixtures.access.setIndexing(ACCOUNT_ID, {
      acknowledgeThirdPartyCopies: true,
      documentId: ROOT_ID,
      enabled: true,
    });
    const indexed = await site.get(path);
    expect(indexed.headers.get("x-robots-tag")).toBeNull();
    expect(await indexed.text()).not.toContain('name="robots"');

    await fixtures.access.setIndexing(ACCOUNT_ID, {
      acknowledgeThirdPartyCopies: false,
      documentId: ROOT_ID,
      enabled: false,
    });
    expect((await site.get(path)).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow",
    );
  });

  test("a new approval keeps the indexing choice and never turns it on", async () => {
    const { fixtures } = await published();
    const preview = await fixtures.access.preview(ACCOUNT_ID, ROOT_ID);

    await fixtures.access.publish(ACCOUNT_ID, {
      approval: {
        approvedEmbedIds: [],
        fingerprint: preview?.fingerprint ?? "",
        publishAnyway: true,
        slug: "renamed",
        summary: "New summary",
      },
      documentId: ROOT_ID,
    });

    const publication = await fixtures.access.publication(ACCOUNT_ID, ROOT_ID);
    expect(publication?.indexingEnabled).toBe(false);
  });
});

describe("Wiki title, summary and slug", () => {
  test("come from the Document, not Build in Public; a slug change redirects nowhere", async () => {
    const { fixtures, result, site } = await published({
      slug: "first-slug",
      summary: "Own summary",
    });
    const preview = await fixtures.access.preview(ACCOUNT_ID, ROOT_ID);
    await fixtures.access.publish(ACCOUNT_ID, {
      approval: {
        approvedEmbedIds: [],
        fingerprint: preview?.fingerprint ?? "",
        publishAnyway: true,
        slug: "second-slug",
      },
      documentId: ROOT_ID,
    });

    const snapshot = [...fixtures.surfaces.values()][0]?.snapshots.at(-1);
    expect(snapshot).toMatchObject({
      slug: "second-slug",
      summary: null,
      title: "Release habits",
    });
    expect([...fixtures.surfaces.values()][0]?.projectId).toBeNull();
    for (const slug of ["first-slug", "second-slug", "anything"]) {
      const response = await site.get(`/${result.surfaceId}/${slug}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
    expect((await fixtures.access.publication(ACCOUNT_ID, ROOT_ID))?.path).toBe(
      `/w/${result.surfaceId}/second-slug`,
    );
  });

  test("defaults the slug from the Document title", async () => {
    const { fixtures } = await published();

    expect([...fixtures.surfaces.values()][0]?.snapshots.at(-1)?.slug).toBe(
      "release-habits",
    );
  });
});

describe("Wiki unpublish fails closed before any cache", () => {
  test("HTML, asset and range requests answer bodyless 410 Gone with noindex and never touch the object store", async () => {
    const { fixtures, result, site } = await published();
    const page = `/${result.surfaceId}/page`;
    const asset = `/${result.surfaceId}/assets/member-7/0`;
    expect((await site.get(page)).status).toBe(200);
    expect((await site.get(asset)).status).toBe(200);
    const readsBefore = site.objectReads.length;

    const publication = await fixtures.access.unpublish(ACCOUNT_ID, ROOT_ID);
    expect(publication).toMatchObject({ path: null, surfaceId: null });
    site.events.length = 0;

    for (const request of [
      site.get(page),
      site.get(asset),
      site.get(asset, { range: "bytes=2-4" }),
      site.get(`/${result.surfaceId}/anything`),
    ]) {
      const response = await request;
      expect(response.status).toBe(410);
      expect(await response.text()).toBe("");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(site.events).toEqual(["state", "state", "state", "state"]);
    expect(site.events).not.toContain("cache-get");
    expect(site.objectReads).toHaveLength(readsBefore);
  });

  test("checks the live state before reading the cache on a live request", async () => {
    const { path, site } = await published();
    await site.get(path);
    site.events.length = 0;

    await site.get(path);

    expect(site.events).toEqual(["state", "cache-get"]);
  });

  test("an unknown surface answers the same generic 410", async () => {
    const { site } = await published();

    const response = await site.get("/missing-surface/page");

    expect(response.status).toBe(410);
    expect(await response.text()).toBe("");
  });

  test("the URL is never reused: publishing again makes a new surface and the old URL stays gone", async () => {
    const { fixtures, path, result, site } = await published();
    await fixtures.access.unpublish(ACCOUNT_ID, ROOT_ID);
    const preview = await fixtures.access.preview(ACCOUNT_ID, ROOT_ID);

    const again = await fixtures.access.publish(ACCOUNT_ID, {
      approval: {
        approvedEmbedIds: [],
        fingerprint: preview?.fingerprint ?? "",
        publishAnyway: true,
      },
      documentId: ROOT_ID,
    });

    expect(again?.surfaceId).not.toBe(result.surfaceId);
    expect(again?.revision).toBe(1);
    expect((await site.get(path)).status).toBe(410);
    expect((await site.get(`/${again?.surfaceId}/page`)).status).toBe(200);
  });

  test("only the owner can unpublish or change indexing", async () => {
    const { fixtures, path, site } = await published();

    expect(await fixtures.access.unpublish("account-2", ROOT_ID)).toBeNull();
    expect(
      await fixtures.access.setIndexing("account-2", {
        acknowledgeThirdPartyCopies: true,
        documentId: ROOT_ID,
        enabled: true,
      }),
    ).toBeNull();
    expect((await site.get(path)).status).toBe(200);
  });
});

describe("Wiki assets and ranges", () => {
  async function assetPath() {
    const harness = await published();
    const snapshot = [...harness.fixtures.surfaces.values()][0]?.snapshots[0];
    const member = snapshot?.members.find(
      (candidate) => candidate.kind === "Attachment",
    );
    return {
      ...harness,
      asset: `/${harness.result.surfaceId}/assets/${member?.memberId}/0`,
    };
  }

  test("serves the exact approved file version through the surface-scoped URL without exposing an object URL", async () => {
    const { asset, site } = await assetPath();

    const response = await site.get(asset);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("0123456789");
    expect(site.objectReads).toEqual([{ attachmentId: "file-1", version: 3 }]);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("location")).toBeNull();
    expect([...response.headers.values()].join(" ")).not.toMatch(
      /r2\.|cloudflarestorage|https?:\/\//u,
    );
  });

  test("answers valid byte ranges with 206 and invalid ones with 416", async () => {
    const { asset, site } = await assetPath();

    const partial = await site.get(asset, { range: "bytes=2-4" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(await partial.text()).toBe("234");

    const suffix = await site.get(asset, { range: "bytes=-3" });
    expect(await suffix.text()).toBe("789");

    const invalid = await site.get(asset, { range: "bytes=50-60" });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
  });

  test("an unapproved or unknown member has no asset URL", async () => {
    const harness = await published({
      approve: (ids) => ids.filter((id) => !id.startsWith("attachment:")),
    });

    const response = await harness.site.get(
      `/${harness.result.surfaceId}/assets/member-1/0`,
    );

    expect(response.status).toBe(410);
    expect(await response.text()).toBe("");
  });
});

describe("Wiki YouTube click-to-load", () => {
  test("paints a labeled card with the original URL and no third-party request or frame", async () => {
    const { path, site } = await published({
      rootBody: `${ROOT_BODY}\n\n${YOUTUBE_URL}`,
    });

    const response = await site.get(path);
    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(html).toContain("Live external source");
    expect(html).toContain(`href="${YOUTUBE_URL}"`);
    expect(html).toContain('<button type="button" class="yt-load"');
    expect(html).not.toContain("<iframe");
    expect(html).not.toMatch(/<script[^>]*\ssrc=/u);
    expect(html).not.toMatch(/<link[^>]*href="http/u);
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toMatch(/script-src 'nonce-[^']+'/u);
    expect(csp).not.toContain("https://www.youtube.com");
  });

  test("a page without a video allows no script or frame at all", async () => {
    const { path, site } = await published();

    const response = await site.get(path);
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(await response.text()).not.toContain("<script");
  });
});
