import type { ExternalSurfaceAccess } from "@cantiara/api/external-surface-access";
import type { WikiDocumentSnapshot } from "@cantiara/api/wiki-publishing";
import { Hono } from "hono";

import { renderWikiPublicPage } from "./wiki-public-page";

/** The latest Onaylı snapshot revizyonu of a Wiki surface; read-only. */
export interface WikiPublicSnapshotReader {
  latest: (surfaceId: string) => Promise<WikiDocumentSnapshot | null>;
}

/** Exact approved file version bytes; never a URL. */
export interface WikiPublicAssetSource {
  open: (
    surfaceId: string,
    file: { attachmentId: string; version: number },
  ) => Promise<{
    bytes: Uint8Array;
    contentType: string;
    fileName: string;
  } | null>;
}

const textEncoder = new TextEncoder();

/**
 * The visitor-facing Wiki routes. Read-only: only GET exists, so there is no
 * comment, vote, subscription or edit surface to reach. Every request goes
 * through the shared Dış yüzey access module before any cache or render.
 */
export function createWikiPublicRoutes(options: {
  access: ExternalSurfaceAccess;
  assets: WikiPublicAssetSource;
  snapshots: WikiPublicSnapshotReader;
}) {
  const { access, assets, snapshots } = options;
  const app = new Hono();

  app.get("/:surfaceId/assets/:memberId/:fileIndex", (c) => {
    const surfaceId = c.req.param("surfaceId");
    const memberId = c.req.param("memberId");
    const fileIndex = Number(c.req.param("fileIndex"));
    return access.asset(c.req.raw, surfaceId, {
      assetKey: `${memberId}:${fileIndex}`,
      open: async () => {
        const snapshot = await snapshots.latest(surfaceId);
        const file = snapshot?.members.find(
          (member) => member.memberId === memberId,
        )?.files[fileIndex];
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

  // The slug is readable text only: any slug serves the page and nothing redirects.
  app.get("/:surfaceId/:slug?", (c) => {
    const surfaceId = c.req.param("surfaceId");
    return access.page(c.req.raw, surfaceId, {
      render: async (state) => {
        const snapshot = await snapshots.latest(surfaceId);
        if (!snapshot) {
          return null;
        }
        const page = renderWikiPublicPage(snapshot, {
          indexable: state.indexingEnabled,
          nonce: crypto.randomUUID(),
          surfaceId,
        });
        return {
          body: textEncoder.encode(page.html),
          contentType: "text/html; charset=utf-8",
          csp: page.csp,
        };
      },
    });
  });

  return app;
}
