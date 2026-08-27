import { describe, expect, it } from "bun:test";

import type { PrismaClient } from "../prisma/generated/client";
import { prismaClientHasCurrentDelegates } from "./prisma-client-delegates";

function findMany(): Promise<never[]> {
	return Promise.resolve([]);
}

function workDelegates() {
	return {
		captureExtensionLink: { findMany },
		captureInboxItem: { findMany },
		captureStagingObject: { findMany },
		projectSkeletonSelection: { findMany },
		work: { create: () => undefined, findMany },
		workLifecycleEvent: { findMany },
	};
}

describe("Prisma client current delegates", () => {
	it("refuses a bun --hot client generated before Feature inclusion", () => {
		expect(
			prismaClientHasCurrentDelegates(
				workDelegates() as unknown as PrismaClient
			)
		).toBe(false);
	});

	it("accepts a client that can read Feature health, Related edges, and File Attachments", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				featureHealthUpdate: { findMany },
				fileAttachment: { findMany },
				workMergeEvent: { create: () => undefined, findFirst: findMany },
				workRelatedEdge: { findMany },
				workRelation: { findMany },
			} as unknown as PrismaClient)
		).toBe(true);
	});
});
