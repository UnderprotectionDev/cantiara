export const DEFAULT_POST_SIGN_IN_PATH = "/dashboard" as const;
export const SESSIONS_PATH = "/sessions" as const;

export type PostSignInPath =
	| typeof DEFAULT_POST_SIGN_IN_PATH
	| typeof SESSIONS_PATH;

export function postSignInPath(
	redirect: string | null | undefined
): PostSignInPath {
	if (redirect === SESSIONS_PATH) {
		return SESSIONS_PATH;
	}
	return DEFAULT_POST_SIGN_IN_PATH;
}
