import { orpc } from "@/utils/orpc";

export function readUsedInQueryOptions(recordId: string) {
	return orpc.relations.inspect.queryOptions({
		input: { recordId },
	});
}
