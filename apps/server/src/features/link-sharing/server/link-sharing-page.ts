import {
  LAST_APPROVED_LABEL,
  LINK_PASSWORD_LABEL,
  LIVE_EXTERNAL_SOURCE_LABEL,
  SHARE_SURFACE_PATH,
  SHARE_VISITOR_LINK_PATH,
  type ShareManifestItem,
} from "@cantiara/api/link-sharing";
import { youtubeVideoId } from "@cantiara/api/link-sharing-rules";
import type { VisitorSnapshot } from "./link-sharing-visitor";

/**
 * Product-controlled visitor HTML (Hono serves it, spec 73). It is read-only:
 * no form except the password gate, no script except the click-to-load
 * YouTube control, no third-party request before that click. Every value is
 * escaped; Markdown and text are shown as plain text.
 */

export const GENERIC_GATE_ERROR =
  "That link or password did not work. Check both and try again.";
export const UNAVAILABLE_MESSAGE =
  "This shared page is not available. Open the link you were given again.";

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const ESCAPABLE = /[&<>"']/g;
const esc = (value: string) =>
  value.replaceAll(ESCAPABLE, (char) => ESCAPES[char] ?? char);

const STYLE =
  ":root{color-scheme:light dark}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText}main{max-width:44rem;margin:0 auto;padding:2rem 1rem}h1{font-size:1.75rem;margin:0 0 .5rem}h2{font-size:1.25rem;margin:2rem 0 .5rem}h3{font-size:1rem;margin:1rem 0 .25rem}dt{font-weight:600;margin-top:.75rem}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.note{color:GrayText}label{display:block;font-weight:600;margin:1rem 0 .25rem}input{font:inherit;padding:.5rem;width:100%;max-width:22rem;box-sizing:border-box}button{font:inherit;padding:.5rem 1rem;margin-top:.75rem;cursor:pointer}.error{border-left:4px solid #b00020;padding:.25rem .75rem;margin:1rem 0}.card{border:1px solid GrayText;border-radius:.5rem;padding:1rem;margin:1rem 0}iframe{width:100%;aspect-ratio:16/9;border:0}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid Highlight;outline-offset:2px}";

// Loads the YouTube player only after the click; there is no autoplay.
const SCRIPT = `document.addEventListener("click",function(event){var button=event.target.closest("button[data-youtube]");if(!button||button.disabled){return}var slot=button.parentElement.querySelector("[data-slot]");var frame=document.createElement("iframe");frame.title="YouTube video";frame.allow="fullscreen; encrypted-media";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation");frame.onerror=function(){frame.remove();slot.textContent="Video unavailable. Open the original URL."};frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(button.getAttribute("data-youtube"))+"?autoplay=0&rel=0";slot.replaceChildren(frame);button.disabled=true;button.textContent="YouTube video loaded"});`;

export function visitorHeaders(options: { frames: boolean; nonce: string }) {
  const { frames, nonce } = options;
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      `style-src 'nonce-${nonce}'`,
      frames ? `script-src 'nonce-${nonce}'` : "script-src 'none'",
      frames
        ? "frame-src https://www.youtube-nocookie.com"
        : "frame-src 'none'",
      "img-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

function document(options: {
  body: string;
  nonce: string;
  script?: boolean;
  title: string;
}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>${esc(options.title)}</title><style nonce="${options.nonce}">${STYLE}</style></head><body><main>${options.body}</main>${options.script ? `<script nonce="${options.nonce}">${SCRIPT}</script>` : ""}</body></html>`;
}

export function gatePage(options: {
  error: "cooldown" | "denied" | null;
  nonce: string;
  retryAfterSeconds?: number;
  token: string;
}) {
  const message =
    options.error === "cooldown"
      ? `Too many attempts. Try again in ${options.retryAfterSeconds ?? 60} seconds.`
      : GENERIC_GATE_ERROR;
  return document({
    body: `<h1>Open shared page</h1><p class="note">This page is shared by link. Enter the ${esc(LINK_PASSWORD_LABEL.toLowerCase())} you were given.</p>${options.error ? `<p class="error" id="gate-error" role="alert">${esc(message)}</p>` : ""}<form method="post" action="${SHARE_VISITOR_LINK_PATH}"><input type="hidden" name="token" value="${esc(options.token)}"><label for="password">${esc(LINK_PASSWORD_LABEL)}</label><input id="password" name="password" type="password" autocomplete="off" required autofocus${options.error ? ' aria-invalid="true" aria-describedby="gate-error"' : ""}><button type="submit">Open</button></form>`,
    nonce: options.nonce,
    title: "Open shared page",
  });
}

export function unavailablePage(nonce: string) {
  return document({
    body: `<h1>Not available</h1><p role="alert">${esc(UNAVAILABLE_MESSAGE)}</p>`,
    nonce,
    title: "Not available",
  });
}

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function embedCard(item: ShareManifestItem) {
  const videoId = youtubeVideoId(item.value);
  const original = item.value ? httpUrl(item.value) : null;
  const link = original
    ? `<a href="${esc(original)}" rel="noreferrer noopener" target="_blank">${esc(original)}</a>`
    : esc(item.value ?? "");
  return `<section class="card" aria-label="${esc(LIVE_EXTERNAL_SOURCE_LABEL)}"><h3>${esc(LIVE_EXTERNAL_SOURCE_LABEL)}</h3><p class="note">${videoId ? "Loading this video contacts YouTube (Google), which may set cookies and see your network address. Nothing is requested until you choose to load it. It does not autoplay." : "This source is not embedded."}</p><p>Original URL: ${link}</p>${videoId ? `<div><button type="button" data-youtube="${esc(videoId)}">Load YouTube video</button><div data-slot aria-live="polite"></div></div>` : ""}</section>`;
}

const ATTACHMENT_ITEM = /:attachment:([^:]+):([^:]+)$/;

function partRow(item: ShareManifestItem, surfaceId: string) {
  const detail = item.value ? ` — ${esc(item.value)}` : "";
  const file =
    item.kind === "Attachment" ? ATTACHMENT_ITEM.exec(item.itemId) : null;
  // A product-controlled URL on this surface; there is no object-store URL.
  const download = file
    ? ` <a href="${SHARE_SURFACE_PATH}/${encodeURIComponent(surfaceId)}/files/${encodeURIComponent(file[1] ?? "")}/${encodeURIComponent(file[2] ?? "")}" rel="noreferrer" download>Download</a>`
    : "";
  return `<li>${esc(item.label)}${detail}${download}</li>`;
}

function recordSection(
  record: ShareManifestItem,
  children: ShareManifestItem[],
  index: number,
  surfaceId: string,
) {
  const fields = children.filter((item) => item.kind === "Field" && item.value);
  const embeds = children.filter((item) => item.kind === "Embed");
  const parts = children.filter(
    (item) => item.kind !== "Field" && item.kind !== "Embed",
  );
  return `<section id="record-${index}" aria-labelledby="record-${index}-title"><h2 id="record-${index}-title">${esc(record.label)}</h2>${fields.length > 0 ? `<dl>${fields.map((item) => `<dt>${esc(item.label)}</dt><dd>${esc(item.value ?? "")}</dd>`).join("")}</dl>` : ""}${embeds.map(embedCard).join("")}${parts.length > 0 ? `<ul>${parts.map((part) => partRow(part, surfaceId)).join("")}</ul>` : ""}</section>`;
}

export function surfacePage(
  snapshot: VisitorSnapshot,
  nonce: string,
  surfaceId: string,
) {
  const { items } = snapshot.manifest;
  const records = items.filter((item) => item.kind === "Record");
  const hasEmbed = items.some(
    (item) => item.kind === "Embed" && youtubeVideoId(item.value),
  );
  const title = records[0]?.label ?? "Shared page";
  const navigation =
    records.length > 1
      ? `<nav aria-label="Records"><ul>${records.map((record, index) => `<li><a href="#record-${index}">${esc(record.label)}</a></li>`).join("")}</ul></nav>`
      : "";
  const html = document({
    body: `<header><h1>${esc(title)}</h1><p class="note"><strong>${esc(snapshot.label)}</strong> · ${esc(LAST_APPROVED_LABEL)}: <time datetime="${esc(snapshot.approvedAt)}">${esc(snapshot.approvedAt)}</time></p></header>${navigation}${records
      .map((record, index) =>
        recordSection(
          record,
          items.filter((item) => item.parentId === record.itemId),
          index,
          surfaceId,
        ),
      )
      .join("")}`,
    nonce,
    script: hasEmbed,
    title,
  });
  return { frames: hasEmbed, html };
}

/**
 * A revoked, unpublished or redacted URL answers with these headers and no
 * body at all: generic, `noindex`, never a redirect to a new surface.
 */
export function goneHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

const FILE_NAME_UNSAFE = /[^\w.\- ]+/g;

/** Dosya Eki bytes: a download, never rendered, never kept by a shared cache. */
export function assetHeaders(file: { fileName: string; mimeType: string }) {
  const name = file.fileName.replaceAll(FILE_NAME_UNSAFE, "_") || "file";
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Content-Security-Policy":
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    "Content-Type": file.mimeType,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
