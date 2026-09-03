import type { PrismaClient } from "../../packages/db/src/index.ts";

export async function clearWorkspace(
	prisma: PrismaClient,
	workspaceId: string
): Promise<void> {
	const projects = await prisma.project.findMany({
		select: { id: true },
		where: { workspaceId },
	});
	const projectIds = projects.map((project) => project.id);

	const works =
		projectIds.length === 0
			? []
			: await prisma.work.findMany({
					select: { id: true },
					where: { projectId: { in: projectIds } },
				});
	const workIds = works.map((work) => work.id);

	const milestones =
		projectIds.length === 0
			? []
			: await prisma.milestone.findMany({
					select: { id: true },
					where: { projectId: { in: projectIds } },
				});
	const milestoneIds = milestones.map((milestone) => milestone.id);

	const relationIds = [...workIds, ...milestoneIds];
	if (relationIds.length > 0) {
		await prisma.typedRelation.deleteMany({
			where: {
				OR: [{ fromId: { in: relationIds } }, { toId: { in: relationIds } }],
			},
		});
	}

	await prisma.mutationReceipt.deleteMany({
		where: {
			OR: [
				{ targetId: workspaceId },
				...(projectIds.length > 0 ? [{ targetId: { in: projectIds } }] : []),
				...(workIds.length > 0 ? [{ targetId: { in: workIds } }] : []),
			],
		},
	});

	await prisma.mutationStagingOperation.deleteMany({
		where: {
			OR: [
				{ targetId: workspaceId },
				...(projectIds.length > 0 ? [{ targetId: { in: projectIds } }] : []),
				...(workIds.length > 0 ? [{ targetId: { in: workIds } }] : []),
			],
		},
	});

	await prisma.usageLink.deleteMany({ where: { workspaceId } });
	await prisma.captureInboxItem.deleteMany({ where: { workspaceId } });
	await prisma.captureBulkSenseView.deleteMany({ where: { workspaceId } });
	await prisma.capturePairingCode.deleteMany({ where: { workspaceId } });
	await prisma.captureStagingObject.deleteMany({ where: { workspaceId } });
	await prisma.workDraft.deleteMany({ where: { workspaceId } });
	await prisma.documentConflictDraft.deleteMany({ where: { workspaceId } });
	await prisma.document.deleteMany({ where: { workspaceId } });
	await prisma.documentFolder.deleteMany({ where: { workspaceId } });
	await prisma.documentTemplate.deleteMany({ where: { workspaceId } });
	await prisma.fileAttachment.deleteMany({ where: { workspaceId } });
	await prisma.fileObjectBlob.deleteMany({ where: { workspaceId } });
	await prisma.focusPeriod.deleteMany({ where: { workspaceId } });
	await prisma.tag.deleteMany({ where: { workspaceId } });
	await prisma.project.deleteMany({ where: { workspaceId } });
	await prisma.workspaceShortCodeReservation.deleteMany({
		where: { workspaceId },
	});
}
