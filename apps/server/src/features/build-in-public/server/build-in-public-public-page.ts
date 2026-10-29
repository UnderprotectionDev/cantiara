import { createHash } from "node:crypto";
import {
  BUILD_IN_PUBLIC_UI_LABELS,
  type BuildInPublicFeedChange,
  type BuildInPublicFeedEvent,
  type BuildInPublicSnapshot,
  type BuildInPublicSnapshotMember,
  type BuildInPublicSnapshotWall,
  type BuildInPublicSnapshotWork,
} from "@cantiara/api/build-in-public";
import {
  type BuildInPublicView,
  type BuildInPublicViews,
  buildInPublicPath,
  buildInPublicViews,
} from "@cantiara/api/build-in-public-publication";

/** Items listed per page; a bigger snapshot pages instead of growing the first response. */
export const BUILD_IN_PUBLIC_PAGE_SIZE = 100;

const YOUTUBE_LINE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:[^\s#]*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&?#][^\s]*)?$/u;
const SCHEME = /^https?:\/\//iu;
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

function sha256Source(content: string) {
  return `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
}

function anchor(href: string, innerHtml: string) {
  return `<a rel="noreferrer noopener nofollow" href="${escapeHtml(href)}">${innerHtml}</a>`;
}

/** An in-app path; it is built from ids and slugs of this surface only, never from content. */
function link(href: string, label: string) {
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

export interface OwnerControls {
  diffHref: string;
  sourceHref: string;
}

export interface BuildInPublicPageInput {
  indexable: boolean;
  now: Date;
  /** Present only for the signed-in owner of this Project; visitors never get it. */
  owner: OwnerControls | null;
  /** 1-based page of the long lists. */
  page: number;
  slug: string;
  snapshot: BuildInPublicSnapshot;
  surfaceId: string;
  view: BuildInPublicView;
}

export interface RenderedBuildInPublicPage {
  csp: string;
  hasYoutube: boolean;
  html: string;
}

interface Context {
  page: number;
  slug: string;
  surfaceId: string;
  videos: string[];
}

function youtubeCard(context: Context, url: string) {
  const videoId = YOUTUBE_LINE.exec(url.trim())?.[1];
  if (!videoId) {
    return "";
  }
  const index = context.videos.length;
  context.videos.push(videoId);
  const href = SCHEME.test(url) ? url : `https://${url}`;
  // No iframe, script or request to a third party exists until the visitor clicks.
  return `<figure class="yt"><figcaption><strong>${escapeHtml(BUILD_IN_PUBLIC_UI_LABELS.liveExternalSource)}</strong><span> Loading plays a video from YouTube (youtube-nocookie.com), which may set cookies.</span></figcaption><button type="button" class="yt-load" data-yt-index="${index}">Load video from YouTube</button><p>${anchor(href, escapeHtml(url))}</p></figure>`;
}

function assetLink(
  context: Context,
  memberId: string,
  index: number,
  name: string,
  version: number,
) {
  return `<li>${link(`/b/${context.surfaceId}/assets/${memberId}/${index}`, `${name} (version ${version})`)}</li>`;
}

function workHtml(context: Context, work: BuildInPublicSnapshotWork) {
  const files = work.files
    .map((file, index) =>
      assetLink(context, work.memberId, index, file.name, file.version),
    )
    .join("");
  return `<li><article id="${escapeHtml(work.memberId)}"><h3>${escapeHtml(work.title)}</h3><p class="label"><span>${escapeHtml(BUILD_IN_PUBLIC_UI_LABELS.publicStatusLabel)}: </span>${escapeHtml(work.publicStatusLabel)}</p>${work.dueLabel ? `<p class="due">${escapeHtml(work.dueLabel)}</p>` : ""}${work.summary ? `<p>${escapeHtml(work.summary)}</p>` : ""}${files ? `<ul>${files}</ul>` : ""}${work.embeds.map((embed) => youtubeCard(context, embed.url)).join("")}</article></li>`;
}

function wallHtml(
  context: Context,
  member: BuildInPublicSnapshotMember,
  wall: BuildInPublicSnapshotWall,
) {
  const title = new Map(wall.cards.map((card) => [card.cardId, card.title]));
  const cards = [...wall.cards].sort(
    (a, b) => a.row - b.row || a.column - b.column,
  );
  const group = new Map(wall.groups.map((g) => [g.groupId, g.title]));
  const list = (label: string, items: string[]) =>
    items.length > 0
      ? `<h4>${escapeHtml(label)}</h4><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "";
  return `<div class="wall">${wall.narrative ? `<p>${escapeHtml(wall.narrative)}</p>` : ""}${list(
    "Cards",
    cards.map(
      (card) =>
        `${escapeHtml(card.title)}${card.groupId ? ` <span>(${escapeHtml(group.get(card.groupId) ?? "")})</span>` : ""}${card.color ? ` <span>[${escapeHtml(card.color)}]</span>` : ""}`,
    ),
  )}${list(
    "Visual lines",
    wall.lines.map(
      (line) =>
        `${escapeHtml(title.get(line.fromCardId) ?? "")} to ${escapeHtml(title.get(line.toCardId) ?? "")}: ${escapeHtml(line.label)}`,
    ),
  )}${list(
    "Focus order",
    wall.focusOrder.map((id) => escapeHtml(title.get(id) ?? "")),
  )}${
    wall.files.length > 0
      ? `<h4>Files</h4><ul>${wall.files.map((file, index) => assetLink(context, member.memberId, index, file.name, file.version)).join("")}</ul>`
      : ""
  }${wall.liveBlocks
    .map(
      (block) =>
        `<section class="snapshot" aria-label="${escapeHtml(block.sourceLabel)}"><p class="snapshot-label">Snapshot of ${escapeHtml(block.sourceLabel)} on ${escapeHtml(block.frozenOn)}, read-only</p>${block.records
          .map(
            (record) =>
              `<h4>${escapeHtml(record.title)}</h4><dl>${record.fields.map((field) => `<dt>${escapeHtml(field.name)}</dt><dd>${escapeHtml(field.value)}</dd>`).join("")}</dl>`,
          )
          .join("")}</section>`,
    )
    .join("")}</div>`;
}

function memberHtml(context: Context, member: BuildInPublicSnapshotMember) {
  const fields = member.fields
    .filter((field) => field.name !== "Title")
    .map(
      (field) =>
        `<dt>${escapeHtml(field.name)}</dt><dd>${escapeHtml(field.value)}</dd>`,
    )
    .join("");
  return `<li><article id="${escapeHtml(member.memberId)}"><p class="kind">${escapeHtml(member.kind)}${member.date ? ` · ${escapeHtml(member.date)}` : ""}</p><h3>${escapeHtml(member.title)}</h3>${fields ? `<dl>${fields}</dl>` : ""}${member.wall ? wallHtml(context, member, member.wall) : ""}</article></li>`;
}

/**
 * One change of an approved publish event. It links only to the same surface's
 * own snapshot entry (an opaque id), never to a source record, and only while
 * that entry is still in the revision being shown.
 */
function feedChangeHtml(
  context: Context,
  snapshot: BuildInPublicSnapshot,
  change: BuildInPublicFeedChange,
) {
  let target: string | null = null;
  if (snapshot.roadmap.some((work) => work.memberId === change.memberId)) {
    target = `${buildInPublicPath(context.surfaceId, context.slug, "roadmap")}#${change.memberId}`;
  } else if (
    (snapshot.members ?? []).some(
      (member) => member.memberId === change.memberId,
    )
  ) {
    target = `${buildInPublicPath(context.surfaceId, context.slug, "project")}#${change.memberId}`;
  }
  const title = target ? link(target, change.title) : escapeHtml(change.title);
  if (change.kind === "Record published") {
    return `<li><span class="kind">Published ${escapeHtml(change.recordKind ?? "record")}${change.date ? ` · ${escapeHtml(change.date)}` : ""}</span> ${title}</li>`;
  }
  const values =
    change.kind === "Entered Roadmap" || change.kind === "Left Roadmap"
      ? escapeHtml(change.to ?? change.from ?? "")
      : `${escapeHtml(change.from ?? "None")} to ${escapeHtml(change.to ?? "None")}`;
  return `<li><span class="kind">${escapeHtml(change.kind)}</span> ${title}: ${values}</li>`;
}

