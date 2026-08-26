import { serverUrl } from "./clipper";

export interface PairResult {
	reason?: string;
	status: "paired" | "refused";
	token?: string;
}

export interface SendResult {
	lastSuccessfulSaveAt?: Date | string;
	reason?: string;
	status: "saved" | "refused" | "conflict";
}

async function rpc<T>(
	path: string,
	input: unknown,
	token?: string
): Promise<T> {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (token) {
		headers.authorization = `Bearer ${token}`;
	}
	const response = await fetch(`${serverUrl()}/rpc/${path}`, {
		body: JSON.stringify(input),
		headers,
		method: "POST",
	});
	const data: unknown = await response.json();
	if (!response.ok) {
		const message =
			data &&
			typeof data === "object" &&
			"message" in data &&
			typeof data.message === "string"
				? data.message
				: "Request failed";
		throw new Error(message);
	}
	return data as T;
}

export async function pairExtension(input: {
	browser: string;
	code: string;
	device: string;
	family: string;
}): Promise<PairResult> {
	return await rpc<PairResult>("captureInbox/pair", input);
}

export async function searchCaptureTargets(
	token: string,
	query: string
): Promise<{
	projects: Array<{
		kind: "project";
		label: string;
		projectId: string;
		projectName: string;
	}>;
	workspace: { kind: "workspace"; label: string };
}> {
	return await rpc("captureInbox/searchCaptureTargets", { query }, token);
}

export async function stageWebCapture(
	token: string,
	input: {
		clip: {
			kind: "url" | "selected-text" | "selected-image" | "screenshot";
			originUrl: string;
			screenshot?: string;
			selectedImage?: string;
			selectedText?: string;
		};
		idempotencyKey: string;
		target:
			| { kind: "workspace" }
			| { kind: "project"; projectId: string; projectName: string };
	}
): Promise<{
	reason?: string;
	stagingId?: string;
	status: "staged" | "refused" | "conflict";
}> {
	return await rpc("captureInbox/stageWebCapture", input, token);
}

export async function finalizeWebCapture(
	token: string,
	input: { stagingId: string }
): Promise<SendResult> {
	return await rpc<SendResult>("captureInbox/finalizeWebCapture", input, token);
}

export async function sendStagedWebCapture(
	token: string,
	input: {
		clip: {
			kind: "url" | "selected-text" | "selected-image" | "screenshot";
			originUrl: string;
			screenshot?: string;
			selectedImage?: string;
			selectedText?: string;
		};
		idempotencyKey: string;
		target:
			| { kind: "workspace" }
			| { kind: "project"; projectId: string; projectName: string };
	}
): Promise<SendResult> {
	const staged = await stageWebCapture(token, input);
	if (staged.status !== "staged" || !staged.stagingId) {
		return {
			reason: staged.reason,
			status: staged.status === "conflict" ? "conflict" : "refused",
		};
	}
	return await finalizeWebCapture(token, { stagingId: staged.stagingId });
}
