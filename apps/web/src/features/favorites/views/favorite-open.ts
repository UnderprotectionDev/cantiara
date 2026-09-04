export function favoriteOpenHref(openTarget: {
	href: string | null;
	openSourceRecord: string | null;
}): string | null {
	if (!(openTarget.openSourceRecord && openTarget.href)) {
		return null;
	}
	return openTarget.href;
}
