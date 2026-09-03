import type { SeedContext } from "../helpers/context";
import { type SeededProject, seedProject, seedWork } from "../helpers/domain";

export async function seedScratchProject(
	ctx: SeedContext
): Promise<SeededProject> {
	const project = await seedProject(ctx, {
		name: "Scratch",
		prefix: "scratch",
		shortCode: "SCR",
		starterConfiguration: "Blank Project",
	});

	await seedWork(ctx, {
		prefix: "scratch-note-task",
		projectId: project.id,
		title: "Capture first idea",
		type: "Task",
	});
	await seedWork(ctx, {
		prefix: "scratch-spike-research",
		projectId: project.id,
		title: "Spike unknown area",
		type: "Research",
	});
	await seedWork(ctx, {
		prefix: "scratch-polish-improvement",
		projectId: project.id,
		title: "Polish naming",
		type: "Improvement",
	});

	return project;
}
