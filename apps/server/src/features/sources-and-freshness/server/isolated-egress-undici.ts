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
		const body = await readCappedBody(response.body);
		return {
			body,
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

async function readCappedBody(
	body: ReadableStream<Uint8Array> | null | undefined
): Promise<Buffer> {
	if (!body) {
		return Buffer.alloc(0);
	}
	return await collectCappedChunks(body.getReader(), [], 0);
}

async function collectCappedChunks(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	chunks: Uint8Array[],
	total: number
): Promise<Buffer> {
	const { done, value } = await reader.read();
	if (done) {
		return Buffer.concat(chunks, total);
	}
	if (!value) {
		return await collectCappedChunks(reader, chunks, total);
	}
	const nextTotal = total + value.byteLength;
	if (nextTotal > PREVIEW_MAX_BYTES) {
		await reader.cancel();
		const allowed = PREVIEW_MAX_BYTES + 1 - total;
		return Buffer.concat(
			[...chunks, value.subarray(0, Math.max(0, allowed))],
			PREVIEW_MAX_BYTES + 1
		);
	}
	chunks.push(value);
	return await collectCappedChunks(reader, chunks, nextTotal);
}
