import type { BuildInPublicSnapshot } from "@cantiara/api/build-in-public";
import {
  type BuildInPublicView,
  buildInPublicPath,
} from "@cantiara/api/build-in-public-publication";
import {
  type ExternalSurfaceAccess,
  type ExternalSurfaceStateReader,
  notFoundResponse,
  SURFACE_NOINDEX,
  SURFACE_REFERRER_POLICY,
} from "@cantiara/api/external-surface-access";
import { Hono } from "hono";

import {
  type OwnerControls,
  renderBuildInPublicPage,
} from "./build-in-public-public-page";
import type { BuildInPublicSlugs } from "./build-in-public-publication";

/** The latest Onaylı snapshot revizyonu of a Build in Public surface; read-only. */
export interface BuildInPublicSnapshotReader {
  latest: (surfaceId: string) => Promise<BuildInPublicSnapshot | null>;
}

export interface BuildInPublicSlugReader {
  read: (surfaceId: string) => Promise<BuildInPublicSlugs>;
}

/** Exact approved file version bytes; never a URL. */
export interface BuildInPublicAssetSource {
  open: (
    surfaceId: string,
    file: { attachmentId: string; version: number },
  ) => Promise<{
    bytes: Uint8Array;
    contentType: string;
    fileName: string;
  } | null>;
}

/**
 * Whether the request comes from the signed-in owner of this surface's
 * Project. It reads the founder's session and nothing about the visitor, and
 * is how `Open source record` and `Review publish diff` stay founder-only.
 */
export interface BuildInPublicViewer {
  controls: (
    request: Request,
    surfaceId: string,
  ) => Promise<OwnerControls | null>;
}

const textEncoder = new TextEncoder();
const MAX_PAGE = 10_000;
const NO_VIEWER: BuildInPublicViewer = {
  controls: () => Promise.resolve(null),
};

function pageOf(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("page") ?? 1);
  return Number.isInteger(raw) && raw >= 1 && raw <= MAX_PAGE ? raw : 1;
}

/** Only the canonical path of the same surface; never a path derived from content. */
function redirectResponse(location: string) {
  return new Response(null, {
    headers: {
      "cache-control": "no-store",
      location,
      "referrer-policy": SURFACE_REFERRER_POLICY,
      "x-robots-tag": SURFACE_NOINDEX,
    },
    status: 308,
  });
}

function assetFile(
  snapshot: BuildInPublicSnapshot | null,
  memberId: string,
  index: number,
) {
  if (!snapshot || index < 0) {
    return;
  }
  const files = memberId.startsWith("work-")
    ? snapshot.roadmap.find((work) => work.memberId === memberId)?.files
    : (snapshot.members ?? []).find((member) => member.memberId === memberId)
        ?.wall?.files;
  return files?.[index];
}

/**
 * The visitor-facing Build in Public routes. Read-only: only GET exists, so
 * there is no comment, vote, subscription or edit surface. Every request goes
 * through the shared Dış yüzey access module before any cache or render, and
 * the pages read only the surface's snapshot, never the Workspace.
 */
export function createBuildInPublicRoutes(options: {
  access: ExternalSurfaceAccess;
  assets: BuildInPublicAssetSource;
  now?: () => Date;
  reader: ExternalSurfaceStateReader;
  slugs: BuildInPublicSlugReader;
  snapshots: BuildInPublicSnapshotReader;
  viewer?: BuildInPublicViewer;
}) {
  const { access, assets, reader, slugs, snapshots } = options;
  const viewer = options.viewer ?? NO_VIEWER;
  const now = options.now ?? (() => new Date());
  const app = new Hono();

  app.get("/:surfaceId/assets/:memberId/:fileIndex", (c) => {
    const surfaceId = c.req.param("surfaceId");
    const memberId = c.req.param("memberId");
    const rawIndex = c.req.param("fileIndex");
    const fileIndex =
      Number.isInteger(Number(rawIndex)) &&
      String(Number(rawIndex)) === rawIndex
        ? Number(rawIndex)
        : -1;
    return access.asset(c.req.raw, surfaceId, {
      assetKey: `${memberId}:${fileIndex}`,
      open: async () => {
        const file = assetFile(
          await snapshots.latest(surfaceId),
          memberId,
          fileIndex,
        );
        if (!file) {
          return null;
        }
        const asset = await assets.open(surfaceId, {
          attachmentId: file.attachmentId,
          version: file.version,
        });
        if (!asset) {
          return null;
        }
        const safeName = asset.fileName.replace(/["\\\r\n]/gu, "_");
        return {
          body: asset.bytes,
          contentType: asset.contentType,
          headers: {
            "content-disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
          },
        };
      },
    });
  });

  async function servePage(
    request: Request,
    surfaceId: string,
    slug: string | undefined,
    view: BuildInPublicView,
  ) {
    const state = await reader.read(surfaceId);
    if (!state || state.cancelled) {
      // Unpublished, revoked and unknown answer the same bodyless 410 with noindex.
      return access.page(request, surfaceId, {
        render: () => Promise.resolve(null),
      });
    }
    const known = await slugs.read(surfaceId);
    const { canonical } = known;
    if (!canonical) {
      return notFoundResponse();
    }
    if (slug !== canonical) {
      // A redirect goes only from this surface's own earlier slug to its canonical path.
      if (slug === undefined || known.aliases.includes(slug)) {
        const query = new URL(request.url).search;
        return redirectResponse(
          `${buildInPublicPath(surfaceId, canonical, view)}${query}`,
        );
      }
      return notFoundResponse();
    }
    const snapshot = await snapshots.latest(surfaceId);
    if (!snapshot) {
      return access.page(request, surfaceId, {
        render: () => Promise.resolve(null),
      });
    }
    const owner = await viewer.controls(request, surfaceId);
    const page = pageOf(request);
    const at = now();
    const featuredOpen =
      snapshot.featured && new Date(snapshot.featured.endsAt) > at;
    return access.page(request, surfaceId, {
      render: (live) => {
        const rendered = renderBuildInPublicPage({
          indexable: live.indexingEnabled,
          now: at,
          owner,
          page,
          slug: canonical,
          snapshot,
          surfaceId,
          view,
        });
        return Promise.resolve({
          body: textEncoder.encode(rendered.html),
          contentType: "text/html; charset=utf-8",
          csp: rendered.csp,
        });
      },
      // The same bytes are shared only between the same view, page, viewer kind and window.
      variant: `${view}:${page}:${owner ? "owner" : "visitor"}:${featuredOpen ? "featured" : "plain"}:${canonical}`,
    });
  }

  app.get("/:surfaceId/:slug/roadmap", (c) =>
    servePage(
      c.req.raw,
      c.req.param("surfaceId"),
      c.req.param("slug"),
      "roadmap",
    ),
  );
  app.get("/:surfaceId/:slug/feed", (c) =>
    servePage(c.req.raw, c.req.param("surfaceId"), c.req.param("slug"), "feed"),
  );
  app.get("/:surfaceId/:slug/changelog", (c) =>
    servePage(
      c.req.raw,
      c.req.param("surfaceId"),
      c.req.param("slug"),
      "changelog",
    ),
  );
  app.get("/:surfaceId/:slug", (c) =>
    servePage(
      c.req.raw,
      c.req.param("surfaceId"),
      c.req.param("slug"),
      "project",
    ),
  );
  app.get("/:surfaceId", (c) =>
    servePage(c.req.raw, c.req.param("surfaceId"), undefined, "project"),
  );

  return app;
}
