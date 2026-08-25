import {
	AccountAccessError,
	CSRF_REJECTED_MESSAGE,
} from "./account-access-error";

export function assertCookieCsrf(
	request: Request,
	trustedOrigins: readonly string[]
): void {
	const cookie = request.headers.get("cookie");
	if (!cookie) {
		return;
	}
	const originHeader =
		request.headers.get("origin") || request.headers.get("referer") || "";
	if (!originHeader || originHeader === "null") {
		throw new AccountAccessError(403, CSRF_REJECTED_MESSAGE);
	}
	if (!trustedOrigins.some((trusted) => originMatches(originHeader, trusted))) {
		throw new AccountAccessError(403, CSRF_REJECTED_MESSAGE);
	}
}

function originMatches(header: string, trusted: string): boolean {
	try {
		const actual = new URL(header);
		const expected = new URL(trusted);
		if (actual.origin !== "null" && expected.origin !== "null") {
			return actual.origin === expected.origin;
		}
		return (
			actual.protocol === expected.protocol && actual.host === expected.host
		);
	} catch {
		return header === trusted;
	}
}
