export function nextSelectedWorkId(
	current: string | null,
	clicked: string
): string | null {
	return current === clicked ? null : clicked;
}
