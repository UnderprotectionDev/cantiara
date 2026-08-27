export function nextExpandedNodeIds(
	current: readonly string[],
	toggledId: string
): string[] {
	return current.includes(toggledId)
		? current.filter((id) => id !== toggledId)
		: [...current, toggledId];
}
