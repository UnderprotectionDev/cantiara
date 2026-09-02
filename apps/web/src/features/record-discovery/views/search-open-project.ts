export function openProjectIdFromLocation(input: {
	pathname: string;
	projectFromPath: string | null;
	search: Record<string, unknown>;
}): string | null {
	if (input.projectFromPath) {
		return input.projectFromPath;
	}
	if (
		input.pathname === "/search" &&
		typeof input.search.project === "string"
	) {
		return input.search.project.length > 0 ? input.search.project : null;
	}
	return null;
}

export function searchLinkSearch(
	openProjectId: string | null
): { project: string } | undefined {
	if (!openProjectId) {
		return;
	}
	return { project: openProjectId };
}
