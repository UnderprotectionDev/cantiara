import { lookup } from "node:dns/promises";

import { Agent, fetch as undiciFetch } from "undici";

import {
	type IsolatedHopTransport,
	type IsolatedHttpHop,
	PREVIEW_MAX_BYTES,
} from "./isolated-egress";

const FETCH_TIMEOUT_MS = 10_000;

export const undiciHopTransport: IsolatedHopTransport = {
	request: async (url: URL, pinnedIp: string): Promise<IsolatedHttpHop> => {
		const dispatcher = new Agent({
			connect: {
				lookup(_hostname, _options, callback) {
					callback(null, pinnedIp, pinnedIp.includes(":") ? 6 : 4);
				},
			},
		});
		const response = await undiciFetch(url.href, {
			dispatcher,
			headers: {
				accept: "text/html,application/xhtml+xml,application/json,image/*",
			},
			method: "GET",
			redirect: "manual",
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		const contentLength = Number(response.headers.get("content-length") ?? "");
		if (Number.isFinite(contentLength) && contentLength > PREVIEW_MAX_BYTES) {
			response.body?.cancel();
			return {
				body: Buffer.alloc(0),
				contentType: response.headers.get("content-type") ?? "",
				headers: hopHeaders(response),
				status: response.status,
			};
		}
		const body = Buffer.from(await response.arrayBuffer());
		const capped =
			body.byteLength > PREVIEW_MAX_BYTES
				? body.subarray(0, PREVIEW_MAX_BYTES + 1)
				: body;
		return {
			body: capped,
			contentType: response.headers.get("content-type") ?? "",
			headers: hopHeaders(response),
			status: response.status,
		};
	},
	resolve: async (hostname: string): Promise<string[]> => {
		const records = await lookup(hostname, { all: true });
		return records.map((record) => record.address);
	},
};

function hopHeaders(response: {
	headers: { get: (name: string) => string | null };
}): Record<string, string> {
	const headers: Record<string, string> = {};
	const location = response.headers.get("location");
	if (location) {
		headers.location = location;
	}
	const contentLength = response.headers.get("content-length");
	if (contentLength) {
		headers["content-length"] = contentLength;
	}
	const contentType = response.headers.get("content-type");
	if (contentType) {
		headers["content-type"] = contentType;
	}
	return headers;
}
