// biome-ignore-all lint/suspicious/noMisplacedAssertion: expectGone is the shared 410 assertion helper.
import type { Context } from "@cantiara/api/context";
import {
  type CachedSurfaceResponse,
  createExternalSurfaceAccess,
  createMemoryExternalSurfaceResponseCache,
  type ExternalSurfaceStateReader,
} from "@cantiara/api/external-surface-access";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  createExternalSurfaceManagement,
  type SurfaceRecord,
} from "../external-surface-management";
import {
  createSurfacePurges,
  type PurgeTarget,
  purgeBackoffMs,
} from "../external-surface-purge";
import {
  ACCOUNT,
  buildInPublicSurface,
  memoryDirectory,
  memoryPurgeStore,
  surface,
  wikiSurface,
} from "./external-surface-management-fixtures";

/**
 * Spec 76 #494 at the External Surface Management seam: removal from a row
 * uses the shared lifecycle, and the old URL answers a bodyless `410 Gone`
 * through the shared access module whatever happens to the purge request.
 */

const ORIGIN = "https://api.cantiara.example";
const START = new Date("2026-10-29T10:00:00.000Z");
const PAGE_HTML = new TextEncoder().encode("<h1>Private plan</h1>");
const FILE_BYTES = new TextEncoder().encode("0123456789abcdefghij");

function setup(
  options: { failPurge?: () => boolean; records?: SurfaceRecord[] } = {},
) {
  const records = options.records ?? [surface(), wikiSurface()];
  let current = START;
  const clock = {
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    now: () => current,
  };
  const calls: string[] = [];
  const cache = createMemoryExternalSurfaceResponseCache();
  const reader: ExternalSurfaceStateReader = {
    read: (surfaceId) => {
      const found = records.find((record) => record.surfaceId === surfaceId);
      return Promise.resolve(
        found
          ? {
              cancelled: found.cancelledAt !== null,
              indexingEnabled: false,
              revision: found.revision?.number ?? 1,
            }
          : null,
      );
    },
  };
  const access = createExternalSurfaceAccess({ cache, reader });
  const purgeStore = memoryPurgeStore(() =>
    records
      .filter((record) => record.cancelledAt)
      .map((record) => record.surfaceId),
  );
  const purgeTarget: PurgeTarget = async (surfaceId) => {
    await cache.purge?.(surfaceId);
    if (options.failPurge?.()) {
      throw new Error("cache unreachable");
    }
  };
  const purges = createSurfacePurges({
    now: clock.now,
    store: purgeStore,
    targets: [purgeTarget],
  });
  const directory = memoryDirectory(records);
  const management = createExternalSurfaceManagement({
    linkSource: () => Promise.resolve({ hasChanges: false }),
    now: clock.now,
    purges,
    // The shared lifecycle owns the terminal write; the double only records it.
    revokeLink: (_accountId, surfaceId) => {
      calls.push(`revoke:${surfaceId}`);
      const found = records.find((record) => record.surfaceId === surfaceId);
      if (!found || found.cancelledAt) {
        return Promise.resolve(null);
      }
      found.cancelledAt = clock.now();
      return Promise.resolve({ surfaceId });
    },
    store: directory,
    unpublishWiki: (_accountId, documentId) => {
      calls.push(`unpublish:${documentId}`);
      const found = records.find((record) => record.documentId === documentId);
      if (!found || found.cancelledAt) {
        return Promise.resolve(null);
      }
      found.cancelledAt = clock.now();
      return Promise.resolve({ documentId });
    },
  });
  const context = {
    externalSurfaceManagement: management,
    session: { session: { id: "session" }, user: { id: ACCOUNT } },
  } as unknown as Context;
  const client = createRouterClient(appRouter, { context });
  const page = (surfaceId: string) =>
    access.page(new Request(`${ORIGIN}/shared/${surfaceId}`), surfaceId, {
      render: () =>
        Promise.resolve({ body: PAGE_HTML, contentType: "text/html" }),
    });
  const asset = (surfaceId: string, range?: string) =>
    access.asset(
      new Request(`${ORIGIN}/shared/${surfaceId}/files/a/v`, {
        headers: range ? { range } : {},
      }),
      surfaceId,
      {
        assetKey: "a:v",
        open: () =>
          Promise.resolve({
            body: FILE_BYTES,
            contentType: "application/pdf",
          }),
      },
    );
  return {
    asset,
    cache,
    calls,
    clock,
    client,
    management,
    page,
    purgeStore,
    purges,
    records,
  };
}

async function expectGone(response: Response) {
  expect(response.status).toBe(410);
  expect(await response.text()).toBe("");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
}

