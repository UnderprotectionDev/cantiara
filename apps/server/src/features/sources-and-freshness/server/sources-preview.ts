import { Parser } from "htmlparser2";
import { z } from "zod";

import {
	contentTypeIsExecutable,
	fetchIsolatedHttp,
	type IsolatedHopTransport,
	PREVIEW_MAX_IMAGE_BYTES,
} from "./isolated-egress";
import { resolveSourceOrigin } from "./source-origin";
import { SOURCE_PROVIDER, SOURCES_COPY } from "./sources-model";

export const smartLinkPlayerSchema = z.object({
	autoplay: z.literal(false),
	available: z.boolean(),
	clickToLoad: z.literal(true),
	embedUrl: z.string().nullable(),
	error: z.string().nullable(),
	provider: z.literal("youtube"),
	videoId: z.string().min(1),
});

export const smartLinkPreviewSchema = z.discriminatedUnion("status", [
	z.object({
		reason: z.enum([
			"credentials",
			"denied-target",
			"executable",
			"iframe-embed",
			"oversized",
			"unsupported",
		]),
		status: z.literal("plain-link"),
		url: z.string(),
	}),
	z.object({
		capturedContent: z.string(),
		description: z.string().nullable(),
		domain: z.string(),
		imageDataUrl: z.string().nullable(),
		isSource: z.literal(false),
		kind: z.enum(["rich", "youtube"]),
		originalUrl: z.string(),
		player: smartLinkPlayerSchema.nullable(),
		status: z.literal("preview"),
		title: z.string(),
	}),
]);

export type SmartLinkPreview = z.infer<typeof smartLinkPreviewSchema>;

const HTML_TYPE = /html|xhtml/i;
const IFRAME_PASTE = /<\s*iframe\b/i;
const META_HEAD_LIMIT = 512 * 1024;
const SAFE_IMAGE_TYPE = /^image\/(png|jpe?g|webp|gif)\b/i;

export async function previewSmartLink(
	rawUrl: string,
	input: { transport: IsolatedHopTransport }
): Promise<SmartLinkPreview> {
	const trimmed = rawUrl.trim();
	if (IFRAME_PASTE.test(trimmed)) {
		return { reason: "iframe-embed", status: "plain-link", url: trimmed };
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { reason: "unsupported", status: "plain-link", url: trimmed };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { reason: "unsupported", status: "plain-link", url: trimmed };
	}
	if (parsed.username !== "" || parsed.password !== "") {
		return { reason: "credentials", status: "plain-link", url: trimmed };
	}
	const youtubeId = youtubeVideoId(parsed);
	if (youtubeId) {
		return await previewYouTube(parsed, youtubeId, input.transport);
	}
	const fetched = await fetchIsolatedHttp(parsed.href, input.transport);
	if (!fetched.ok) {
		return {
			reason:
				fetched.reason === "redirect-limit" ? "denied-target" : fetched.reason,
			status: "plain-link",
			url: trimmed,
		};
	}
	if (contentTypeIsExecutable(fetched.contentType)) {
		return { reason: "executable", status: "plain-link", url: trimmed };
	}
	if (!HTML_TYPE.test(fetched.contentType) && fetched.contentType !== "") {
		return { reason: "unsupported", status: "plain-link", url: trimmed };
	}
	const {
		description,
		imageUrl,
		title: extractedTitle,
	} = extractHtmlPreview(fetched.body.toString("utf8"));
	const title = extractedTitle || parsed.hostname;
	const imageDataUrl = imageUrl
		? await safeImageDataUrl(imageUrl, input.transport)
		: null;
	return {
		capturedContent: description || title,
		description,
		domain: parsed.hostname,
		imageDataUrl,
		isSource: false,
		kind: "rich",
		originalUrl: parsed.href,
		player: null,
		status: "preview",
		title,
	};
}

