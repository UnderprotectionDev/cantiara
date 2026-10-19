import { initiallyHiddenBlocks, linksOf } from "./links";
import { buildExportManifest, orderSnapshots } from "./manifest";
import type { WireframeSnapshot } from "./snapshot";
import { renderSvg } from "./svg";

export interface HtmlExportOptions {
  /** Base64 data URI of the canvas font; inlined so the file needs no network. */
  fontDataUri?: string;
  startScreenId?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Embedded runtime: read-only navigation over the inlined data. No network API. */
const RUNTIME = `(function(){
var data=JSON.parse(document.getElementById("cantiara-links").textContent);
var status=document.getElementById("cantiara-status");
function open(id){
var sections=document.querySelectorAll("[data-screen-section]");
for(var i=0;i<sections.length;i++){sections[i].hidden=sections[i].getAttribute("data-screen-section")!==id;}
status.textContent="";
var hidden=data.screens[id].hidden;
for(var j=0;j<hidden.length;j++){setVisible(id,hidden[j],false);}
}
function setVisible(screen,block,visible){
var node=document.querySelector('[data-screen-section="'+screen+'"] [data-block-id="'+block+'"]');
if(node){node.style.display=visible?"":"none";}
}
document.addEventListener("click",function(event){
var block=event.target.closest&&event.target.closest("[data-block-id]");
var section=event.target.closest&&event.target.closest("[data-screen-section]");
if(!block||!section){return;}
var screen=section.getAttribute("data-screen-section");
var id=block.getAttribute("data-block-id");
var info=data.screens[screen];
var link=info.links[id];
if(link){
if(link.state==="resolved"){open(link.target);}else{status.textContent="Unresolved: "+link.target;}
return;
}
var toggles=info.toggles[id]||[];
for(var k=0;k<toggles.length;k++){setVisible(screen,toggles[k].target,toggles[k].action==="show");}
});
open(data.start);
})();`;

const STYLES = `body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a}
main{padding:16px}
[data-screen-section]{background:#fff;border:1px solid #cbd5e1;display:inline-block}
[data-block-id]{cursor:default}
#cantiara-status{min-height:1.5em;color:#b91c1c}
details{margin:16px;font-size:12px}
pre{white-space:pre-wrap}`;

/**
 * Single-file interactive HTML. Styles, font, script and SVG are inline; a
 * Content-Security-Policy of `default-src 'none'` forbids any request, and the
 * file contains no product URL, analytics or write-back path. A link whose
 * target Screen is not among the chosen versions stays `Unresolved`.
 */
export function renderInteractiveHtml(
  snapshots: readonly WireframeSnapshot[],
  options: HtmlExportOptions = {},
): string {
  const ordered = orderSnapshots(snapshots);
  const start = ordered.find(
    ({ screenId }) => screenId === options.startScreenId,
  )
    ? options.startScreenId
    : ordered[0]?.screenId;
  const screens: Record<string, unknown> = {};
  for (const snapshot of ordered) {
    const links: Record<string, unknown> = {};
    for (const link of linksOf(snapshot, ordered)) {
      links[link.blockId] = {
        state: link.state,
        target: link.targetScreenId,
      };
    }
    const toggles: Record<string, { action: string; target: string }[]> = {};
    for (const animation of snapshot.document.animations) {
      if (animation.kind === "show-hide") {
        toggles[animation.triggerBlockId] = [
          ...(toggles[animation.triggerBlockId] ?? []),
          { action: animation.action, target: animation.targetBlockId },
        ];
      }
    }
    screens[snapshot.screenId] = {
      hidden: initiallyHiddenBlocks(snapshot),
      links,
      toggles,
    };
  }
  const data = JSON.stringify({ screens, start }).replaceAll("<", "\\u003c");
  const sections = ordered.map(
    (snapshot) =>
      `<section aria-label="${escapeHtml(snapshot.title)}" data-screen-section="${escapeHtml(snapshot.screenId)}" hidden>${
        renderSvg(snapshot, { fontDataUri: options.fontDataUri }).markup
      }</section>`,
  );
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Wireframe export</title>",
    `<style>${STYLES}</style>`,
    "</head>",
    "<body>",
    "<main>",
    '<p id="cantiara-status" role="status"></p>',
    ...sections,
    "</main>",
    `<details><summary>Manifest</summary><pre id="cantiara-manifest">${escapeHtml(buildExportManifest(ordered))}</pre></details>`,
    `<script id="cantiara-links" type="application/json">${data}</script>`,
    `<script>${RUNTIME}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
