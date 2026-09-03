import type { SeedContext } from "../helpers/context";
import { seedCantiaraProject } from "./projects/cantiara";
import { seedMobileBetaProject } from "./projects/mobile-beta";
import { seedOpenDocsSdkProject } from "./projects/open-docs-sdk";
import { seedScratchProject } from "./projects/scratch";

export interface SeedSummary {
	documents: number;
	projects: Array<{ name: string; shortCode: string }>;
	tags: number;
	work: number;
}

export async function seedDemoData(ctx: SeedContext): Promise<SeedSummary> {
	const cantiara = await seedCantiaraProject(ctx);
	const openDocsSdk = await seedOpenDocsSdkProject(ctx);
	const mobileBeta = await seedMobileBetaProject(ctx);
	const scratch = await seedScratchProject(ctx);

	if (ctx.dryRun) {
		return {
			documents: 3,
			projects: [
				{ name: cantiara.name, shortCode: cantiara.shortCode },
				{ name: openDocsSdk.name, shortCode: openDocsSdk.shortCode },
				{ name: mobileBeta.name, shortCode: mobileBeta.shortCode },
				{ name: scratch.name, shortCode: scratch.shortCode },
			],
			tags: 2,
			work: 22,
		};
	}

	const [work, documents, tags] = await Promise.all([
		ctx.prisma.work.count({
			where: {
				projectId: {
					in: [cantiara.id, openDocsSdk.id, mobileBeta.id, scratch.id],
				},
			},
		}),
		ctx.prisma.document.count({
			where: { workspaceId: ctx.workspaceId },
		}),
		ctx.prisma.tag.count({
			where: { workspaceId: ctx.workspaceId },
		}),
	]);

	return {
		documents,
		projects: [
			{ name: cantiara.name, shortCode: cantiara.shortCode },
			{ name: openDocsSdk.name, shortCode: openDocsSdk.shortCode },
			{ name: mobileBeta.name, shortCode: mobileBeta.shortCode },
			{ name: scratch.name, shortCode: scratch.shortCode },
		],
		tags,
		work,
	};
}
