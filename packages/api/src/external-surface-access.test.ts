import { describe, expect, test } from "vitest";

import {
  createMemoryExternalSurfaceResponseCache,
  parseByteRange,
} from "./external-surface-access";

describe("parseByteRange", () => {
  test("reads single well-formed ranges", () => {
    expect(parseByteRange("bytes=2-4", 10)).toEqual({ end: 4, start: 2 });
    expect(parseByteRange("bytes=2-", 10)).toEqual({ end: 9, start: 2 });
    expect(parseByteRange("bytes=-3", 10)).toEqual({
      end: 9,
      start: 7,
    });
    expect(parseByteRange("bytes=0-99", 10)).toEqual({ end: 9, start: 0 });
  });

  test("well-formed but unsatisfiable ranges answer invalid (416)", () => {
    expect(parseByteRange("bytes=50-60", 10)).toEqual("invalid");
    expect(parseByteRange("bytes=9-2", 10)).toEqual("invalid");
    expect(parseByteRange("bytes=-0", 10)).toEqual("invalid");
  });

  test("unsupported or malformed headers are ignored, not unsatisfiable", () => {
    expect(parseByteRange("bytes=0-1,4-6", 10)).toBeNull();
    expect(parseByteRange("bytes=2-4 ", 10)).toEqual({ end: 4, start: 2 });
    expect(parseByteRange("bytes= 2-4", 10)).toBeNull();
    expect(parseByteRange("items=2-4", 10)).toBeNull();
    expect(parseByteRange(null, 10)).toBeNull();
  });
});

describe("createMemoryExternalSurfaceResponseCache", () => {
  function response(text: string) {
    return {
      body: new TextEncoder().encode(text),
      headers: {},
      status: 200,
    };
  }

  test("stores and returns entries", async () => {
    const cache = createMemoryExternalSurfaceResponseCache();
    await cache.set("key", response("page"));
    expect((await cache.get("key"))?.body).toEqual(response("page").body);
    expect(await cache.get("missing")).toBeNull();
  });

  test("evicts the least recently used entry beyond the entry bound", async () => {
    const cache = createMemoryExternalSurfaceResponseCache({
      maxEntries: 2,
    });
    await cache.set("first", response("1"));
    await cache.set("second", response("2"));
    await cache.set("third", response("3"));

    expect(await cache.get("first")).toBeNull();
    expect(await cache.get("second")).not.toBeNull();
    expect(await cache.get("third")).not.toBeNull();

    // A read refreshes recency: `second` survives while `third` is evicted.
    await cache.get("second");
    await cache.set("fourth", response("4"));
    expect(await cache.get("second")).not.toBeNull();
    expect(await cache.get("third")).toBeNull();
  });

  test("refuses a body beyond the size bound", async () => {
    const cache = createMemoryExternalSurfaceResponseCache({
      maxEntryBytes: 4,
    });
    await cache.set("big", response("0123456789"));
    await cache.set("small", response("ok"));

    expect(await cache.get("big")).toBeNull();
    expect(await cache.get("small")).not.toBeNull();
  });
});
