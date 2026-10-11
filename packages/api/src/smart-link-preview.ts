import { z } from "zod";

export const smartLinkPreviewInputSchema = z
  .object({ url: z.string().trim().min(1).max(8192) })
  .strict();
export const smartLinkPreviewSchema = z
  .object({
    kind: z.enum(["preview", "link"]),
    url: z.string(),
    domain: z.string(),
    title: z.string().max(255),
    accessedAt: z.iso.datetime(),
    capturedContent: z.string().max(100_000),
    image: z
      .string()
      .max(1_000_000)
      .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
      .nullable(),
    player: z
      .object({
        provider: z.literal("YouTube"),
        videoId: z.string().regex(/^[\w-]{11}$/),
      })
      .nullable(),
    error: z.string().nullable(),
  })
  .strict();
export type SmartLinkPreview = z.infer<typeof smartLinkPreviewSchema>;
export type SmartLinkPreviewAccess = (url: string) => Promise<SmartLinkPreview>;

export function safePreviewLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const youtubePathPattern = /^\/(?:shorts|embed)\/([\w-]{11})$/;
const videoIdPattern = /^[\w-]{11}$/;

export function youtubeVideoId(value: string): string | null {
  const link = safePreviewLink(value);
  if (!link) {
    return null;
  }
  const url = new URL(link);
  let id: string | null = null;
  if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1);
  }
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (youtubePathPattern.exec(url.pathname)?.[1] ?? null);
  }
  return id && videoIdPattern.test(id) ? id : null;
}

export function previewFallback(value: string): SmartLinkPreview {
  const url = safePreviewLink(value);
  return {
    kind: "link",
    url: url ?? "",
    domain: url ? new URL(url).hostname : "",
    title: (url ?? "").slice(0, 255),
    accessedAt: new Date().toISOString(),
    capturedContent: "",
    image: null,
    player: null,
    error: "Preview unavailable. Open the original URL.",
  };
}
