export function nextBulkSelectedWorkIds(
	current: string[],
	workId: string,
	selected: boolean
): string[] {
	if (selected) {
		if (current.includes(workId)) {
			return current;
		}
		return [...current, workId];
	}
	return current.filter((id) => id !== workId);
}

export function bulkEditTargetIds({
	selectedWorkIds,
	visibleWorkIds,
}: {
	selectedWorkIds: string[];
	visibleWorkIds: string[];
}): string[] {
	const visible = new Set(visibleWorkIds);
	return selectedWorkIds.filter((id) => visible.has(id));
}
