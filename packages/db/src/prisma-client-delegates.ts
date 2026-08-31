import type { PrismaClient } from "../prisma/generated/client";

export function prismaClientHasCurrentDelegates(client: PrismaClient): boolean {
	const knownDelegates =
		typeof client.captureInboxItem?.findMany === "function" &&
		typeof client.projectSkeletonSelection?.findMany === "function" &&
		typeof client.captureExtensionLink?.findMany === "function" &&
		typeof client.captureStagingObject?.findMany === "function" &&
		typeof client.captureBulkSenseView?.findMany === "function" &&
		typeof client.work?.findMany === "function" &&
		typeof client.work?.create === "function" &&
		typeof client.workLifecycleEvent?.findMany === "function" &&
		typeof client.featureHealthUpdate?.findMany === "function" &&
		typeof client.workRelatedEdge?.findMany === "function" &&
		typeof client.workRelation?.findMany === "function" &&
		typeof client.usageLink?.findMany === "function" &&
		typeof client.usageHostEmbed?.findMany === "function" &&
		typeof client.workMergeEvent?.findFirst === "function" &&
		typeof client.workMergeEvent?.create === "function" &&
		typeof client.tag?.findMany === "function" &&
		typeof client.tagInlineUse?.findMany === "function" &&
		typeof client.workTag?.findMany === "function" &&
		typeof client.typedRelation?.findMany === "function" &&
		typeof client.typedRelation?.create === "function" &&
		typeof client.projectCustomFieldDefinition?.findMany === "function" &&
		typeof client.projectCustomFieldDefinition?.create === "function" &&
		typeof client.projectCustomFieldValue?.findMany === "function" &&
		typeof client.projectCustomFieldValue?.create === "function" &&
		typeof client.projectPriorityMapPresentation?.findUnique === "function" &&
		typeof client.projectPriorityMapPresentation?.upsert === "function" &&
		typeof client.projectBacklogManualOrderItem?.findMany === "function" &&
		typeof client.projectBacklogManualOrderItem?.createMany === "function" &&
		typeof client.projectBacklogPresentation?.findUnique === "function" &&
		typeof client.projectBacklogPresentation?.upsert === "function" &&
		typeof client.externalExecutionHandoff?.findMany === "function" &&
		typeof client.externalExecutionHandoff?.create === "function" &&
		typeof client.workTemplate?.findMany === "function" &&
		typeof client.workTemplate?.create === "function" &&
		typeof client.recordAction?.findMany === "function" &&
		typeof client.recordAction?.create === "function" &&
		typeof client.workDraft?.findMany === "function" &&
		typeof client.workDraft?.create === "function" &&
		// Daily Focus membership and candidate rejection are read via table SQL
		// so a bun --hot client generated before those models can still serve
		// Daily Focus. Do not gate getPrismaClient on them.
		// Completion effect preference is read via table SQL so a bun --hot
		// client generated before that model can still serve Hesap settings.
		typeof client.fileAttachment?.findMany === "function" &&
		typeof client.fileAttachmentVersion?.findMany === "function" &&
		typeof client.fileAttachmentVersionPin?.findMany === "function" &&
		typeof client.fileAttachmentRelation?.findMany === "function" &&
		typeof client.fileAttachmentOriginLocation?.findMany === "function" &&
		typeof client.fileAttachmentStaging?.findMany === "function" &&
		typeof client.fileAttachmentReceipt?.findMany === "function" &&
		typeof client.fileObjectBlob?.findMany === "function" &&
		typeof client.fileImageDerivative?.findMany === "function";
	if (!knownDelegates) {
		return false;
	}

	const runtime = client as { _runtimeDataModel?: unknown };
	if (!isRecord(runtime._runtimeDataModel)) {
		return true;
	}
	const { models } = runtime._runtimeDataModel;
	if (!isRecord(models)) {
		return true;
	}
	return Object.keys(models).every((modelName) => {
		const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
		const delegate = (client as unknown as Record<string, unknown>)[
			delegateName
		];
		if (!isRecord(delegate)) {
			return false;
		}
		return [
			"count",
			"create",
			"createMany",
			"delete",
			"deleteMany",
			"findFirst",
			"findFirstOrThrow",
			"findMany",
			"findUnique",
			"findUniqueOrThrow",
			"groupBy",
			"update",
			"updateMany",
			"upsert",
		].every((method) => typeof delegate[method] === "function");
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function modelFieldNames(client: PrismaClient, model: string): string[] {
	const runtime = client as { _runtimeDataModel?: unknown };
	if (!isRecord(runtime._runtimeDataModel)) {
		return [];
	}
	const { models } = runtime._runtimeDataModel;
	if (!(isRecord(models) && isRecord(models[model]))) {
		return [];
	}
	const { fields } = models[model];
	if (!Array.isArray(fields)) {
		return [];
	}
	return fields.flatMap((field) => {
		if (isRecord(field) && typeof field.name === "string") {
			return [field.name];
		}
		return [];
	});
}

export function prismaClientHasCurrentFileAttachmentVersionModel(
	client: PrismaClient
): boolean {
	const fields = modelFieldNames(client, "FileAttachmentVersion");
	if (fields.length === 0) {
		return true;
	}
	return (
		fields.includes("markingMarks") && fields.includes("shareItemApprovals")
	);
}

/**
 * Project.priorityCriterionDefinitions is required for Projects list
 * (`listProjects` include). Project.focusThreshold and
 * ProjectWorkStatus.softWipLimit are required for Kanban Soft WIP and
 * Focus threshold. A bun `--hot` client generated before those fields
 * still has a Project delegate; select then throws
 * "Unknown field 'focusThreshold'".
 */
export function prismaClientHasCurrentProjectModel(
	client: PrismaClient
): boolean {
	const projectFields = modelFieldNames(client, "Project");
	if (projectFields.length === 0) {
		return true;
	}
	if (
		!(
			projectFields.includes("priorityCriterionDefinitions") &&
			projectFields.includes("focusThreshold")
		)
	) {
		return false;
	}
	const statusFields = modelFieldNames(client, "ProjectWorkStatus");
	if (statusFields.length === 0) {
		return true;
	}
	return statusFields.includes("softWipLimit");
}

export function prismaClientHasCurrentWorkspaceModel(
	client: PrismaClient
): boolean {
	const fields = modelFieldNames(client, "Workspace");
	if (fields.length === 0) {
		return true;
	}
	return fields.includes("overviewLayout");
}

export function prismaClientHasCurrentTypedRelationModel(
	client: PrismaClient
): boolean {
	const fields = modelFieldNames(client, "TypedRelation");
	if (fields.length === 0) {
		return true;
	}
	return fields.includes("resolvedAt") && fields.includes("resolutionNote");
}

/**
 * ExternalExecutionHandoff.goingPackages, events, and cancelReason are
 * required for Work detail list, history, and Cancel Handoff. A bun
 * `--hot` client generated before those fields still has a handoff
 * delegate; include/update then throws unknown field or argument.
 */
export function prismaClientHasCurrentExternalExecutionHandoffModel(
	client: PrismaClient
): boolean {
	const fields = modelFieldNames(client, "ExternalExecutionHandoff");
	if (fields.length === 0) {
		return true;
	}
	return (
		fields.includes("goingPackages") &&
		fields.includes("events") &&
		fields.includes("cancelReason")
	);
}

export function workspaceOverviewLayoutSelect(client: PrismaClient) {
	if (prismaClientHasCurrentWorkspaceModel(client)) {
		return { overviewLayout: true } as const;
	}
	return { id: true } as const;
}
