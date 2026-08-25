export function githubWaitCopy(
	report: { message?: string; status?: string } | undefined
): string | undefined {
	if (report?.status !== "waiting") {
		return;
	}
	return report.message;
}

export function githubWaitPollMs(status: string | undefined): number | false {
	return status === "waiting" ? 15_000 : false;
}

export function confirmGitHubIdentityStatus(input: {
	confirmation?: { message?: string; status?: string };
	isError?: boolean;
	isPending?: boolean;
}): { text: string; waiting: boolean } | undefined {
	if (input.isPending) {
		return { text: "Loading…", waiting: false };
	}
	if (input.isError) {
		return {
			text: "Confirm GitHub Identity is unavailable.",
			waiting: false,
		};
	}
	const waitingCopy = githubWaitCopy(input.confirmation);
	if (waitingCopy) {
		return { text: waitingCopy, waiting: true };
	}
	if (input.confirmation?.status === "ready") {
		return {
			text: "This confirms the GitHub identity bound to this Account. It is not a password or MFA prompt.",
			waiting: false,
		};
	}
}
