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
