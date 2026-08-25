export const WAITING_FOR_GITHUB = "Waiting for GitHub";

export function isGitHubSignInWaiting(
	status: "up" | "waiting" | undefined
): boolean {
	return status === "waiting";
}
