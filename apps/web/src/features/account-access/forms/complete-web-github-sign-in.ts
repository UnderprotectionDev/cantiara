const GITHUB_SIGN_IN_CODE_PARAM = "code";

export async function completeWebGitHubSignIn(
	code: string
): Promise<{ ok: boolean; redirect: string }> {
	if (code.length === 0) {
		return { ok: false, redirect: "/dashboard" };
	}
	const response = await fetch("/api/auth/web/exchange", {
		body: JSON.stringify({ code }),
		credentials: "include",
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	if (!response.ok) {
		return { ok: false, redirect: "/dashboard" };
	}
	try {
		const body = (await response.json()) as { redirect?: unknown };
		return {
			ok: true,
			redirect:
				typeof body.redirect === "string" && body.redirect.startsWith("/")
					? body.redirect
					: "/dashboard",
		};
	} catch {
		return { ok: true, redirect: "/dashboard" };
	}
}

export function githubSignInCodeFromSearch(search: {
	code?: string;
}): string | null {
	const code = search[GITHUB_SIGN_IN_CODE_PARAM];
	return typeof code === "string" && code.length > 0 ? code : null;
}
