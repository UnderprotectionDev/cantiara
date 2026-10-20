import { MOODBOARD_SNAPSHOT_LABELS } from "@cantiara/api/moodboard-snapshot";
import { cropPixelRect, type VisualView } from "@cantiara/api/moodboard-view";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

export const SNAPSHOT_IMAGE_MAX_EDGE = 1600;

/**
 * Presents one image the way this Moodboard view shows it: crop first, then the
 * clockwise rotation. Works on a copy of the input; the original bytes are
 * only read, and the result is a new PNG buffer.
 */
export async function presentVisualBytes(
  bytes: Uint8Array,
  view: VisualView,
): Promise<Uint8Array> {
  const oriented = await sharp(bytes, { failOn: "none" })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  let pipeline = sharp(oriented.data);
  if (view.crop) {
    const rect = cropPixelRect(
      { height: oriented.info.height, width: oriented.info.width },
      view.crop,
    );
    pipeline = sharp(await pipeline.extract(rect).toBuffer());
  }
  if (view.rotation !== 0) {
    pipeline = sharp(await pipeline.rotate(view.rotation).toBuffer());
  }
  return pipeline
    .resize({
      fit: "inside",
      height: SNAPSHOT_IMAGE_MAX_EDGE,
      width: SNAPSHOT_IMAGE_MAX_EDGE,
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export type SnapshotTile =
  | { caption: string | null; dataUri: string; kind: "image" }
  | { caption: string | null; kind: "placeholder"; label: string }
  | { color: string; kind: "swatch"; note: string | null };

export interface SnapshotRenderPage {
  generatedOn: string;
  moment: string;
  pageNumber: number;
  sectionTitle: string;
  tiles: SnapshotTile[];
  totalPages: number;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tileHtml(tile: SnapshotTile) {
  if (tile.kind === "swatch") {
    return `<figure class="tile"><div class="swatch" style="background:${escapeHtml(tile.color)}"></div><figcaption><code>${escapeHtml(tile.color)}</code>${tile.note ? `<br>${escapeHtml(tile.note)}` : ""}</figcaption></figure>`;
  }
  const caption = tile.caption
    ? `<figcaption>${escapeHtml(tile.caption)}</figcaption>`
    : "";
  if (tile.kind === "placeholder") {
    return `<figure class="tile"><div class="placeholder">${escapeHtml(tile.label)}</div>${caption}</figure>`;
  }
  return `<figure class="tile"><img alt="" src="${tile.dataUri}">${caption}</figure>`;
}

/**
 * One static HTML page per snapshot page. It holds data URIs, text, and colors
 * only: no anchor, no URL, no script, so the output cannot carry a live source
 * link.
 */
export function snapshotPageHtml(page: SnapshotRenderPage) {
  return `<section class="page"><header><h1>${escapeHtml(page.sectionTitle)}</h1><p>${escapeHtml(page.moment)} (page ${page.pageNumber} of ${page.totalPages})</p></header><div class="grid">${page.tiles.map(tileHtml).join("")}</div><footer>Snapshot generated ${escapeHtml(page.generatedOn)}. ${escapeHtml(MOODBOARD_SNAPSHOT_LABELS.noLiveLinksNotice)}</footer></section>`;
}

const SNAPSHOT_STYLE =
  "*{box-sizing:border-box}body{margin:0;font:14px sans-serif;color:#111;background:#fff}.page{width:1122px;height:793px;padding:32px;display:flex;flex-direction:column;overflow:hidden;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}h1{font-size:22px;margin:0 0 4px}header p{margin:0 0 16px;color:#555}.grid{flex:1;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:16px;min-height:0}.tile{margin:0;display:flex;flex-direction:column;min-height:0;gap:6px}.tile img,.swatch,.placeholder{flex:1;min-height:0;width:100%;object-fit:contain;border:1px solid #ddd;border-radius:6px}.placeholder{display:flex;align-items:center;justify-content:center;color:#666;background:#f5f5f5;text-align:center;padding:8px}figcaption{font-size:12px}footer{margin-top:12px;font-size:11px;color:#666}";

export function snapshotDocumentHtml(pages: readonly SnapshotRenderPage[]) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>${SNAPSHOT_STYLE}@page{size:1122px 793px;margin:0}</style></head><body>${pages.map(snapshotPageHtml).join("")}</body></html>`;
}

export interface SnapshotRenderer {
  /** One PDF with exactly one PDF page per snapshot page. */
  pdf: (pages: readonly SnapshotRenderPage[]) => Promise<Uint8Array>;
  /** One PNG per page. */
  png: (pages: readonly SnapshotRenderPage[]) => Promise<Uint8Array[]>;
}

export class SnapshotRendererBusyError extends Error {
  constructor() {
    super("Snapshot export is busy. Try again shortly.");
    this.name = "SnapshotRendererBusyError";
  }
}

let activeRenders = 0;

/**
 * Runs one static HTML document in a script-less, network-less Chromium page.
 * Shared by every internal PNG/PDF snapshot (Moodboard, Project Wall).
 */
export async function withSnapshotHtmlPage<TResult>(
  html: string,
  use: (page: Page) => Promise<TResult>,
) {
  if (activeRenders >= 2) {
    throw new SnapshotRendererBusyError();
  }
  activeRenders += 1;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
      viewport: { height: 793, width: 1122 },
    });
    await context.route("**/*", (route) =>
      route.request().url().startsWith("data:")
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.setContent(html, { waitUntil: "load" });
    return await use(page);
  } finally {
    try {
      await browser?.close();
    } finally {
      activeRenders -= 1;
    }
  }
}

/** Playwright Chromium renderer, following the Documents PDF boundary. */
export const playwrightSnapshotRenderer: SnapshotRenderer = {
  pdf: (pages) =>
    withSnapshotHtmlPage(snapshotDocumentHtml(pages), async (page) =>
      page.pdf({
        height: "793px",
        printBackground: true,
        width: "1122px",
      }),
    ),
  png: (pages) =>
    withSnapshotHtmlPage(snapshotDocumentHtml(pages), (page) => {
      const sections = page.locator("section.page");
      return Promise.all(
        pages.map((_, index) =>
          sections.nth(index).screenshot({ type: "png" }),
        ),
      );
    }),
};
