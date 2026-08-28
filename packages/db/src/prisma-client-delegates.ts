import type { PrismaClient } from "../prisma/generated/client";

export function prismaClientHasCurrentDelegates(client: PrismaClient): boolean {
	return (
		typeof client.captureInboxItem?.findMany === "function" &&
		typeof client.projectSkeletonSelection?.findMany === "function" &&
		typeof client.captureExtensionLink?.findMany === "function" &&
		typeof client.captureStagingObject?.findMany === "function" &&
		typeof client.work?.findMany === "function" &&
		typeof client.work?.create === "function" &&
		typeof client.workLifecycleEvent?.findMany === "function" &&
		typeof client.featureHealthUpdate?.findMany === "function" &&
		typeof client.workRelatedEdge?.findMany === "function" &&
		typeof client.workRelation?.findMany === "function" &&
		typeof client.workMergeEvent?.findFirst === "function" &&
		typeof client.workMergeEvent?.create === "function" &&
		typeof client.typedRelation?.findMany === "function" &&
		typeof client.typedRelation?.create === "function" &&
		typeof client.projectCustomFieldDefinition?.findMany === "function" &&
		typeof client.projectCustomFieldDefinition?.create === "function" &&
		typeof client.projectCustomFieldValue?.findMany === "function" &&
		typeof client.projectCustomFieldValue?.create === "function" &&
		typeof client.workDraft?.findMany === "function" &&
		typeof client.workDraft?.create === "function" &&
		typeof client.fileAttachment?.findMany === "function" &&
		typeof client.fileImageDerivative?.findMany === "function"
	);
}
