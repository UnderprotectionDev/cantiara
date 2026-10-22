import {
  previewFallback,
  type SmartLinkPreview,
  safePreviewLink,
  youtubeVideoId,
} from "@cantiara/api/smart-link-preview";
import { Parser } from "htmlparser2";
import ipaddr from "ipaddr.js";
import { z } from "zod";

const youTubeOEmbedSchema = z.object({
  thumbnail_url: z.string().catch(""),
  title: z.string().refine((title) => title.trim().length > 0),
});

export interface PreviewTransport {
  request: (
    url: URL,
    address: string,
    signal: AbortSignal,
    maxBytes: number,
  ) => Promise<{
    status: number;
    headers: Record<string, string>;
    body: Uint8Array;
  }>;
  resolve: (hostname: string) => Promise<string[]>;
  safeImage?: (bytes: Uint8Array) => Promise<string>;
}

const ipv6BracketPattern = /^\[|\]$/g;
const whitespacePattern = /\s+/g;
const MAX_BYTES = 20 * 1024 * 1024;
const HTML_BYTES = 1024 * 1024;
const ignoredTags = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "template",
  "head",
]);

function publicAddress(address: string) {
  if (!ipaddr.isValid(address)) {
    return false;
  }
  const parsed = ipaddr.process(address);
  if (parsed.range() !== "unicast") {
    return false;
  }
  if (parsed instanceof ipaddr.IPv4) {
    return !["192.0.0.0/24", "192.88.99.0/24"].some((cidr) =>
      parsed.match(ipaddr.IPv4.parseCIDR(cidr)),
    );
  }
  return (
    parsed.match(ipaddr.IPv6.parseCIDR("2000::/3")) &&
    !["2001::/23", "3fff::/20"].some((cidr) =>
      parsed.match(ipaddr.IPv6.parseCIDR(cidr)),
    )
  );
}

async function publicTarget(value: string, network: PreviewTransport) {
  const link = safePreviewLink(value);
  if (!link) {
    throw new Error("Unsupported URL");
  }
  const url = new URL(link);
  // Standard web ports only; avoid using a preview as a public port scanner.
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Unsupported port");
  }
  const hostname = url.hostname.replace(ipv6BracketPattern, "");
  const addresses = ipaddr.isValid(hostname)
    ? [hostname]
    : await network.resolve(hostname);
  if (
    !(
      addresses.length &&
      addresses.length <= 32 &&
      addresses.every(publicAddress)
    )
  ) {
    throw new Error("Non-public target");
  }
  const [address] = addresses;
  if (!address) {
    throw new Error("Unresolved target");
  }
  return { url, address };
}

async function readPublic(
  value: string,
  network: PreviewTransport,
  signal: AbortSignal,
  budget: { remaining: number },
  observe?: (result: NonNullable<SmartLinkPreview["fetchResult"]>) => void,
) {
  let next = value;
  for (let hop = 0; hop <= 3; hop += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Each redirect must be validated before the next request.
    const { url, address } = await publicTarget(next, network);
    signal.throwIfAborted();
    const response = await network.request(
      url,
      address,
      signal,
      budget.remaining,
    );
    observe?.({
      finalUrl: url.href,
      httpStatus: response.status,
      contentType:
        (response.headers["content-type"] || "").slice(0, 255) || null,
    });
    budget.remaining -= response.body.byteLength;
    if (
      budget.remaining < 0 ||
      Number(response.headers["content-length"]) > MAX_BYTES
    ) {
      throw new Error("Oversized response");
    }
    if (
      response.headers["content-encoding"] &&
      response.headers["content-encoding"] !== "identity"
    ) {
      throw new Error("Encoded response");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location || hop === 3) {
        throw new Error("Redirect limit");
      }
      next = new URL(response.headers.location, url).href;
      continue;
    }
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    return { ...response, finalUrl: url.href };
  }
  throw new Error("Redirect limit");
}

