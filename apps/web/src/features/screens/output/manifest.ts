import { linksOf } from "./links";
import type { WireframeSnapshot } from "./snapshot";

export const EXPORT_MANIFEST_FORMAT = "cantiara.wireframe-export 1";

/** Stable order for output: the chosen set, not the click order, defines the file. */
export function orderSnapshots(
  snapshots: readonly WireframeSnapshot[],
): WireframeSnapshot[] {
  return [...snapshots].sort((left, right) =>
    `${left.title}\u0000${left.screenId}` <
    `${right.title}\u0000${right.screenId}`
      ? -1
      : 1,
  );
}

/**
 * Human-readable manifest. It lists each Screen with its exact Wireframe
 * version and content digest, then the supported links with their resolution.
 * It holds no time, host, user or product URL, so the same versions always
 * produce the same text.
 */
export function buildExportManifest(
  snapshots: readonly WireframeSnapshot[],
): string {
  const ordered = orderSnapshots(snapshots);
  const lines = [
    EXPORT_MANIFEST_FORMAT,
    `Screens: ${ordered.length}`,
    "",
    ...ordered.map(
      (item) =>
        `- ${item.title} | Screen ${item.screenId} | Wireframe version ${item.version} (${item.sealed ? "sealed" : "working"}) | digest ${item.digest}`,
    ),
    "",
    "Links:",
  ];
  const links = ordered.flatMap((item) =>
    linksOf(item, ordered).map(
      (link) =>
        `- ${item.title} v${item.version} / block ${link.blockId} -> ${
          link.state === "resolved"
            ? `${link.targetTitle} v${link.targetVersion} (Screen ${link.targetScreenId})`
            : `Unresolved (Screen ${link.targetScreenId})`
        }`,
    ),
  );
  return [...lines, ...(links.length > 0 ? links : ["- none"]), ""].join("\n");
}
