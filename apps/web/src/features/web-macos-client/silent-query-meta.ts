export function hasSilentMeta(meta: unknown): boolean {
	return (
		typeof meta === "object" &&
		meta !== null &&
		"silent" in meta &&
		meta.silent === true
	);
}
