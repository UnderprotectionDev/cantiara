export const WAITING_FOR_GITHUB_MESSAGE = "Waiting for GitHub";

const GITHUB_AVAILABILITY_PROBE_URL = "https://api.github.com/";

export type GitHubAvailability = "up" | "waiting";

export type GitHubAvailabilityReport =
	| { status: "up" }
	| { message: string; status: "waiting" };

const PROBE_TIMEOUT_MS = 2000;

export function isGitHubWaiting(
	status: GitHubAvailability
): status is "waiting" {
	return status === "waiting";
}

export function githubWaitingPayload(): Extract<
	GitHubAvailabilityReport,
	{ status: "waiting" }
> {
	return {
		message: WAITING_FOR_GITHUB_MESSAGE,
		status: "waiting",
	};
}

export function githubAvailabilityReport(
	status: GitHubAvailability
): GitHubAvailabilityReport {
	return isGitHubWaiting(status) ? githubWaitingPayload() : { status: "up" };
}

export function githubWaitingResponse(): Response {
	return Response.json(githubWaitingPayload(), { status: 503 });
}

export async function probeGitHubAvailability(
	fetchImpl: typeof fetch = fetch
): Promise<GitHubAvailability> {
	try {
		const response = await fetchImpl(GITHUB_AVAILABILITY_PROBE_URL, {
			method: "GET",
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		if (response.ok || response.status === 401 || response.status === 403) {
			return "up";
		}
		return "waiting";
	} catch {
		return "waiting";
	}
}
