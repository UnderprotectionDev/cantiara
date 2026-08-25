import {
	oneTimeCodeFromDeepLink,
	TAURI_CALLBACK_URL,
} from "@cantiara/auth/tauri-session";
import { env } from "@cantiara/env/web";

import { postSignInPath } from "@/features/account-access/forms/post-sign-in-path";
import {
	isDesktopShell,
	saveDesktopSessionToken,
} from "@/features/account-access/forms/tauri-session-token";
import { authClient } from "@/lib/auth-client";

export async function startContinueWithGitHub(
	redirect?: string
): Promise<void> {
	if (isDesktopShell()) {
		await startDesktopGitHubSignIn();
		return;
	}
	const path = postSignInPath(redirect);
	await authClient.signIn.social({
		callbackURL: `${window.location.origin}${path}`,
		provider: "github",
	});
}

export async function startDesktopGitHubSignIn(): Promise<void> {
	const result = await authClient.signIn.social({
		callbackURL: TAURI_CALLBACK_URL,
		disableRedirect: true,
		provider: "github",
	});
	const authorizeUrl =
		result.data && typeof result.data.url === "string" ? result.data.url : null;
	if (!authorizeUrl) {
		return;
	}
	const { openUrl } = await import("@tauri-apps/plugin-opener");
	await openUrl(authorizeUrl);
}

export async function completeDesktopGitHubSignIn(
	url: string
): Promise<boolean> {
	const code = oneTimeCodeFromDeepLink(url);
	if (!code) {
		return false;
	}
	const response = await fetch(
		new URL("/api/auth/tauri/exchange", env.VITE_SERVER_URL),
		{
			body: JSON.stringify({ code }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}
	);
	if (!response.ok) {
		return false;
	}
	const body = (await response.json()) as { token?: unknown };
	if (typeof body.token !== "string" || body.token.length === 0) {
		return false;
	}
	await saveDesktopSessionToken(body.token);
	return true;
}

export async function listenForDesktopGitHubSignIn(
	onSignedIn: () => void
): Promise<void> {
	if (!isDesktopShell()) {
		return;
	}
	const { getCurrent, onOpenUrl } = await import(
		"@tauri-apps/plugin-deep-link"
	);
	const handle = async (urls: string[]): Promise<void> => {
		await signInFromDeepLinks(urls, onSignedIn);
	};
	try {
		const current = await getCurrent();
		if (current) {
			await handle(current);
		}
	} catch {
		// Cold start without a deep link still has to render the shell.
	}
	await onOpenUrl((urls) => {
		handle(urls).catch(() => undefined);
	});
}

async function signInFromDeepLinks(
	urls: string[],
	onSignedIn: () => void
): Promise<void> {
	const [url, ...rest] = urls;
	if (!url) {
		return;
	}
	if (await completeDesktopGitHubSignIn(url)) {
		onSignedIn();
		return;
	}
	await signInFromDeepLinks(rest, onSignedIn);
}
