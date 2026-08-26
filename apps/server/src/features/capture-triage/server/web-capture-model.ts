import { payloadFingerprint } from "../../mutation-core/server/mutation-shared";
import type { CAPTURE_INBOX_COPY } from "./capture-inbox-model";

export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
export const UNUSED_LINK_REAUTH_MS = 30 * 24 * 60 * 60 * 1000;
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const WEB_CAPTURE_COPY = {
	browser: "Browser",
	device: "Device",
	extensionLinks: "Extension links",
	generatePairingCode: "Generate pairing code",
	lastSuccessfulSave: "Last successful save",
	lastUse: "Last use",
	originUrl: "Origin URL",
	pair: "Pair",
	pairingCode: "Pairing code",
	pairingCodeExpiresOnce:
		"This pairing code expires in five minutes and can be used once.",
	permissionDeclined: "Wide page read was declined. The clip was not widened.",
	reauthorize: "Re-authorize this extension to send again.",
	revoke: "Revoke",
	searchInbox: "Search Inbox",
	send: "Send",
	sensitivePage:
		"This page may be sensitive. The clip uses the current tab only.",
	sent: "Sent to Capture Inbox.",
	targetInbox: "Target Inbox",
	unpaired: "Pair this extension to send to Capture Inbox.",
	unsupportedBrowser: "This browser cannot pair with Web Capture.",
	webCapture: "Web Capture",
	wideReadPermission:
		"Wide page read would include the full page. Declining keeps the selected clip.",
} as const;

export const CLIPPER_BROWSER_FAMILIES = [
	{
		browsers: ["Chrome", "Edge", "Brave", "Arc"],
		family: "chromium",
	},
	{
		browsers: ["Firefox"],
		family: "firefox",
	},
] as const;

export type ClipperBrowserFamily =
	(typeof CLIPPER_BROWSER_FAMILIES)[number]["family"];

export const WEB_CAPTURE_CLIP_KINDS = [
	"url",
	"selected-text",
	"selected-image",
	"screenshot",
] as const;

export type WebCaptureClipKind = (typeof WEB_CAPTURE_CLIP_KINDS)[number];

export interface WebCaptureClip {
	kind: WebCaptureClipKind;
	originUrl: string;
	screenshot?: string;
	selectedImage?: string;
	selectedText?: string;
}

export interface WebCapturePage {
	fullPageText?: string;
	originUrl: string;
	screenshot?: string;
	selectedImage?: string;
	selectedText?: string;
}

export interface WideReadWarning {
	risk: typeof WEB_CAPTURE_COPY.sensitivePage;
	scope: typeof WEB_CAPTURE_COPY.wideReadPermission;
}

export interface CaptureTargetInbox {
	kind: "workspace";
	label: typeof CAPTURE_INBOX_COPY.workspaceCaptureInbox;
}

export interface ProjectCaptureTargetInbox {
	kind: "project";
	label: typeof CAPTURE_INBOX_COPY.projectCaptureInbox;
	projectId: string;
	projectName: string;
}

export type WebCaptureTarget = CaptureTargetInbox | ProjectCaptureTargetInbox;

export function clipperBrowserFamilies() {
	return CLIPPER_BROWSER_FAMILIES;
}

export function isClipperBrowserFamily(
	family: string
): family is ClipperBrowserFamily {
	return family === "chromium" || family === "firefox";
}

export function claimsSafariClipper(): false {
	return false;
}

export function wideReadWarning(): WideReadWarning {
	return {
		risk: WEB_CAPTURE_COPY.sensitivePage,
		scope: WEB_CAPTURE_COPY.wideReadPermission,
	};
}

export function clipFromExplicitAction(input: {
	kind: WebCaptureClipKind;
	page: WebCapturePage;
	wideReadGranted: boolean;
}): {
	clip: WebCaptureClip;
	permissionDeclinedMessage: typeof WEB_CAPTURE_COPY.permissionDeclined | null;
	widened: false;
} {
	const selectedText = input.page.selectedText ?? "";
	const declinedWideRead =
		!input.wideReadGranted && Boolean(input.page.fullPageText);
	let clip: WebCaptureClip;
	if (input.kind === "url") {
		clip = { kind: "url", originUrl: input.page.originUrl };
	} else if (input.kind === "selected-text") {
		clip = {
			kind: "selected-text",
			originUrl: input.page.originUrl,
			selectedText,
		};
	} else if (input.kind === "selected-image") {
		clip = {
			kind: "selected-image",
			originUrl: input.page.originUrl,
			selectedImage: input.page.selectedImage ?? "",
		};
	} else {
		clip = {
			kind: "screenshot",
			originUrl: input.page.originUrl,
			screenshot: input.page.screenshot ?? "",
		};
	}
	return {
		clip,
		permissionDeclinedMessage: declinedWideRead
			? WEB_CAPTURE_COPY.permissionDeclined
			: null,
		widened: false,
	};
}

export function webCaptureContentFingerprint(clip: WebCaptureClip): string {
	return payloadFingerprint({
		kind: clip.kind,
		originUrl: clip.originUrl,
		screenshot: clip.screenshot ?? "",
		selectedImage: clip.selectedImage ?? "",
		selectedText: clip.selectedText ?? "",
	});
}

export function webCaptureBody(clip: WebCaptureClip): string {
	if (clip.kind === "selected-text") {
		return clip.selectedText ?? "";
	}
	if (clip.kind === "url") {
		return clip.originUrl;
	}
	return "";
}

export function webCaptureAttachmentRef(clip: WebCaptureClip): string | null {
	if (clip.kind === "selected-image") {
		return clip.selectedImage || null;
	}
	if (clip.kind === "screenshot") {
		return clip.screenshot || null;
	}
	return null;
}

export function pageInjectionFor(clip: WebCaptureClip): {
	originUrl: string;
	screenshot: string;
	selectedImage: string;
	selectedText: string;
} {
	return {
		originUrl: clip.originUrl,
		screenshot: clip.screenshot ?? "",
		selectedImage: clip.selectedImage ?? "",
		selectedText: clip.selectedText ?? "",
	};
}

export function sendPayloadFor(clip: WebCaptureClip): {
	attachmentRef: string | null;
	body: string;
	kind: "capture-inbox-item";
	link: string;
	origin: string;
} {
	return {
		attachmentRef: webCaptureAttachmentRef(clip),
		body: webCaptureBody(clip),
		kind: "capture-inbox-item",
		link: clip.originUrl,
		origin: clip.originUrl,
	};
}

export function previewWebCaptureView(input: {
	clip: WebCaptureClip;
	target: WebCaptureTarget;
}): {
	content: {
		attachmentRef: string | null;
		body: string;
		kind: WebCaptureClipKind;
	};
	originUrl: string;
	target: WebCaptureTarget;
} {
	return {
		content: {
			attachmentRef: webCaptureAttachmentRef(input.clip),
			body: webCaptureBody(input.clip),
			kind: input.clip.kind,
		},
		originUrl: input.clip.originUrl,
		target: input.target,
	};
}
