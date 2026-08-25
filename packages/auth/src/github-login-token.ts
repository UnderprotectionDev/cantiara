import { symmetricDecrypt } from "better-auth/crypto";

export type GitHubLoginTokenInspection = "valid" | "revoked" | "unreachable";

const GITHUB_LOGIN_USER_URL = "https://api.github.com/user";
const INSPECT_TIMEOUT_MS = 2000;

export async function inspectGitHubLoginAccessToken(input: {
	fetchImpl?: typeof fetch;
	secret: string;
	storedAccessToken: string;
}): Promise<GitHubLoginTokenInspection> {
	const token = await plaintextAccessToken(
		input.storedAccessToken,
		input.secret
	);
	if (!token) {
		return "unreachable";
	}
	try {
		const response = await (input.fetchImpl ?? fetch)(GITHUB_LOGIN_USER_URL, {
			headers: {
				accept: "application/vnd.github+json",
				authorization: `Bearer ${token}`,
				"user-agent": "Cantiara",
			},
			method: "GET",
			signal: AbortSignal.timeout(INSPECT_TIMEOUT_MS),
		});
		if (response.status === 401) {
			return "revoked";
		}
		if (response.ok) {
			return "valid";
		}
		return "unreachable";
	} catch {
		return "unreachable";
	}
}

async function plaintextAccessToken(
	stored: string,
	secret: string
): Promise<string | null> {
	try {
		return await symmetricDecrypt({ data: stored, key: secret });
	} catch {
		if (stored.startsWith("gho_") || stored.startsWith("ghu_")) {
			return stored;
		}
		return null;
	}
}