function feedEventHtml(
  context: Context,
  snapshot: BuildInPublicSnapshot,
  event: BuildInPublicFeedEvent,
) {
  const note = event.explanation
    ? `<blockquote><p class="kind">Founder note</p><p>${escapeHtml(event.explanation)}</p></blockquote>`
    : "";
  return `<li><article id="${escapeHtml(event.eventId)}"><p class="kind">${escapeHtml(event.publishedAt.slice(0, 10))}</p><ul>${event.changes.map((change) => feedChangeHtml(context, snapshot, change)).join("")}</ul>${note}</article></li>`;
}

function pager<T>(items: T[], context: Context, view: BuildInPublicView) {
  const size = BUILD_IN_PUBLIC_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(1, context.page), pages);
  const base = buildInPublicPath(context.surfaceId, context.slug, view);
  const nav =
    pages > 1
      ? `<nav aria-label="Pages"><p>Showing ${(page - 1) * size + 1}-${Math.min(items.length, page * size)} of ${items.length}</p>${page > 1 ? link(`${base}?page=${page - 1}`, "Previous page") : ""} ${page < pages ? link(`${base}?page=${page + 1}`, "Next page") : ""}</nav>`
      : "";
  return { items: items.slice((page - 1) * size, page * size), nav };
}

function body(
  views: BuildInPublicViews,
  snapshot: BuildInPublicSnapshot,
  view: BuildInPublicView,
  context: Context,
) {
  if (view === "roadmap") {
    const all = views.roadmap.horizons.flatMap((group) =>
      group.works.map((work) => ({ horizon: group.horizon, work })),
    );
    const { items, nav } = pager(all, context, "roadmap");
    const sections = views.roadmap.horizons
      .map((group) => {
        const shown = items.filter((entry) => group.works.includes(entry.work));
        return shown.length > 0
          ? `<section><h2>${escapeHtml(group.horizon)}</h2><ul>${shown.map((entry) => workHtml(context, entry.work)).join("")}</ul></section>`
          : "";
      })
      .join("");
    return { copy: views.roadmap.copy, html: `${sections}${nav}` };
  }
  if (view === "feed") {
    const { items, nav } = pager(views.feed.events, context, "feed");
    return {
      copy: views.feed.copy,
      html:
        items.length > 0
          ? `<ol class="feed">${items.map((event) => feedEventHtml(context, snapshot, event)).join("")}</ol>${nav}`
          : "<p>No approved updates yet.</p>",
    };
  }
  if (view === "changelog") {
    const { items, nav } = pager(views.changelog.entries, context, "changelog");
    return {
      copy: views.changelog.copy,
      html: `<ol class="changelog">${items
        .map(
          (entry) =>
            `<li><article><p class="kind">${escapeHtml(entry.date)} · ${escapeHtml(entry.kind)}</p><h3>${escapeHtml(entry.title)}</h3>${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}</article></li>`,
        )
        .join("")}</ol>${nav}`,
    };
  }
  const works = pager(snapshot.roadmap, context, "project");
  const members = pager(views.project.members, context, "project");
  const { featured } = views.project;
  return {
    copy: views.project.copy,
    html: `${featured ? `<section class="featured" aria-label="Featured"><p class="kind">Featured</p><ul>${memberHtml(context, featured)}</ul></section>` : ""}${works.items.length > 0 ? `<section><h2>Roadmap</h2><ul>${works.items.map((work) => workHtml(context, work)).join("")}</ul></section>` : ""}${members.items.length > 0 ? `<section><h2>Records</h2><ul>${members.items.map((member) => memberHtml(context, member)).join("")}</ul></section>` : ""}${works.nav || members.nav}`,
  };
}