async function previewYouTube(
	parsed: URL,
	videoId: string,
	transport: IsolatedHopTransport
): Promise<SmartLinkPreview> {
	const oembed = new URL("https://www.youtube.com/oembed");
	oembed.searchParams.set("format", "json");
	oembed.searchParams.set("url", parsed.href);
	const fetched = await fetchIsolatedHttp(oembed.href, transport);
	if (!(fetched.ok && fetched.status >= 200 && fetched.status < 300)) {
		return {
			capturedContent: parsed.href,
			description: null,
			domain: parsed.hostname,
			imageDataUrl: null,
			isSource: false,
			kind: "youtube",
			originalUrl: parsed.href,
			player: {
				autoplay: false,
				available: false,
				clickToLoad: true,
				embedUrl: null,
				error: SOURCES_COPY.youtubeUnavailable,
				provider: "youtube",
				videoId,
			},
			status: "preview",
			title: parsed.hostname,
		};
	}
	if (contentTypeIsExecutable(fetched.contentType)) {
		return { reason: "executable", status: "plain-link", url: parsed.href };
	}
	let title = parsed.hostname;
	let thumbnail: string | null = null;
	try {
		const payload = JSON.parse(fetched.body.toString("utf8")) as {
			thumbnail_url?: string;
			title?: string;
		};
		if (typeof payload.title === "string" && payload.title.trim() !== "") {
			title = payload.title.trim();
		}
		if (typeof payload.thumbnail_url === "string") {
			thumbnail = payload.thumbnail_url;
		}
	} catch {
		return {
			capturedContent: parsed.href,
			description: null,
			domain: parsed.hostname,
			imageDataUrl: null,
			isSource: false,
			kind: "youtube",
			originalUrl: parsed.href,
			player: {
				autoplay: false,
				available: false,
				clickToLoad: true,
				embedUrl: null,
				error: SOURCES_COPY.youtubeUnavailable,
				provider: "youtube",
				videoId,
			},
			status: "preview",
			title: parsed.hostname,
		};
	}
	const imageDataUrl = thumbnail
		? await safeImageDataUrl(thumbnail, transport)
		: null;
	return {
		capturedContent: title,
		description: null,
		domain: parsed.hostname,
		imageDataUrl,
		isSource: false,
		kind: "youtube",
		originalUrl: parsed.href,
		player: {
			autoplay: false,
			available: true,
			clickToLoad: true,
			embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0`,
			error: null,
			provider: "youtube",
			videoId,
		},
		status: "preview",
		title,
	};
}

function youtubeVideoId(parsed: URL): string | null {
	const origin = resolveSourceOrigin({ url: parsed.href });
	if (origin.provider !== SOURCE_PROVIDER.youtube) {
		return null;
	}
	return origin.externalId;
}

function extractHtmlPreview(html: string): {
	description: string | null;
	imageUrl: string | null;
	title: string;
} {
	const slice = html.slice(0, META_HEAD_LIMIT);
	let title = "";
	let ogTitle = "";
	let description: string | null = null;
	let imageUrl: string | null = null;
	let inTitle = false;
	const parser = new Parser(
		{
			onclosetag(name) {
				if (name === "title") {
					inTitle = false;
				}
			},
			onopentag(name, attributes) {
				if (name === "title") {
					inTitle = true;
				}
				if (name !== "meta") {
					return;
				}
				const property = (
					attributes.property ??
					attributes.name ??
					""
				).toLowerCase();
				const content = attributes.content?.trim() ?? "";
				if (content === "") {
					return;
				}
				if (property === "og:title" || property === "twitter:title") {
					ogTitle = content;
				}
				if (
					property === "og:description" ||
					property === "twitter:description" ||
					property === "description"
				) {
					description = content;
				}
				if (property === "og:image" || property === "twitter:image") {
					imageUrl = content;
				}
			},
			ontext(text) {
				if (inTitle) {
					title += text;
				}
			},
		},
		{ decodeEntities: true }
	);
	parser.write(slice);
	parser.end();
	return {
		description,
		imageUrl,
		title: (ogTitle || title).replace(/\s+/g, " ").trim(),
	};
}

async function safeImageDataUrl(
	rawImageUrl: string,
	transport: IsolatedHopTransport
): Promise<string | null> {
	let parsed: URL;
	try {
		parsed = new URL(rawImageUrl);
	} catch {
		return null;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return null;
	}
	const fetched = await fetchIsolatedHttp(parsed.href, transport);
	if (!(fetched.ok && fetched.status >= 200 && fetched.status < 300)) {
		return null;
	}
	if (!SAFE_IMAGE_TYPE.test(fetched.contentType)) {
		return null;
	}
	if (fetched.body.byteLength > PREVIEW_MAX_IMAGE_BYTES) {
		return null;
	}
	const mime = fetched.contentType.split(";")[0]?.trim() ?? "image/png";
	return `data:${mime};base64,${fetched.body.toString("base64")}`;
}
