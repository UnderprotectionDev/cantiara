import {
  APPROVED_SNAPSHOT_LABEL,
  LIVE_ALLOW_LIST_FIELD_KINDS,
  LIVE_LABEL,
  SECRET_FIELD_KINDS,
  type ShareFieldKind,
  type ShareSurfaceSummary,
  SOME_FIELDS_LIVE_LABEL,
} from "./link-sharing";

/** Pure Link Sharing rules: the live allow-list, secrets, labels, placeholders. */

export function isLiveEligible(kind: ShareFieldKind) {
  return (LIVE_ALLOW_LIST_FIELD_KINDS as readonly string[]).includes(kind);
}

export function isSecretKind(kind: ShareFieldKind) {
  return (SECRET_FIELD_KINDS as readonly string[]).includes(kind);
}

/**
 * The hybrid label of a set of approved parts. Anything frozen keeps the whole
 * from being `Live`; there is no blanket `Current`.
 */
export function shareLabel(
  liveCount: number,
  frozenCount: number,
): ShareSurfaceSummary["label"] {
  if (liveCount === 0) {
    return APPROVED_SNAPSHOT_LABEL;
  }
  return frozenCount === 0 ? LIVE_LABEL : SOME_FIELDS_LIVE_LABEL;
}

export interface PlaceholderMatch {
  context: string;
  placeholder: string;
}

const PLACEHOLDER = /\{\{(\p{Ll}[\p{Ll}\p{Nd}_]*)\}\}/gu;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /(`+)[^`\n][^\n]*?\1(?!`)/g;
const NOT_NEWLINE = /[^\n]/g;
const WHITESPACE = /\s+/g;
const CONTEXT_RADIUS = 40;

const blank = (code: string) => code.replaceAll(NOT_NEWLINE, " ");

/**
 * Blanks fenced code blocks and inline code spans, keeping every offset, so a
 * match inside code never warns. An unclosed fence runs to the end of the text.
 */
function blankCode(text: string) {
  const lines: string[] = [];
  let fence: { char: string; length: number } | null = null;
  for (const line of text.split("\n")) {
    const opening = FENCE_OPEN.exec(line);
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`);
      if (closing.test(line)) {
        fence = null;
      }
      lines.push(blank(line));
    } else if (opening?.[1]) {
      fence = { char: opening[1].charAt(0), length: opening[1].length };
      lines.push(blank(line));
    } else {
      lines.push(line);
    }
  }
  return lines.join("\n").replaceAll(INLINE_CODE, blank);
}

/** Syntactic only: recognised `{{alan_adı}}` outside code, never prose guesses. */
export function findPlaceholders(text: string): PlaceholderMatch[] {
  const visible = blankCode(text);
  const matches: PlaceholderMatch[] = [];
  for (const match of visible.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const from = Math.max(0, start - CONTEXT_RADIUS);
    const to = Math.min(text.length, end + CONTEXT_RADIUS);
    matches.push({
      context: `${from > 0 ? "…" : ""}${text.slice(from, to).replaceAll(WHITESPACE, " ")}${to < text.length ? "…" : ""}`,
      placeholder: match[0],
    });
  }
  return matches;
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WWW_PREFIX = /^www\./;

/**
 * The video id of an original YouTube URL, or `null` for anything else. Only
 * the id leaves the page, and only after a visitor click.
 */
export function youtubeVideoId(url: string | null): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  const host = parsed.hostname.replace(WWW_PREFIX, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.slice(1);
  } else if (host === "youtube.com" && parsed.pathname === "/watch") {
    id = parsed.searchParams.get("v");
  }
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
}