function metadata(html: string) {
  let title = "";
  let ogTitle = "";
  let image = "";
  let inTitle = false;
  const stack: string[] = [];
  const text: string[] = [];
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (ignoredTags.has(name)) {
          stack.push(name);
        }
        if (name === "title") {
          inTitle = true;
        }
        if (name === "meta") {
          const property = (attrs.property ?? attrs.name ?? "").toLowerCase();
          if (property === "og:title") {
            ogTitle = attrs.content ?? "";
          }
          if (property === "og:image") {
            image = attrs.content ?? "";
          }
        }
      },
      ontext(value) {
        if (inTitle) {
          title += value;
        } else if (!stack.length) {
          text.push(value);
        }
      },
      onclosetag(name) {
        if (name === "title") {
          inTitle = false;
        }
        if (stack.at(-1) === name) {
          stack.pop();
        }
        if (!stack.length) {
          text.push(" ");
        }
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  return {
    title: (ogTitle || title).trim().slice(0, 255),
    image,
    capturedContent: text
      .join("")
      .replace(whitespacePattern, " ")
      .trim()
      .slice(0, 100_000),
  };
}

async function safePreviewImage(
  value: string,
  network: PreviewTransport,
  signal: AbortSignal,
  budget: { remaining: number },
  baseUrl?: string,
) {
  if (!(value && network.safeImage)) {
    return null;
  }
  try {
    const response = await readPublic(
      new URL(value, baseUrl).href,
      network,
      signal,
      budget,
    );
    const type = response.headers["content-type"]
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(type ?? "") ||
      response.body.byteLength > 5 * 1024 * 1024
    ) {
      return null;
    }
    return await network.safeImage(response.body);
  } catch {
    return null;
  }
}

async function youtubePreview(
  value: string,
  videoId: string,
  network: PreviewTransport,
  signal: AbortSignal,
  budget: { remaining: number },
): Promise<SmartLinkPreview> {
  const fallback = previewFallback(value);
  try {
    await publicTarget(value, network);
    const response = await readPublic(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      network,
      signal,
      budget,
      (result) => {
        fallback.fetchResult = result;
      },
    );
    if (
      !response.headers["content-type"]?.startsWith("application/json") ||
      response.body.byteLength > HTML_BYTES
    ) {
      throw new Error("Unsupported provider response");
    }
    const info = youTubeOEmbedSchema.safeParse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(response.body),
      ),
    );
    if (!info.success) {
      throw new Error("Unavailable video");
    }
    const title = info.data.title.trim().slice(0, 255);
    const imageUrl = info.data.thumbnail_url;
    const image = await safePreviewImage(imageUrl, network, signal, budget);
    return {
      ...fallback,
      kind: "preview",
      title,
      capturedContent: title,
      image,
      fetchResult: {
        finalUrl: response.finalUrl,
        httpStatus: response.status,
        contentType:
          (response.headers["content-type"] || "").slice(0, 255) || null,
      },
      player: { provider: "YouTube", videoId },
      error: null,
    };
  } catch {
    return { ...fallback, error: "Video unavailable. Open the original URL." };
  }
}

export function createSmartLinkPreview(network: PreviewTransport) {
  return async (value: string): Promise<SmartLinkPreview> => {
    const fallback = previewFallback(value);
    const signal = AbortSignal.timeout(10_000);
    const budget = { remaining: MAX_BYTES };
    const videoId = youtubeVideoId(value);
    if (videoId) {
      return youtubePreview(value, videoId, network, signal, budget);
    }
    try {
      const response = await readPublic(
        value,
        network,
        signal,
        budget,
        (result) => {
          fallback.fetchResult = result;
        },
      );
      const type = response.headers["content-type"]
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();
      if (
        !["text/html", "text/plain"].includes(type ?? "") ||
        response.body.byteLength > HTML_BYTES
      ) {
        return {
          ...fallback,
          error: "Preview unavailable. Unsupported content type or size.",
        };
      }
      const body = new TextDecoder("utf-8", { fatal: true }).decode(
        response.body,
      );
      const data =
        type === "text/html"
          ? metadata(body)
          : {
              title: fallback.domain,
              image: "",
              capturedContent: body.slice(0, 100_000),
            };
      const image = data.image
        ? await safePreviewImage(
            data.image,
            network,
            signal,
            budget,
            response.finalUrl,
          )
        : null;
      return {
        ...fallback,
        kind: "preview",
        title: data.title || fallback.domain,
        capturedContent: data.capturedContent,
        image,
        error: null,
      };
    } catch (error) {
      return {
        ...fallback,
        error: `Preview unavailable. ${error instanceof Error ? error.message : "Source unavailable."}`,
      };
    }
  };
}
