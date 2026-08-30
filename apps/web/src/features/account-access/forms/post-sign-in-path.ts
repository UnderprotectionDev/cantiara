export const DEFAULT_POST_SIGN_IN_PATH = "/dashboard" as const;
export const SESSIONS_PATH = "/sessions" as const;
export const ACCOUNT_PATH = "/account" as const;
export const COMPLETION_EFFECTS_PATH = "/completion-effects" as const;

export type PostSignInPath =
	| typeof DEFAULT_POST_SIGN_IN_PATH
	| typeof SESSIONS_PATH
	| typeof ACCOUNT_PATH
	| typeof COMPLETION_EFFECTS_PATH;

export function postSignInPath(
	redirect: string | null | undefined
): PostSignInPath {
	if (
		redirect === SESSIONS_PATH ||
		redirect === ACCOUNT_PATH ||
		redirect === COMPLETION_EFFECTS_PATH
	) {
		return redirect;
	}
	return DEFAULT_POST_SIGN_IN_PATH;
}
