/**
 * Shared Dış yüzey access module (PRD 14, ADR-0002). Every public page, asset
 * and byte-range request is verified against the current surface state before
 * any cache is read. It is not specific to Wiki Publishing: Link Sharing
 * (spec 73) and Build in Public (spec 75) reuse it and add only their own
 * visitor-session check on top.
 *
 * It speaks Web `Request`/`Response` only and never builds an object-store URL,
 * so a raw R2/CDN address cannot leave through it.
 */

/** The live facts of one Dış yüzey; read on every request, never cached. */
export interface ExternalSurfaceState {
  /** Terminal: unpublish, revoke or cancel. A cancelled surface is never reopened. */
  cancelled: boolean;
  /** Only the founder's explicit action sets this; metadata never does. */
  indexingEnabled: boolean;
  /** Latest Onaylı snapshot revizyonu number; a new approval changes it. */
  revision: number;
}

export interface ExternalSurfaceStateReader {
  /** Null for an unknown surface; the caller treats it exactly like a cancelled one. */
  read: (surfaceId: string) => Promise<ExternalSurfaceState | null>;
}

export interface CachedSurfaceResponse {
  body: Uint8Array;
  headers: Record<string, string>;
  status: number;
}

/** Delivery cache. It is only consulted after the live state allowed the request. */
export interface ExternalSurfaceResponseCache {
  get: (key: string) => Promise<CachedSurfaceResponse | null>;
  /** Drops every entry of one surface (the product-controlled purge of a removed surface). */
  purge?: (surfaceId: string) => Promise<void>;
  set: (key: string, value: CachedSurfaceResponse) => Promise<void>;
}

export interface SurfaceDelivery {
  body: Uint8Array;
  /** Page HTML or the asset type. */
  contentType: string;
  /** Content-Security-Policy of this response; defaults to `default-src 'none'`. */
  csp?: string;
  /** Extra headers such as `content-disposition`; the access module owns the security headers. */
  headers?: Record<string, string>;
}

export interface SurfacePageOptions {
  /** Builds the page for the current revision; null means there is nothing to show. */
  render: (state: ExternalSurfaceState) => Promise<SurfaceDelivery | null>;
}

export interface SurfaceAssetOptions {
  /** Cache key part naming the exact asset and version (never an object-store URL). */
  assetKey: string;
  /** Loads the exact approved file version, or null when it is not part of the snapshot (answers 404). */
  open: (state: ExternalSurfaceState) => Promise<SurfaceDelivery | null>;
}

export const SURFACE_NOINDEX = "noindex, nofollow";
export const SURFACE_REFERRER_POLICY = "no-referrer";

/** Bodyless `410 Gone` with `noindex`; the same answer for revoked, unpublished and unknown. */
export function goneResponse() {
  return new Response(null, {
    headers: {
      "cache-control": "no-store",
      "referrer-policy": SURFACE_REFERRER_POLICY,
      "x-robots-tag": SURFACE_NOINDEX,
    },
    status: 410,
  });
}

/** Headers only the access module may set; a delivery can never override them. */
const OWNED_HEADERS = new Set([
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-security-policy",
  "content-type",
  "cross-origin-resource-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-robots-tag",
]);

/** Bodyless `404 Not Found` for an unknown member or file of a live surface. */
export function notFoundResponse() {
  return new Response(null, {
    headers: {
      "cache-control": "no-store",
      "referrer-policy": SURFACE_REFERRER_POLICY,
      "x-robots-tag": SURFACE_NOINDEX,
    },
    status: 404,
  });
}

function surfaceHeaders(
  state: ExternalSurfaceState,
  delivery: SurfaceDelivery,
) {
  const extra = Object.fromEntries(
    Object.entries(delivery.headers ?? {}).filter(
      ([name]) => !OWNED_HEADERS.has(name.toLowerCase()),
    ),
  );
  const headers: Record<string, string> = {
    ...extra,
    // A copy in a shared cache would outlive a revoke, so the response itself is uncacheable.
    "cache-control": "private, no-store",
    "content-security-policy": delivery.csp ?? "default-src 'none'",
    "content-type": delivery.contentType,
    "referrer-policy": SURFACE_REFERRER_POLICY,
    "x-content-type-options": "nosniff",
  };
  if (!state.indexingEnabled) {
    headers["x-robots-tag"] = SURFACE_NOINDEX;
  }
  return headers;
}

export interface ByteRange {
  end: number;
  start: number;
}

const RANGE_HEADER = /^bytes=(\d*)-(\d*)$/u;

/**
 * One `bytes=a-b`, `bytes=a-` or `bytes=-n` range. `invalid` answers 416;
 * `null` means no usable `Range` header (a full response). Per RFC 9110 a
 * multi-range, whitespace-carrying or otherwise unsupported header is *not*
 * invalid: it is ignored and the caller answers the full response. Only a
 * well-formed but unsatisfiable range answers 416.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "invalid" | null {
  if (!header) {
    return null;
  }
  const match = RANGE_HEADER.exec(header.trim());
  if (!match) {
    return null;
  }
  if (match[1] === "" && match[2] === "") {
    return "invalid";
  }
  if (match[1] === "") {
    const suffix = Number(match[2]);
    return suffix === 0
      ? "invalid"
      : { end: size - 1, start: Math.max(0, size - suffix) };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start >= size || start > end ? "invalid" : { end, start };
}

export interface MemorySurfaceCacheOptions {
  /** Cached responses held at most; the least recently used entry is evicted first. */
  maxEntries?: number;
  /** A body at or above this size is never cached, so big assets cannot exhaust memory. */
  maxEntryBytes?: number;
}

