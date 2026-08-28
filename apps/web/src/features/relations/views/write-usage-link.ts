import { client } from "@/utils/orpc";

import { isMissingProcedure } from "./is-missing-procedure";

interface CreateUsageInput {
	hostRecordId: string;
	idempotencyKey: string;
	kind: "inline-record-reference";
	sourceRecordId: string;
}

interface UnlinkUsageInput {
	idempotencyKey: string;
	usageLinkId: string;
}

export async function createUsageLinkWrite(input: CreateUsageInput) {
	try {
		return await client.relations.createUsageLink(input);
	} catch (error) {
		if (!isMissingProcedure(error)) {
			throw error;
		}
		return await client.workLifecycle.createUsageLink(input);
	}
}

export async function unlinkUsageLinkWrite(input: UnlinkUsageInput) {
	try {
		return await client.relations.unlinkUsageLink(input);
	} catch (error) {
		if (!isMissingProcedure(error)) {
			throw error;
		}
		return await client.workLifecycle.unlinkUsageLink(input);
	}
}
