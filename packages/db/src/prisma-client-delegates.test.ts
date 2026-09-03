import { describe, expect, it } from "bun:test";

import type { PrismaClient } from "../prisma/generated/client";
import {
	prismaClientHasCurrentDelegates,
	prismaClientHasCurrentExternalExecutionHandoffModel,
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
		completionEffectPreference: {
			findMany,
			findUnique: findMany,
			upsert: () => undefined,
		},
		dailyFocusCandidateRejection: {
			create: () => undefined,
			findMany,
			findUnique: findMany,
		},
		dailyFocusMembership: { findMany, findUnique: findMany },
		document: { findMany },
		documentConflictDraft: {
			create: () => undefined,
			delete: () => undefined,
			findMany,
			findUnique: findMany,
			update: () => undefined,
		},
		documentFolder: {
			create: () => undefined,
			findMany,
			findUnique: findMany,
		},
		documentTemplate: {
			create: () => undefined,
			findMany,
		},
		documentVersion: { findMany },
		nextConcreteStepChange: {
			create: () => undefined,
			findMany,
		},
		personalReminder: {
			create: () => undefined,
			findMany,
		},
		projectBacklogManualOrderItem: {
			createMany: () => undefined,
			findMany,
		},
		projectBacklogPresentation: {
			findUnique: findMany,
			upsert: () => undefined,
		},
		projectCustomFieldDefinition: {
			create: () => undefined,
			findMany,
		},
		projectCustomFieldValue: {
			create: () => undefined,
			findMany,
		},
		projectPriorityMapPresentation: {
			findMany,
			findUnique: findMany,
			upsert: () => undefined,
		},
		projectSkeletonSelection: { findMany },
		recordAction: {
			create: () => undefined,
			findMany,
		},
		returnToWorkVisibleOpen: {
			findMany,
			upsert: () => undefined,
		},
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

	it("refuses a bun --hot client generated before Document Template", () => {
		const { documentTemplate: _dropped, ...beforeDocumentTemplates } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionHandoff: { create: () => undefined, findMany },
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
				beforeDocumentTemplates as unknown as PrismaClient
			)
		).toBe(false);
	});

	it("refuses a bun --hot client generated before Document versions", () => {
		const { documentVersion: _dropped, ...beforeVersions } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionHandoff: { create: () => undefined, findMany },
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
			prismaClientHasCurrentDelegates(beforeVersions as unknown as PrismaClient)
		).toBe(false);
	});

	it("refuses a bun --hot client generated before Document Conflict Draft", () => {
		const { documentConflictDraft: _dropped, ...beforeDrafts } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionHandoff: { create: () => undefined, findMany },
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
			prismaClientHasCurrentDelegates(beforeDrafts as unknown as PrismaClient)
		).toBe(false);
	});

	it("refuses a bun --hot client generated before Document folders", () => {
		const { documentFolder: _dropped, ...beforeFolders } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionHandoff: { create: () => undefined, findMany },
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
			prismaClientHasCurrentDelegates(beforeFolders as unknown as PrismaClient)
		).toBe(false);
	});

	it("accepts a bun --hot client generated before Completion effect preference", () => {
		const { completionEffectPreference: _dropped, ...beforePreference } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionHandoff: { create: () => undefined, findMany },
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
				beforePreference as unknown as PrismaClient
			)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before External Execution Handoff", () => {
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
		).toBe(false);
	});

	it("accepts a bun --hot client generated before Daily Focus candidate rejection", () => {
		const { dailyFocusCandidateRejection: _dropped, ...beforeCandidates } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionGoingPackage: { create: () => undefined, findMany },
			externalExecutionHandoff: { create: () => undefined, findMany },
			externalExecutionHandoffEvent: { create: () => undefined, findMany },
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
				beforeCandidates as unknown as PrismaClient
			)
		).toBe(true);
	});

	it("accepts a bun --hot client generated before Daily Focus membership", () => {
		const { dailyFocusMembership: _dropped, ...beforeMembership } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionGoingPackage: { create: () => undefined, findMany },
			externalExecutionHandoff: { create: () => undefined, findMany },
			externalExecutionHandoffEvent: { create: () => undefined, findMany },
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
				beforeMembership as unknown as PrismaClient
			)
		).toBe(true);
	});

	it("accepts a bun --hot client generated before Return to Work visible open", () => {
		const { returnToWorkVisibleOpen: _dropped, ...beforeVisibleOpen } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionGoingPackage: { create: () => undefined, findMany },
			externalExecutionHandoff: { create: () => undefined, findMany },
			externalExecutionHandoffEvent: { create: () => undefined, findMany },
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
				beforeVisibleOpen as unknown as PrismaClient
			)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before Record Action", () => {
		const { recordAction: _dropped, ...beforeActions } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionGoingPackage: { create: () => undefined, findMany },
			externalExecutionHandoff: { create: () => undefined, findMany },
			externalExecutionHandoffEvent: { create: () => undefined, findMany },
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
			prismaClientHasCurrentDelegates(beforeActions as unknown as PrismaClient)
		).toBe(false);
	});

	it("detects a bun --hot External Execution Handoff generated before going package versions", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				...currentLifecycleDelegates(),
				externalExecutionHandoff: { create: () => undefined, findMany },
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
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [{ name: "id" }, { name: "goingPackageMarkdown" }],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [
								{ name: "id" },
								{ name: "goingPackages" },
								{ name: "events" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [
								{ name: "id" },
								{ name: "goingPackages" },
								{ name: "events" },
								{ name: "cancelReason" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("accepts a client that can read Feature health, Related edges, typed relations, Custom field values, Work Templates, Work Drafts, File Attachments, Tags, Record Actions, and External Execution Handoffs", () => {
		expect(
			prismaClientHasCurrentDelegates({
				...workDelegates(),
				...currentLifecycleDelegates(),
				externalExecutionGoingPackage: { create: () => undefined, findMany },
				externalExecutionHandoff: { create: () => undefined, findMany },
				externalExecutionHandoffEvent: { create: () => undefined, findMany },
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

	it("accepts a bun --hot client generated before Personal Reminder", () => {
		const { personalReminder: _dropped, ...beforeReminders } = {
			...workDelegates(),
			...currentLifecycleDelegates(),
			externalExecutionGoingPackage: { create: () => undefined, findMany },
			externalExecutionHandoff: { create: () => undefined, findMany },
			externalExecutionHandoffEvent: { create: () => undefined, findMany },
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
				beforeReminders as unknown as PrismaClient
			)
		).toBe(true);
		expect(
			prismaClientHasCurrentDelegates({
				...beforeReminders,
				_runtimeDataModel: {
					models: {
						PersonalReminder: { fields: [{ name: "id" }] },
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before Priority Map presentation", () => {
		const { projectPriorityMapPresentation: _dropped, ...beforeMap } = {
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
			prismaClientHasCurrentDelegates(beforeMap as unknown as PrismaClient)
		).toBe(false);
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
	});

	it("refuses a bun --hot client generated before Kanban Soft WIP and Focus threshold fields", () => {
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
						ProjectWorkStatus: {
							fields: [{ name: "semantic" }, { name: "label" }],
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
								{ name: "focusThreshold" },
								{ name: "reappearDateNotification" },
								{ name: "nextConcreteStep" },
								{ name: "nextConcreteStepUpdatedAt" },
							],
						},
						ProjectWorkStatus: {
							fields: [
								{ name: "semantic" },
								{ name: "label" },
								{ name: "softWipLimit" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(true);
	});

	it("refuses a bun --hot client generated before Next concrete step on Project (CANT-BD652F27)", () => {
		expect(
			prismaClientHasCurrentProjectModel({
				_runtimeDataModel: {
					models: {
						Project: {
							fields: [
								{ name: "id" },
								{ name: "priorityCriterionDefinitions" },
								{ name: "focusThreshold" },
								{ name: "reappearDateNotification" },
							],
						},
						ProjectWorkStatus: {
							fields: [
								{ name: "semantic" },
								{ name: "label" },
								{ name: "softWipLimit" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
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

	it("refuses a bun --hot client generated before Cancel Handoff reason", () => {
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [{ name: "id" }, { name: "workId" }, { name: "status" }],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [
								{ name: "id" },
								{ name: "workId" },
								{ name: "status" },
								{ name: "cancelReason" },
							],
						},
					},
				},
			} as unknown as PrismaClient)
		).toBe(false);
		expect(
			prismaClientHasCurrentExternalExecutionHandoffModel({
				_runtimeDataModel: {
					models: {
						ExternalExecutionHandoff: {
							fields: [
								{ name: "id" },
								{ name: "workId" },
								{ name: "status" },
								{ name: "goingPackages" },
								{ name: "events" },
								{ name: "cancelReason" },
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