/**
 * A small in-process delivery cache for `createExternalSurfaceAccess`. Entries
 * never go stale: page and asset cache keys carry the revision and the
 * indexing flag, so any changed surface answers by missing. The bounds exist
 * for memory hygiene only; a cancelled surface is never consulted through it
 * because the live state check runs before every `get`.
 */
export function createMemoryExternalSurfaceResponseCache(
  options: MemorySurfaceCacheOptions = {},
): ExternalSurfaceResponseCache {
  const maxEntries = options.maxEntries ?? 32;
  const maxEntryBytes = options.maxEntryBytes ?? 4 * 1024 * 1024;
  const entries = new Map<string, CachedSurfaceResponse>();
  return {
    // biome-ignore lint/suspicious/useAwait: an in-memory purge answers directly.
    purge: async (surfaceId) => {
      for (const key of [...entries.keys()]) {
        if (key.startsWith(`${surfaceId}:`)) {
          entries.delete(key);
        }
      }
    },
    // biome-ignore lint/suspicious/useAwait: an in-memory read answers directly.
    get: async (key) => {
      const value = entries.get(key);
      if (!value) {
        return null;
      }
      // Reinserting keeps the map in recency order without a separate list.
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    // biome-ignore lint/suspicious/useAwait: an in-memory write answers directly.
    set: async (key, value) => {
      if (value.body.byteLength >= maxEntryBytes) {
        return;
      }
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) {
          break;
        }
        entries.delete(oldest.value);
      }
    },
  };
}

export interface ExternalSurfaceAccess {
  /** An approved asset or byte range of one surface. */
  asset: (
    request: Request,
    surfaceId: string,
    options: SurfaceAssetOptions,
  ) => Promise<Response>;
  /** The HTML page of one surface. */
  page: (
    request: Request,
    surfaceId: string,
    options: SurfacePageOptions,
  ) => Promise<Response>;
}

export function createExternalSurfaceAccess(options: {
  cache?: ExternalSurfaceResponseCache;
  reader: ExternalSurfaceStateReader;
}): ExternalSurfaceAccess {
  const { cache, reader } = options;

  /** The live check. Nothing below runs, and no cache is read, when it fails. */
  async function allowed(surfaceId: string) {
    const state = await reader.read(surfaceId);
    return state && !state.cancelled ? state : null;
  }

  async function cached(
    key: string,
    build: () => Promise<CachedSurfaceResponse | null>,
  ) {
    const hit = await cache?.get(key);
    if (hit) {
      return hit;
    }
    const built = await build();
    if (built) {
      await cache?.set(key, built);
    }
    return built;
  }

  return {
    asset: async (request, surfaceId, assetOptions) => {
      const state = await allowed(surfaceId);
      if (!state) {
        return goneResponse();
      }
      const key = `${surfaceId}:${state.revision}:${assetOptions.assetKey}`;
      // The cached entry is the whole file; the range is checked on every request.
      const full = await cached(key, async () => {
        const delivery = await assetOptions.open(state);
        return delivery
          ? {
              body: delivery.body,
              headers: {
                ...delivery.headers,
                "content-type": delivery.contentType,
              },
              status: 200,
            }
          : null;
      });
      if (!full) {
        // The surface is live, so a missing member or file is an unknown path, not a removal.
        return notFoundResponse();
      }
      const contentType =
        full.headers["content-type"] || "application/octet-stream";
      const { "content-type": _type, ...extra } = full.headers;
      const delivery = { body: full.body, contentType, headers: extra };
      const headers = {
        ...surfaceHeaders(state, {
          ...delivery,
          csp: "default-src 'none'; sandbox",
        }),
        "accept-ranges": "bytes",
        "cross-origin-resource-policy": "same-origin",
      };
      const range = parseByteRange(
        request.headers.get("range"),
        full.body.length,
      );
      if (range === "invalid") {
        return new Response(null, {
          headers: {
            ...headers,
            "content-range": `bytes */${full.body.length}`,
          },
          status: 416,
        });
      }
      if (!range) {
        return new Response(full.body, {
          headers: { ...headers, "content-length": String(full.body.length) },
          status: 200,
        });
      }
      const slice = full.body.slice(range.start, range.end + 1);
      return new Response(slice, {
        headers: {
          ...headers,
          "content-length": String(slice.length),
          "content-range": `bytes ${range.start}-${range.end}/${full.body.length}`,
        },
        status: 206,
      });
    },

    page: async (_request, surfaceId, pageOptions) => {
      const state = await allowed(surfaceId);
      if (!state) {
        return goneResponse();
      }
      const key = `${surfaceId}:${state.revision}:page:${state.indexingEnabled}`;
      const page = await cached(key, async () => {
        const delivery = await pageOptions.render(state);
        return delivery
          ? {
              body: delivery.body,
              headers: surfaceHeaders(state, delivery),
              status: 200,
            }
          : null;
      });
      return page
        ? new Response(page.body, {
            headers: page.headers,
            status: page.status,
          })
        : goneResponse();
    },
  };
}