describe("removing a surface from the directory", () => {
  test("a link and a Wiki page go through the shared Revoke and Unpublish transitions", async () => {
    const { calls, client } = setup();
    expect(
      await client.removeExternalSurface({ surfaceId: "s-link" }),
    ).toMatchObject({
      status: "Revoked",
      surfaceId: "s-link",
    });
    expect(
      await client.removeExternalSurface({ surfaceId: "s-wiki" }),
    ).toMatchObject({
      status: "Revoked",
      surfaceId: "s-wiki",
    });
    expect(calls).toEqual(["revoke:s-link", "unpublish:wiki-1"]);
  });

  test("the old URL answers a bodyless 410 with noindex and no redirect for page, file and range", async () => {
    const { asset, client, page } = setup();
    expect((await page("s-link")).status).toBe(200);
    await client.removeExternalSurface({ surfaceId: "s-link" });
    await expectGone(await page("s-link"));
    await expectGone(await asset("s-link"));
    await expectGone(await asset("s-link", "bytes=0-4"));
    await expectGone(await asset("s-link", "bytes=-5"));
  });

  test("a cached page or file is never delivered after removal and the purge drops it", async () => {
    const { asset, cache, client, page } = setup();
    await page("s-link");
    await asset("s-link");
    const planted: CachedSurfaceResponse = {
      body: PAGE_HTML,
      headers: { "content-type": "text/html" },
      status: 200,
    };
    await cache.set("s-link:1:planted", planted);
    await client.removeExternalSurface({ surfaceId: "s-link" });
    await expectGone(await page("s-link"));
    await expectGone(await asset("s-link"));
    expect(await cache.get("s-link:1:page:false")).toBeNull();
    expect(await cache.get("s-link:1:planted")).toBeNull();
  });

  test("a purge failure shows Retrying with the next attempt and never reopens the URL; a later sweep completes it", async () => {
    let failing = true;
    const { clock, client, management, page, purges } = setup({
      failPurge: () => failing,
    });
    const removed = await client.removeExternalSurface({ surfaceId: "s-link" });
    expect(removed.purge).toMatchObject({ attempts: 1, status: "Retrying" });
    expect(removed.purge.nextAttemptAt).toBe(
      new Date(START.getTime() + purgeBackoffMs(1)).toISOString(),
    );
    await expectGone(await page("s-link"));

    const row = (await management.list(ACCOUNT, {}))?.rows.find(
      (entry) => entry.surfaceId === "s-link",
    );
    expect(row?.status).toBe("Revoked");
    expect(row?.purge).toMatchObject({ attempts: 1, status: "Retrying" });

    // Not due yet: nothing runs.
    expect(await purges.sweep()).toBe(0);
    failing = false;
    clock.advance(purgeBackoffMs(1) + 1);
    expect(await purges.sweep()).toBe(1);
    const done = (await management.list(ACCOUNT, {}))?.rows.find(
      (entry) => entry.surfaceId === "s-link",
    );
    expect(done?.purge).toEqual({
      attempts: 2,
      nextAttemptAt: null,
      status: "Done",
    });
    await expectGone(await page("s-link"));
  });

  test("the purge backs off up to an hour", () => {
    expect(purgeBackoffMs(1)).toBe(60_000);
    expect(purgeBackoffMs(2)).toBe(120_000);
    expect(purgeBackoffMs(20)).toBe(60 * 60 * 1000);
  });

  test("removing again changes nothing and mints no new surface or URL", async () => {
    const { calls, client, records } = setup();
    const first = await client.removeExternalSurface({ surfaceId: "s-link" });
    const second = await client.removeExternalSurface({ surfaceId: "s-link" });
    expect(second.surfaceId).toBe(first.surfaceId);
    expect(calls).toEqual(["revoke:s-link"]);
    expect(records.map((record) => record.surfaceId)).toEqual([
      "s-link",
      "s-wiki",
    ]);
    const { rows } = await client.listExternalSurfaces({});
    expect(rows.map((row) => row.surfaceId)).toEqual(
      expect.arrayContaining(["s-link", "s-wiki"]),
    );
    expect(rows).toHaveLength(2);
  });

  test("a removed surface whose source was deleted or trashed still answers 410 and shows no content", async () => {
    const { client, page, records } = setup({
      records: [wikiSurface({ documentId: null, wikiDocumentRevision: null })],
    });
    expect(records[0]?.cancelledAt).toBeNull();
    // A kept, detached Wiki surface has no Document; removal still cancels it.
    await client.removeExternalSurface({ surfaceId: "s-wiki" });
    await expectGone(await page("s-wiki"));
    const { rows } = await client.listExternalSurfaces({});
    const [row] = rows;
    expect(row).toMatchObject({ actions: [], status: "Revoked" });
    expect(JSON.stringify(row)).not.toContain("Private plan");
  });

  test("the result and the rows carry no counter, last access or visitor", async () => {
    const { client } = setup();
    const removed = await client.removeExternalSurface({ surfaceId: "s-link" });
    const { rows } = await client.listExternalSurfaces({});
    const serialized = JSON.stringify({ removed, rows });
    for (const key of [
      "views",
      "viewCount",
      "lastAccess",
      "visitor",
      "ip",
      "device",
      "token",
      "password",
    ]) {
      expect(serialized).not.toContain(`"${key}":`);
    }
  });

  test("another account cannot remove and a surface that is not found answers not found", async () => {
    const { management } = setup();
    expect(
      await management.remove("account-2", { surfaceId: "s-link" }),
    ).toBeNull();
    expect(
      await management.remove(ACCOUNT, { surfaceId: "missing" }),
    ).toBeNull();
  });

  test("Build in Public is refused until its own surface owns the transition", async () => {
    const { client } = setup({ records: [buildInPublicSurface()] });
    await expect(
      client.removeExternalSurface({ surfaceId: "s-bip" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
