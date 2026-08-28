import { client } from "@/utils/orpc";

export async function readUsedIn(recordId: string) {
	return await client.relations.inspect({ recordId });
}
