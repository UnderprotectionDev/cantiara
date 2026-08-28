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
		projectCustomFieldDefinition: {
			create: () => undefined,
			findMany,
		},
		projectCustomFieldValue: {
			create: () => undefined,
			findMany,
		},
		projectSkeletonSelection: { findMany },
		work: { create: () => undefined, findMany },
		workLifecycleEvent: { findMany },
	};
}

function currentLifecycleDelegates() {
	return {
		featureHealthUpdate: { findMany },
		typedRelation: { create: () => undefined, findMany },
		workDraft: { create: () => undefined, findMany },
		workMergeEvent: { create: () => undefined, findFirst: findMany },
		workRelatedEdge: { findMany },
		workRelation: { findMany },
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

	it("refuses a bun --hot client generated before Custom field values", () => {
		const { projectCustomFieldValue: _dropped, ...beforeValues } =
			workDelegates();
		expect(
			prismaClientHasCurrentDelegates({
				...beforeValues,
				...currentLifecycleDelegates(),
			} as unknown as PrismaClient)
		).toBe(false);
	});

	it("refuses a bun --hot client generated before tag inline uses", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				...currentLifecycleDelegates(),
				fileAttachment: { findMany },
				fileImageDerivative: { findMany },
				tag: { findMany },
				usageHostEmbed: { findMany },
				usageLink: { findMany },
				workTag: { findMany },
			} as unknown as PrismaClient)
		).toBe(false);
	});

	it("accepts a client that can read Feature health, Related edges, typed relations, Custom field values, Work Drafts, File Attachments, and Tags", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				...currentLifecycleDelegates(),
				fileAttachment: { findMany },
				tag: { findMany },
				tagInlineUse: { findMany },
				usageHostEmbed: { findMany },
				usageLink: { findMany },
				workTag: { findMany },
			} as unknown as PrismaClient)
		).toBe(true);
	});
});
