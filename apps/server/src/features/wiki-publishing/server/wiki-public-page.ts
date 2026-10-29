import {
  WIKI_PUBLISHING_UI_LABELS,
  type WikiDocumentSnapshot,
  type WikiSnapshotMember,
} from "@cantiara/api/wiki-publishing";
import { renderHtml } from "@tanstack/markdown/html";

const SNAPSHOT_MARKER = /^:::snapshot-block\{memberId="(member-\d+)"\}\s*$/u;
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

/** Markdown to HTML with no raw HTML, no image request on paint and `noreferrer` links. */
function markdownHtml(markdown: string) {
  return renderHtml(markdown, { allowHtml: false })
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gu, "$1")
    .replace(/<img\b[^>]*>/gu, "")
    .replace(
      /<a\s+href="([^"]*)"/gu,
      '<a rel="noreferrer noopener nofollow" href="$1"',
    );
}

function youtubeCard(videoId: string, url: string, index: number) {
  const label = WIKI_PUBLISHING_UI_LABELS.liveExternalSource;
  // No iframe, script or request to a third party exists until the visitor clicks.
  return `<figure class="yt" data-video-id="${videoId}"><figcaption><strong>${escapeHtml(label)}</strong><span> Loading plays a video from YouTube (youtube-nocookie.com), which may set cookies.</span></figcaption><button type="button" class="yt-load" data-yt-index="${index}">Load video from YouTube</button><p><a rel="noreferrer noopener nofollow" href="${escapeHtml(url)}">${escapeHtml(url)}</a></p></figure>`;
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

export interface RenderedWikiPage {
  /** The CSP of this exact document, matching its nonce. */
  csp: string;
  hasYoutube: boolean;
  html: string;
}

export function renderWikiPublicPage(
  snapshot: WikiDocumentSnapshot,
  options: { indexable: boolean; nonce: string; surfaceId: string },
): RenderedWikiPage {
  const { nonce, surfaceId } = options;
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
    const video = YOUTUBE_LINE.exec(line.trim());
    if (marker?.[1]) {
      flush();
      const member = members.get(marker[1]);
      if (member) {
        inBody.add(member.memberId);
        parts.push(blockHtml(member));
      }
    } else if (video?.[1]) {
      flush();
      videos.push(video[1]);
      parts.push(youtubeCard(video[1], line.trim(), videos.length - 1));
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
              `<li><a rel="noreferrer noopener nofollow" href="/w/${escapeHtml(surfaceId)}/assets/${member.memberId}/${index}">${escapeHtml(file.name)}</a></li>`,
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
  const script = hasYoutube
    ? `<script nonce="${nonce}">const ids=${JSON.stringify(videos)};for(const b of document.querySelectorAll(".yt-load")){b.addEventListener("click",()=>{const f=b.closest("figure");const i=document.createElement("iframe");i.src="https://www.youtube-nocookie.com/embed/"+ids[Number(b.dataset.ytIndex)]+"?autoplay=0&rel=0";i.title="YouTube video player";i.referrerPolicy="no-referrer";i.allow="encrypted-media; picture-in-picture";i.allowFullscreen=true;i.className="yt-frame";b.replaceWith(i);i.focus();});}</script>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">${robots}${description}<title>${escapeHtml(snapshot.title)}</title><style nonce="${nonce}">body{font:16px/1.6 system-ui,sans-serif;margin:0;color:#1a1a1a;background:#fff}main{max-width:44rem;margin:0 auto;padding:2rem 1rem}pre{overflow:auto}.summary{color:#555}.snapshot{border:1px solid #ccc;border-radius:6px;padding:.75rem 1rem;margin:1rem 0}.snapshot-label{font-size:.85rem;color:#555;margin:0}.yt{margin:1rem 0}.yt-frame{width:100%;aspect-ratio:16/9;border:0}.yt-load{font:inherit;padding:.5rem 1rem;cursor:pointer}</style></head><body><main><article><h1>${escapeHtml(snapshot.title)}</h1>${summary}${parts.join("")}${extra.length > 0 ? `<ul>${extra.join("")}</ul>` : ""}</article></main>${script}</body></html>`;
  const csp = [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    hasYoutube ? `script-src 'nonce-${nonce}'` : "script-src 'none'",
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
