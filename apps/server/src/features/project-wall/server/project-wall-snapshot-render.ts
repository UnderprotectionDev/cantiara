import {
  PROJECT_WALL_SNAPSHOT_LABELS,
  type ProjectWallSnapshotData,
  type ProjectWallSnapshotRenderer,
} from "@cantiara/api/project-wall-presentation";

import { withSnapshotHtmlPage } from "../../moodboards/server/moodboard-snapshot-render";

const PAGE_WIDTH = 1122;
const PAGE_HEIGHT = 793;
const PAGE_PADDING = 32;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 44;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 120;

const HIGHLIGHT_COLORS = {
  amber: "#b45309",
  blue: "#1d4ed8",
  green: "#15803d",
  red: "#b91c1c",
  violet: "#6d28d9",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * One static page that lays the frozen cards out where they stood on the wall,
 * scaled to fit. It holds text, boxes and lines only: no anchor, no URL, no
 * script and no source id, so the output cannot carry a live source link.
 */
export function projectWallSnapshotHtml(data: ProjectWallSnapshotData) {
  const xs = data.cards.map(({ x }) => x);
  const ys = data.cards.map(({ y }) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const worldWidth = Math.max(...xs) - left + CARD_WIDTH;
  const worldHeight = Math.max(...ys) - top + CARD_HEIGHT;
  const areaWidth = PAGE_WIDTH - PAGE_PADDING * 2;
  const areaHeight =
    PAGE_HEIGHT - PAGE_PADDING * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  const scale = Math.min(areaWidth / worldWidth, areaHeight / worldHeight, 1);
  const place = (card: { x: number; y: number }) => ({
    x: (card.x - left) * scale,
    y: (card.y - top) * scale,
  });
  const cardWidth = CARD_WIDTH * scale;
  const cardHeight = CARD_HEIGHT * scale;
  const cards = data.cards
    .map((card) => {
      const at = place(card);
      const color = card.highlight ? HIGHLIGHT_COLORS[card.highlight] : "#999";
      const lines = card.lines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      return `<article class="card" style="left:${at.x}px;top:${at.y}px;width:${cardWidth}px;height:${cardHeight}px;border-left-color:${color};font-size:${Math.max(7, 12 * scale)}px"><p class="kind">${escapeHtml(card.kindLabel)}</p><h2>${escapeHtml(card.title)}</h2><ul>${lines}</ul></article>`;
    })
    .join("");
  const links = data.links
    .map((link) => {
      const from = data.cards[link.from];
      const to = data.cards[link.to];
      if (!(from && to)) {
        return "";
      }
      const a = place(from);
      const b = place(to);
      const x1 = a.x + cardWidth / 2;
      const y1 = a.y + cardHeight / 2;
      const x2 = b.x + cardWidth / 2;
      const y2 = b.y + cardHeight / 2;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" font-size="11" fill="#333">${escapeHtml(link.label)}</text>`;
    })
    .join("");
  const style = `*{box-sizing:border-box}body{margin:0;font:14px sans-serif;color:#111;background:#fff}.page{width:${PAGE_WIDTH}px;height:${PAGE_HEIGHT}px;padding:${PAGE_PADDING}px;display:flex;flex-direction:column;overflow:hidden}h1{font-size:22px;margin:0 0 4px}header p{margin:0;color:#555}.board{position:relative;flex:1}.board svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.card{position:absolute;overflow:hidden;border:1px solid #ccc;border-left:4px solid;border-radius:6px;padding:6px;background:#fff}.card .kind{margin:0;color:#666;font-size:0.8em}.card h2{margin:2px 0;font-size:1.1em}.card ul{margin:0;padding-left:1.1em;font-size:0.9em}footer{font-size:11px;color:#666;height:${FOOTER_HEIGHT}px}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${style}@page{size:${PAGE_WIDTH}px ${PAGE_HEIGHT}px;margin:0}</style></head><body><section class="page"><header style="height:${HEADER_HEIGHT}px"><h1>${escapeHtml(data.scopeLabel)}</h1><p>${escapeHtml(data.moment)} (Frozen copy)</p></header><div class="board"><svg aria-hidden="true"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#555"/></marker></defs>${links}</svg>${cards}</div><footer>Snapshot generated ${escapeHtml(data.generatedOn)}. ${escapeHtml(PROJECT_WALL_SNAPSHOT_LABELS.noLiveLinksNotice)}</footer></section></body></html>`;
}

/** Playwright Chromium renderer, shared with the Moodboard snapshot boundary. */
export const playwrightProjectWallSnapshotRenderer: ProjectWallSnapshotRenderer =
  {
    pdf: (data) =>
      withSnapshotHtmlPage(projectWallSnapshotHtml(data), (page) =>
        page.pdf({
          height: `${PAGE_HEIGHT}px`,
          printBackground: true,
          width: `${PAGE_WIDTH}px`,
        }),
      ),
    png: (data) =>
      withSnapshotHtmlPage(projectWallSnapshotHtml(data), (page) =>
        page.locator("section.page").screenshot({ type: "png" }),
      ),
  };
