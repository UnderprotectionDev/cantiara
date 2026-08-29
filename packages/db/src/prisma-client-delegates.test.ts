import { describe, expect, it } from "bun:test";

import type { PrismaClient } from "../prisma/generated/client";
import {
	prismaClientHasCurrentDelegates,
	prismaClientHasCurrentFileAttachmentVersionModel,
	prismaClientHasCurrentProjectModel,
	prismaClientHasCurrentTypedRelationModel,
	prismaClientHasCurrentWorkspaceModel,
	workspaceOverviewLayoutSelect,
} from "./prisma-client-delegates";

function findMany(): Promise<never[]> {
	return Promise.resolve([]);
}

function workDelegates() {
	return {
		captureBulkSenseView: { findMany },
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
		workTemplate: {
			create: () => undefined,
			findMany,
		},
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
				fileAttachmentOriginLocation: { findMany },
				fileAttachmentReceipt: { findMany },
				fileAttachmentRelation: { findMany },
				fileAttachmentStaging: { findMany },
				fileAttachmentVersion: { findMany },
				fileAttachmentVersionPin: { findMany },
				fileImageDerivative: { findMany },
				fileObjectBlob: { findMany },
				tag: { findMany },
				usageHostEmbed: { findMany },
				usageLink: { findMany },
				workTag: { findMany },
			} as unknown as PrismaClient)
		).toBe(false);
	});

	it("refuses a bun --hot client generated before Work Template", () => {
		const { workTemplate: _dropped, ...beforeTemplates } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			fileAttachment: { findMany },
			fileAttachmentOriginLocation: { findMany },
			fileAttachmentReceipt: { findMany },
			fileAttachmentRelation: { findMany },
			fileAttachmentStaging: { findMany },
			fileAttachmentVersion: { findMany },
			fileAttachmentVersionPin: { findMany },
			fileImageDerivative: { findMany },
			fileObjectBlob: { findMany },
			tag: { findMany },
			tagInlineUse: { findMany },
			usageHostEmbed: { findMany },
			usageLink: { findMany },
			workTag: { findMany },
		};
		expect(
			prismaClientHasCurrentDelegates(
				beforeTemplates as unknown as PrismaClient
			)
		).toBe(false);
	});

	it("accepts a client that can read Feature health, Related edges, typed relations, Custom field values, Work Templates, Work Drafts, File Attachments, and Tags", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				...currentLifecycleDelegates(),
				fileAttachment: { findMany },
				fileAttachmentOriginLocation: { findMany },
				fileAttachmentReceipt: { findMany },
				fileAttachmentRelation: { findMany },
				fileAttachmentStaging: { findMany },
				fileAttachmentVersion: { findMany },
				fileAttachmentVersionPin: { findMany },
				fileImageDerivative: { findMany },
				fileObjectBlob: { findMany },
				tag: { findMany },
				tagInlineUse: { findMany },
				usageHostEmbed: { findMany },
				usageLink: { findMany },
				workTag: { findMany },
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before Project priority criteria", () => {
		expect(
			prismaClientHasCurrentProjectModel({
				_runtimeDataModel: {
					models: {
						Project: {
							fields: [{ name: "id" }, { name: "customFieldDefinitions" }],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentProjectModel({
				_runtimeDataModel: {
					models: {
						Project: {
							fields: [
								{ name: "id" },
								{ name: "priorityCriterionDefinitions" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before Workspace overviewLayout", () => {
		const staleClient = {
			_runtimeDataModel: {
				models: {
					Workspace: {
						fields: [
							{ name: "id" },
							{ name: "name" },
							{ name: "ownerId" },
							{ name: "createdAt" },
							{ name: "updatedAt" },
							{ name: "owner" },
							{ name: "projects" },
							{ name: "shortCodeReservations" },
							{ name: "tags" },
							{ name: "fileAttachments" },
						],
					},
				},
			},
		} as unknown as PrismaClient;
		expect(prismaClientHasCurrentWorkspaceModel(staleClient)).toBe(false);
		expect(workspaceOverviewLayoutSelect(staleClient)).toEqual({ id: true });
		const currentClient = {
			_runtimeDataModel: {
				models: {
					Workspace: {
						fields: [
							{ name: "id" },
							{ name: "name" },
							{ name: "overviewLayout" },
						],
					},
				},
			},
		} as unknown as PrismaClient;
		expect(prismaClientHasCurrentWorkspaceModel(currentClient)).toBe(true);
		expect(workspaceOverviewLayoutSelect(currentClient)).toEqual({
			overviewLayout: true,
		});
	});

	it("refuses a bun --hot client generated before File Attachment marking", () => {
		expect(
			prismaClientHasCurrentFileAttachmentVersionModel({
				_runtimeDataModel: {
					models: {
						FileAttachmentVersion: {
							fields: [
								{ name: "id" },
								{ name: "objectKey" },
								{ name: "previewStatus" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentFileAttachmentVersionModel({
				_runtimeDataModel: {
					models: {
						FileAttachmentVersion: {
							fields: [
								{ name: "id" },
								{ name: "markingMarks" },
								{ name: "shareItemApprovals" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before blocker resolution fields", () => {
		expect(
			prismaClientHasCurrentTypedRelationModel({
				_runtimeDataModel: {
					models: {
						TypedRelation: {
							fields: [
								{ name: "id" },
								{ name: "blockerState" },
								{ name: "establishedAt" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentTypedRelationModel({
				_runtimeDataModel: {
					models: {
						TypedRelation: {
							fields: [
								{ name: "id" },
								{ name: "blockerState" },
								{ name: "resolvedAt" },
								{ name: "resolutionNote" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a generated client missing a delegate method used by the server", () => {
		const client = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			_runtimeDataModel: {
				models: { Work: { fields: [] } },
			},
			fileAttachment: { findMany },
			fileAttachmentOriginLocation: { findMany },
			fileAttachmentReceipt: { findMany },
			fileAttachmentRelation: { findMany },
			fileAttachmentStaging: { findMany },
			fileAttachmentVersion: { findMany },
			fileAttachmentVersionPin: { findMany },
			fileImageDerivative: { findMany },
			fileObjectBlob: { findMany },
			tag: { findMany },
			tagInlineUse: { findMany },
			usageHostEmbed: { findMany },
			usageLink: { findMany },
			workTag: { findMany },
			workTemplate: { findMany },
		};
		expect(
			prismaClientHasCurrentDelegates(client as unknown as PrismaClient)
		).toBe(false);
	});
});
