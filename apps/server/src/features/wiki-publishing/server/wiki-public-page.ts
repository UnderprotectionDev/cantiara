import { createHash } from "node:crypto";
import {
  WIKI_PUBLISHING_UI_LABELS,
  type WikiDocumentSnapshot,
  type WikiSnapshotMember,
} from "@cantiara/api/wiki-publishing";
import { renderHtml } from "@tanstack/markdown/html";

const SNAPSHOT_MARKER = /^:::snapshot-block\{memberId="(member-\d+)"\}\s*$/u;
const YOUTUBE_MARKER = /^:::youtube\{memberId="(member-\d+)"\}\s*$/u;
const YOUTUBE_LINE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:[^\s#]*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&?#][^\s]*)?$/u;

const LEADING_NEWLINES = /^\n+/u;

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string) {
  return value.replace(/["&'<>]/gu, (char) => ESCAPES[char] ?? char);
}

const ENTITIES: Record<string, string> = {
  "&#39;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};
const ENTITY = /&(?:#39|amp|gt|lt|quot);/gu;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/iu;
const MARKDOWN_ANCHOR = /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu;
const SCHEME = /^https?:\/\//iu;

/** The only anchor shape the public page emits; `href` is raw text and is escaped here. */
function anchor(href: string, innerHtml: string) {
  return `<a rel="noreferrer noopener nofollow" href="${escapeHtml(href)}">${innerHtml}</a>`;
}

/**
 * Markdown to HTML with no raw HTML, no image request on paint, only
 * http/https/mailto links (anything else becomes plain text) and `noreferrer` links.
 */
function markdownHtml(markdown: string) {
  return renderHtml(markdown, { allowHtml: false })
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gu, "$1")
    .replace(/<img\b[^>]*>/gu, "")
    .replace(MARKDOWN_ANCHOR, (_match, href: string, inner: string) => {
      const raw = href.replace(ENTITY, (entity) => ENTITIES[entity] ?? entity);
      return SAFE_HREF.test(raw) ? anchor(raw, inner) : inner;
    });
}

function sha256Source(content: string) {
  return `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
}

function youtubeCard(videoId: string, url: string, index: number) {
  const label = WIKI_PUBLISHING_UI_LABELS.liveExternalSource;
  const href = SCHEME.test(url) ? url : `https://${url}`;
  // No iframe, script or request to a third party exists until the visitor clicks.
  return `<figure class="yt" data-video-id="${videoId}"><figcaption><strong>${escapeHtml(label)}</strong><span> Loading plays a video from YouTube (youtube-nocookie.com), which may set cookies.</span></figcaption><button type="button" class="yt-load" data-yt-index="${index}">Load video from YouTube</button><p>${anchor(href, escapeHtml(url))}</p></figure>`;
}

function blockHtml(member: WikiSnapshotMember) {
  const fields = member.fields
    .filter((field) => field.name !== "Title")
    .map(
      (field) =>
        `<dt>${escapeHtml(field.name)}</dt><dd>${escapeHtml(field.value)}</dd>`,
    )
    .join("");
  return `<section class="snapshot" aria-label="${escapeHtml(member.liveLabel ?? member.title)}"><p class="snapshot-label">${escapeHtml(member.liveLabel ?? "Snapshot")}</p><h2>${escapeHtml(member.title)}</h2>${fields ? `<dl>${fields}</dl>` : ""}</section>`;
}

function memberBody(member: WikiSnapshotMember) {
  return member.fields.find((field) => field.name === "Body")?.value ?? "";
}

function trimmedTitle(body: string, title: string) {
  const [first = "", ...rest] = body.split("\n");
  return first.trim() === `# ${title}`.trim()
    ? rest.join("\n").replace(LEADING_NEWLINES, "")
    : body;
}

/**
 * The one card shape an approved YouTube member may become on the public page;
 * anything else lets the marker line fall through as plain text.
 */
function approvedYoutubeCard(member: WikiSnapshotMember | undefined) {
  if (member?.kind !== "YouTube video") {
    return null;
  }
  const url = member.title.trim();
  const videoId = YOUTUBE_LINE.exec(url)?.[1];
  return member && videoId ? { member, url, videoId } : null;
}

export interface RenderedWikiPage {
  /** Hash-based CSP of this exact document: page and CSP are the same for every visitor, so both are safe to cache. */
  csp: string;
  hasYoutube: boolean;
  html: string;
}

export function renderWikiPublicPage(
  snapshot: WikiDocumentSnapshot,
  options: { indexable: boolean; surfaceId: string },
): RenderedWikiPage {
  const { surfaceId } = options;
  const members = new Map(
    snapshot.members.map((member) => [member.memberId, member]),
  );
  const inBody = new Set<string>();
  const parts: string[] = [];
  const videos: string[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length > 0) {
      parts.push(markdownHtml(chunk.join("\n")));
      chunk = [];
    }
  };
  for (const line of trimmedTitle(snapshot.body, snapshot.title).split("\n")) {
    const marker = SNAPSHOT_MARKER.exec(line);
    const youtube = YOUTUBE_MARKER.exec(line);
    if (marker?.[1]) {
      flush();
      const member = members.get(marker[1]);
      if (member) {
        inBody.add(member.memberId);
        parts.push(blockHtml(member));
      }
    } else if (youtube?.[1]) {
      // Only approved cards reach the frozen body: each one is its own
      // approval item, so the card can never appear without approval.
      flush();
      const card = approvedYoutubeCard(members.get(youtube[1]));
      if (card) {
        inBody.add(card.member.memberId);
        videos.push(card.videoId);
        parts.push(youtubeCard(card.videoId, card.url, videos.length - 1));
      }
    } else {
      chunk.push(line);
    }
  }
  flush();

  const extra = snapshot.members
    .filter((member) => !inBody.has(member.memberId))
    .map((member) => {
      if (member.kind === "Attachment") {
        return member.files
          .map(
            (file, index) =>
              `<li>${anchor(`/w/${surfaceId}/assets/${member.memberId}/${index}`, escapeHtml(file.name))}</li>`,
          )
          .join("");
      }
      if (member.kind === "Child document") {
        return `<li><section><h2>${escapeHtml(member.title)}</h2>${markdownHtml(memberBody(member))}</section></li>`;
      }
      return `<li>${escapeHtml(member.title)}</li>`;
    });
  const hasYoutube = videos.length > 0;
  const robots = options.indexable
    ? ""
    : '<meta name="robots" content="noindex, nofollow">';
  const summary = snapshot.summary
    ? `<p class="summary">${escapeHtml(snapshot.summary)}</p>`
    : "";
  const description = snapshot.summary
    ? `<meta name="description" content="${escapeHtml(snapshot.summary)}">`
    : "";
  const scriptBody = `const ids=${JSON.stringify(videos)};for(const b of document.querySelectorAll(".yt-load")){b.addEventListener("click",()=>{const f=b.closest("figure");const i=document.createElement("iframe");i.src="https://www.youtube-nocookie.com/embed/"+ids[Number(b.dataset.ytIndex)]+"?autoplay=0&rel=0";i.title="YouTube video player";i.referrerPolicy="no-referrer";i.allow="encrypted-media; picture-in-picture";i.allowFullscreen=true;i.className="yt-frame";b.replaceWith(i);i.focus();});}`;
  const script = hasYoutube ? `<script>${scriptBody}</script>` : "";
  const styleBody =
    "body{font:16px/1.6 system-ui,sans-serif;margin:0;color:#1a1a1a;background:#fff}main{max-width:44rem;margin:0 auto;padding:2rem 1rem}pre{overflow:auto}.summary{color:#555}.snapshot{border:1px solid #ccc;border-radius:6px;padding:.75rem 1rem;margin:1rem 0}.snapshot-label{font-size:.85rem;color:#555;margin:0}.yt{margin:1rem 0}.yt-frame{width:100%;aspect-ratio:16/9;border:0}.yt-load{font:inherit;padding:.5rem 1rem;cursor:pointer}";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">${robots}${description}<title>${escapeHtml(snapshot.title)}</title><style>${styleBody}</style></head><body><main><article><h1>${escapeHtml(snapshot.title)}</h1>${summary}${parts.join("")}${extra.length > 0 ? `<ul>${extra.join("")}</ul>` : ""}</article></main>${script}</body></html>`;
  const csp = [
    "default-src 'none'",
    `style-src ${sha256Source(styleBody)}`,
    hasYoutube ? `script-src ${sha256Source(scriptBody)}` : "script-src 'none'",
    hasYoutube
      ? "frame-src https://www.youtube-nocookie.com"
      : "frame-src 'none'",
    "img-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
  return { csp, hasYoutube, html };
}
