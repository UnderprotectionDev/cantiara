import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";

import {
	pairExtension,
	searchCaptureTargets,
	sendWebCapture,
} from "../../src/features/web-capture/client";
import {
	clipperBrowserFromUserAgent,
	clipperDeviceFromUserAgent,
	clipperFamilyFromUserAgent,
	sendPayloadFor,
	TOKEN_STORAGE_KEY,
	WEB_CAPTURE_COPY,
} from "../../src/features/web-capture/clipper";

import "./App.css";

type ClipKind = "url" | "selected-text" | "selected-image" | "screenshot";

interface PageClip {
	originUrl: string;
	screenshot: string;
	selectedImage: string;
	selectedText: string;
}

export default function App() {
	const [token, setToken] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<ClipKind>("selected-text");
	const [page, setPage] = useState<PageClip | null>(null);
	const [targets, setTargets] = useState<
		Array<{
			kind: "workspace" | "project";
			label: string;
			projectId?: string;
			projectName?: string;
		}>
	>([]);
	const [targetKey, setTargetKey] = useState("workspace");
	const [message, setMessage] = useState<string | null>(null);
	const [offline, setOffline] = useState(!navigator.onLine);

	useEffect(() => {
		const onOnline = () => {
			setOffline(false);
		};
		const onOffline = () => {
			setOffline(true);
		};
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, []);

	useEffect(() => {
		browser.storage.local.get(TOKEN_STORAGE_KEY).then((stored) => {
			const value = stored[TOKEN_STORAGE_KEY];
			if (typeof value === "string") {
				setToken(value);
			}
		});
	}, []);

	const loadPage = useCallback(async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const [activeTab] = tabs;
		if (!(activeTab?.id && activeTab.url)) {
			return;
		}
		const injected = await browser.scripting.executeScript({
			func: () => {
				const selectedText = window.getSelection()?.toString() ?? "";
				const node = window.getSelection()?.anchorNode;
				const element =
					node instanceof Element ? node : (node?.parentElement ?? null);
				const image =
					element?.closest("img")?.getAttribute("src") ??
					element?.querySelector("img")?.getAttribute("src") ??
					"";
				return {
					originUrl: window.location.href,
					selectedImage: image,
					selectedText,
				};
			},
			target: { tabId: activeTab.id },
		});
		const [injection] = injected;
		const clipResult = injection?.result;
		let screenshot = "";
		if (kind === "screenshot") {
			screenshot = await browser.tabs.captureVisibleTab();
		}
		if (
			clipResult &&
			typeof clipResult === "object" &&
			"originUrl" in clipResult &&
			"selectedImage" in clipResult &&
			"selectedText" in clipResult
		) {
			setPage({
				originUrl: String(clipResult.originUrl),
				screenshot,
				selectedImage: String(clipResult.selectedImage),
				selectedText: String(clipResult.selectedText),
			});
			return;
		}
		setPage({
			originUrl: activeTab.url,
			screenshot,
			selectedImage: "",
			selectedText: "",
		});
	}, [kind]);

	useEffect(() => {
		if (token) {
			loadPage().catch(() => {
				// The active tab may refuse injection.
			});
		}
	}, [loadPage, token]);

	useEffect(() => {
		if (!token) {
			return;
		}
		searchCaptureTargets(token, query)
			.then((found) => {
				setTargets([
					{
						kind: "workspace",
						label: found.workspace.label,
					},
					...found.projects.map((project) => ({
						kind: "project" as const,
						label: project.label,
						projectId: project.projectId,
						projectName: project.projectName,
					})),
				]);
			})
			.catch(() => {
				// Search can fail while pairing is still settling.
			});
	}, [query, token]);

	const clip = useMemo(() => {
		if (!page) {
			return null;
		}
		if (kind === "url") {
			return { kind, originUrl: page.originUrl };
		}
		if (kind === "selected-text") {
			return {
				kind,
				originUrl: page.originUrl,
				selectedText: page.selectedText,
			};
		}
		if (kind === "selected-image") {
			return {
				kind,
				originUrl: page.originUrl,
				selectedImage: page.selectedImage,
			};
		}
		return {
			kind,
			originUrl: page.originUrl,
			screenshot: page.screenshot,
		};
	}, [kind, page]);

	const payload = clip ? sendPayloadFor(clip) : null;
	const selectedTarget = targets.find((target) =>
		target.kind === "workspace"
			? targetKey === "workspace"
			: targetKey === target.projectId
	);

	const onPair = useCallback(async () => {
		if (offline) {
			setMessage("Unsaved changes may be lost");
			return;
		}
		const family = clipperFamilyFromUserAgent(navigator.userAgent);
		if (family === "safari" || family === "unknown") {
			setMessage("Safari is not a first-product Web Clipper.");
			return;
		}
		const result = await pairExtension({
			browser: clipperBrowserFromUserAgent(navigator.userAgent),
			code: code.trim(),
			device: clipperDeviceFromUserAgent(navigator.userAgent),
			family,
		});
		if (result.status !== "paired" || !result.token) {
			setMessage(WEB_CAPTURE_COPY.unpaired);
			return;
		}
		await browser.storage.local.set({ [TOKEN_STORAGE_KEY]: result.token });
		setToken(result.token);
		setMessage(null);
	}, [code, offline]);

	const onSend = useCallback(async () => {
		if (!token) {
			return;
		}
		if (!clip) {
			return;
		}
		if (!selectedTarget) {
			return;
		}
		if (offline) {
			setMessage("Unsaved changes may be lost");
			return;
		}
		const target =
			selectedTarget.kind === "workspace"
				? { kind: "workspace" as const }
				: {
						kind: "project" as const,
						projectId: selectedTarget.projectId ?? "",
						projectName: selectedTarget.projectName ?? "",
					};
		const result = await sendWebCapture(token, {
			clip,
			idempotencyKey: crypto.randomUUID(),
			target,
		});
		if (result.status === "saved") {
			setMessage("Sent to Capture Inbox.");
			return;
		}
		if (result.reason === "reauthorization-required") {
			await browser.storage.local.remove(TOKEN_STORAGE_KEY);
			setToken(null);
			setMessage(WEB_CAPTURE_COPY.reauthorize);
			return;
		}
		setMessage(result.reason ?? WEB_CAPTURE_COPY.unpaired);
	}, [clip, offline, selectedTarget, token]);

	return (
		<main>
			<h1>{WEB_CAPTURE_COPY.webCapture}</h1>
			<p>{WEB_CAPTURE_COPY.sensitivePage}</p>
			<p>{WEB_CAPTURE_COPY.wideReadPermission}</p>
			{token ? (
				<>
					<label>
						Clip
						<select
							onChange={(event) => {
								setKind(event.target.value as ClipKind);
							}}
							value={kind}
						>
							<option value="url">URL</option>
							<option value="selected-text">Selected text</option>
							<option value="selected-image">Selected image</option>
							<option value="screenshot">Screenshot</option>
						</select>
					</label>
					<label>
						{WEB_CAPTURE_COPY.searchInbox}
						<input
							onChange={(event) => {
								setQuery(event.target.value);
							}}
							value={query}
						/>
					</label>
					<label>
						{WEB_CAPTURE_COPY.targetInbox}
						<select
							onChange={(event) => {
								setTargetKey(event.target.value);
							}}
							value={targetKey}
						>
							{targets.map((target) => (
								<option
									key={
										target.kind === "workspace" ? "workspace" : target.projectId
									}
									value={
										target.kind === "workspace" ? "workspace" : target.projectId
									}
								>
									{target.kind === "workspace"
										? target.label
										: `${target.label} ${target.projectName}`}
								</option>
							))}
						</select>
					</label>
					<p>
						{WEB_CAPTURE_COPY.originUrl}: {clip?.originUrl ?? ""}
					</p>
					<p>{payload?.body}</p>
					<button onClick={onSend} type="button">
						{WEB_CAPTURE_COPY.send}
					</button>
				</>
			) : (
				<>
					<p>{WEB_CAPTURE_COPY.unpaired}</p>
					<label>
						{WEB_CAPTURE_COPY.pairingCode}
						<input
							onChange={(event) => {
								setCode(event.target.value);
							}}
							value={code}
						/>
					</label>
					<button onClick={onPair} type="button">
						Pair
					</button>
				</>
			)}
			{message ? <p>{message}</p> : null}
		</main>
	);
}
