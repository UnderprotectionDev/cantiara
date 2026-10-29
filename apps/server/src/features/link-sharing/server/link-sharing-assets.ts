import { sha256Hex } from "./link-sharing-credentials";
import type {
  LinkSharingVisitorAccess,
  VisitorFile,
} from "./link-sharing-visitor";

/**
 * Link Sharing Dosya Eki delivery (spec 73, #484, ADR-0002). Every request,
 * whole or byte-range, goes through `authorizeFile` first: the current Dış
 * yüzey, the visitor session and the exact file version. Only after it answers
 * `granted` does anything read a cache or the object store, so a CDN or cache
 * entry can never beat revoke, expiry or redaction. The object store is read
 * by the product; no raw R2 or CDN URL ever reaches a visitor.
 */

/** Reads the exact stored object; `null` when it is missing. */
export interface LinkSharingObjectStore {
  read: (key: string) => Promise<Uint8Array | null>;
}

/** An optional origin/edge cache. It is consulted only after authorization. */
export interface LinkSharingAssetCache {
  get: (key: string) => Promise<Uint8Array | undefined>;
  set: (key: string, bytes: Uint8Array) => Promise<void>;
}

export type AssetResult =
  | {
      bytes: Uint8Array;
      end: number;
      file: VisitorFile;
      partial: boolean;
      start: number;
      status: "ok";
    }
  | { size: number; status: "unsatisfiable" }
  | { status: "denied" }
  | { status: "gone" }
  | { status: "unavailable" };

export interface LinkSharingAssets {
  deliver: (input: {
    attachmentId: string;
    cookieValue: string | undefined;
    /** The raw `Range` request header, if any. */
    range: string | null;
    surfaceId: string;
    versionId: string;
  }) => Promise<AssetResult>;
}

const RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * One `bytes=a-b`, `bytes=a-` or `bytes=-n` range. Anything else (a multi
 * range, another unit, garbage) is ignored and the whole file is served.
 * `"unsatisfiable"` is a well-formed range outside the file.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): { end: number; start: number } | "unsatisfiable" | null {
  const match = header ? RANGE.exec(header.trim()) : null;
  if (!match) {
    return null;
  }
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") {
    return null;
  }
  if (first === "") {
    const suffix = Number(last);
    return suffix === 0
      ? "unsatisfiable"
      : { end: size - 1, start: Math.max(0, size - suffix) };
  }
  const start = Number(first);
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  if (start >= size || end < start) {
    return "unsatisfiable";
  }
  return { end, start };
}

/** Bytes are served only when they are exactly the approved file version. */
function isExactVersion(bytes: Uint8Array, file: VisitorFile) {
  return (
    bytes.byteLength === file.byteSize &&
    sha256Hex(bytes).toLowerCase() === file.contentHash.toLowerCase()
  );
}

export function createLinkSharingAssets(options: {
  cache?: LinkSharingAssetCache;
  objects: LinkSharingObjectStore;
  visitor: LinkSharingVisitorAccess;
}): LinkSharingAssets {
  const { cache, objects, visitor } = options;

  async function exactBytes(file: VisitorFile) {
    const cacheKey = `${file.objectKey}:${file.contentHash}`;
    const cached = await cache?.get(cacheKey);
    if (cached && isExactVersion(cached, file)) {
      return cached;
    }
    const stored = await objects.read(file.objectKey);
    if (!(stored && isExactVersion(stored, file))) {
      return null;
    }
    await cache?.set(cacheKey, stored);
    return stored;
  }

  return {
    async deliver(input) {
      const authorization = await visitor.authorizeFile({
        attachmentId: input.attachmentId,
        cookieValue: input.cookieValue,
        surfaceId: input.surfaceId,
        versionId: input.versionId,
      });
      if (authorization.status !== "granted") {
        return authorization;
      }
      const { file } = authorization;
      const range = parseByteRange(input.range, file.byteSize);
      if (range === "unsatisfiable") {
        return { size: file.byteSize, status: "unsatisfiable" };
      }
      let bytes: Uint8Array | null = null;
      try {
        bytes = await exactBytes(file);
      } catch {
        bytes = null;
      }
      if (!bytes) {
        return { status: "unavailable" };
      }
      // A revoke that landed while the object was read still wins.
      const recheck = await visitor.authorizeFile({
        attachmentId: input.attachmentId,
        cookieValue: input.cookieValue,
        surfaceId: input.surfaceId,
        versionId: input.versionId,
      });
      if (recheck.status !== "granted") {
        return recheck;
      }
      const start = range?.start ?? 0;
      const end = range?.end ?? bytes.byteLength - 1;
      return {
        bytes: bytes.slice(start, end + 1),
        end,
        file,
        partial: range !== null,
        start,
        status: "ok",
      };
    },
  };
}
