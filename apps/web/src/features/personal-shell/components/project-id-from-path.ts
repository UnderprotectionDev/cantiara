const PROJECT_ID_PATH = /^\/projects\/([^/]+)$/;

export function projectIdFromPath(pathname: string): string | null {
	const match = PROJECT_ID_PATH.exec(pathname);
	const segment = match?.[1];
	if (!segment || segment === "new") {
		return null;
	}
	return segment;
}
