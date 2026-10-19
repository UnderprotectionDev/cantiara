import { buildExportManifest, orderSnapshots } from "./manifest";
import type { WireframeSnapshot } from "./snapshot";
import { renderSvg } from "./svg";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Print document for PDF export: one page per chosen Screen version drawn from
 * the same SVG renderer, plus the manifest page. The PDF itself comes from the
 * browser's print-to-PDF of this document (the repo has no server-side
 * Playwright PDF pipeline to reuse; see structure.md). Links are not
 * interactive in PDF; their resolution is listed on the manifest page.
 */
export function renderPrintDocument(
  snapshots: readonly WireframeSnapshot[],
  options: { fontDataUri?: string } = {},
): string {
  const ordered = orderSnapshots(snapshots);
  const pages = ordered.map((snapshot) => {
    const { height, markup, width } = renderSvg(snapshot, {
      fontDataUri: options.fontDataUri,
    });
    return `<section class="page" data-screen-id="${escapeHtml(snapshot.screenId)}" style="width:${width}px;height:${height}px"><h1>${escapeHtml(snapshot.title)} - Wireframe version ${snapshot.version}</h1>${markup}</section>`;
  });
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    "<title>Wireframe export</title>",
    "<style>@page{margin:12mm}body{margin:0;font-family:system-ui,sans-serif}.page{break-after:page}h1{font-size:12px}pre{white-space:pre-wrap;font-size:11px}</style>",
    "</head><body>",
    ...pages,
    `<section class="page"><h1>Manifest</h1><pre>${escapeHtml(buildExportManifest(ordered))}</pre></section>`,
    "</body></html>",
    "",
  ].join("\n");
}