/**
 * The visitor page of one view. It reads the snapshot it is given and nothing
 * else: no Workspace query, no counter, no form and no script until a
 * click-to-load YouTube card exists.
 */
export function renderBuildInPublicPage(
  input: BuildInPublicPageInput,
): RenderedBuildInPublicPage {
  const views = buildInPublicViews(input.snapshot, input.now);
  const context: Context = {
    page: input.page,
    slug: input.slug,
    surfaceId: input.surfaceId,
    videos: [],
  };
  const { copy, html: content } = body(
    views,
    input.snapshot,
    input.view,
    context,
  );
  const at = (view: BuildInPublicView) =>
    buildInPublicPath(input.surfaceId, input.slug, view);
  const nav = `<nav aria-label="Build in Public">${link(at("project"), "Project")} ${link(at("roadmap"), "Roadmap")} ${link(at("changelog"), "Changelog")} ${link(at("feed"), BUILD_IN_PUBLIC_UI_LABELS.developmentFeed)}</nav>`;
  const owner = input.owner
    ? `<nav aria-label="Owner controls">${link(input.owner.sourceHref, BUILD_IN_PUBLIC_UI_LABELS.openSourceRecord)} ${link(input.owner.diffHref, BUILD_IN_PUBLIC_UI_LABELS.reviewPublishDiff)}</nav>`
    : "";
  const hasYoutube = context.videos.length > 0;
  const title = copy.title ?? "Build in Public";
  const robots = input.indexable
    ? ""
    : '<meta name="robots" content="noindex, nofollow">';
  const description = copy.summary
    ? `<meta name="description" content="${escapeHtml(copy.summary)}">`
    : "";
  const scriptBody = `const ids=${JSON.stringify(context.videos)};for(const b of document.querySelectorAll(".yt-load")){b.addEventListener("click",()=>{const f=b.closest("figure");const i=document.createElement("iframe");i.src="https://www.youtube-nocookie.com/embed/"+ids[Number(b.dataset.ytIndex)]+"?autoplay=0&rel=0";i.title="YouTube video player";i.referrerPolicy="no-referrer";i.allow="encrypted-media; picture-in-picture";i.allowFullscreen=true;i.className="yt-frame";b.replaceWith(i);i.focus();});}`;
  const styleBody =
    "body{font:16px/1.6 system-ui,sans-serif;margin:0;color:#1a1a1a;background:#fff}main{max-width:48rem;margin:0 auto;padding:2rem 1rem}ul,ol{padding-left:1.25rem}li{margin:.5rem 0}.summary,.kind,.snapshot-label{color:#555;font-size:.9rem}.snapshot,.featured{border:1px solid #ccc;border-radius:6px;padding:.75rem 1rem;margin:1rem 0}.yt{margin:1rem 0}.yt-frame{width:100%;aspect-ratio:16/9;border:0}.yt-load{font:inherit;padding:.5rem 1rem;cursor:pointer}";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">${robots}${description}<title>${escapeHtml(title)}</title><style>${styleBody}</style></head><body><main>${owner}<header>${nav}<h1>${escapeHtml(title)}</h1>${copy.summary ? `<p class="summary">${escapeHtml(copy.summary)}</p>` : ""}</header>${content}</main>${hasYoutube ? `<script>${scriptBody}</script>` : ""}</body></html>`;
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
