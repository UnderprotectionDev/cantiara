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
		typeof client.usageLink?.findMany === "function" &&
		typeof client.usageHostEmbed?.findMany === "function" &&
		typeof client.workMergeEvent?.findFirst === "function" &&
		typeof client.workMergeEvent?.create === "function"
	);
}
