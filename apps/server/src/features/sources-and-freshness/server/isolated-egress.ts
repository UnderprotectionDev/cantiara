import ipaddr from "ipaddr.js";

export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024;
export const PREVIEW_MAX_IMAGE_BYTES = 1024 * 1024;
export const PREVIEW_MAX_REDIRECTS = 5;

export interface IsolatedHttpHop {
	body: Buffer | string | Uint8Array;
	contentType?: string;
	headers?: Record<string, string>;
	status: number;
}

export interface IsolatedHopTransport {
	request: (url: URL, pinnedIp: string) => Promise<IsolatedHttpHop>;
	resolve: (hostname: string) => Promise<string[]>;
}

export type IsolatedFetchFailureReason =
	| "credentials"
	| "denied-target"
	| "oversized"
	| "redirect-limit"
	| "unsupported";

export type IsolatedFetchResult =
	| {
			body: Buffer;
			contentType: string;
			finalUrl: string;
			ok: true;
			status: number;
	  }
	| {
			ok: false;
			reason: IsolatedFetchFailureReason;
	  };

const DENIED_IP_RANGES = new Set([
	"broadcast",
	"carrierGradeNat",
	"ipv4Mapped",
	"linkLocal",
	"loopback",
	"multicast",
	"private",
	"reserved",
	"teredo",
	"uniqueLocal",
	"unspecified",
]);

const EXECUTABLE_TYPE =
	/javascript|wasm|x-msdownload|x-executable|x-dosexec|x-sh|x-bat|x-msdos-program/i;

export function ipAddressIsDenied(ip: string): boolean {
	try {
		if (ipaddr.IPv6.isValid(ip)) {
			const ipv6 = ipaddr.IPv6.parse(ip);
			if (ipv6.isIPv4MappedAddress()) {
				return ipAddressIsDenied(ipv6.toIPv4Address().toString());
			}
			return DENIED_IP_RANGES.has(ipv6.range());
		}
		const parsed = ipaddr.parse(ip);
		return DENIED_IP_RANGES.has(parsed.range());
	} catch {
		return true;
	}
}

export function contentTypeIsExecutable(contentType: string): boolean {
	return EXECUTABLE_TYPE.test(contentType);
}

export async function fetchIsolatedHttp(
	rawUrl: string,
	transport: IsolatedHopTransport,
	hopCount = 0
): Promise<IsolatedFetchResult> {
	if (hopCount > PREVIEW_MAX_REDIRECTS) {
		return { ok: false, reason: "redirect-limit" };
	}
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { ok: false, reason: "unsupported" };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, reason: "unsupported" };
	}
	if (parsed.username !== "" || parsed.password !== "") {
		return { ok: false, reason: "credentials" };
	}
	const { hostname } = parsed;
	const resolved = ipaddr.isValid(hostname)
		? [hostname]
		: await transport.resolve(hostname);
	const publicAddresses = resolved.filter(
		(address) => !ipAddressIsDenied(address)
	);
	if (publicAddresses.length === 0) {
		return { ok: false, reason: "denied-target" };
	}
	if (resolved.some((address) => ipAddressIsDenied(address))) {
		return { ok: false, reason: "denied-target" };
	}
	const hop = await transport.request(parsed, publicAddresses[0] ?? hostname);
	const headers = lowercaseHeaders(hop.headers);
	const contentType = hop.contentType ?? headers["content-type"] ?? "";
	const declaredLength = Number(headers["content-length"]);
	if (Number.isFinite(declaredLength) && declaredLength > PREVIEW_MAX_BYTES) {
		return { ok: false, reason: "oversized" };
	}
	const body = toBuffer(hop.body);
	if (body.byteLength > PREVIEW_MAX_BYTES) {
		return { ok: false, reason: "oversized" };
	}
	if (hop.status >= 300 && hop.status < 400) {
		const { location } = headers;
		if (!location) {
			return { ok: false, reason: "unsupported" };
		}
		const nextUrl = new URL(location, parsed);
		return await fetchIsolatedHttp(nextUrl.href, transport, hopCount + 1);
	}
	return {
		body,
		contentType,
		finalUrl: parsed.href,
		ok: true,
		status: hop.status,
	};
}

function lowercaseHeaders(
	headers: Record<string, string> | undefined
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers ?? {})) {
		result[key.toLowerCase()] = value;
	}
	return result;
}

function toBuffer(body: Buffer | string | Uint8Array): Buffer {
	if (typeof body === "string") {
		return Buffer.from(body);
	}
	return Buffer.from(body);
}
