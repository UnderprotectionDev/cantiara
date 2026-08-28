export const USED_IN_QUERY_ROOT = "used-in";

export function usedInQueryKey(recordId: string) {
	return [USED_IN_QUERY_ROOT, recordId] as const;
}
