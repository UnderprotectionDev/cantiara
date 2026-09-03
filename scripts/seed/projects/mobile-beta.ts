import type { SeedContext } from "../helpers/context";
import {
	type SeededProject,
	seedHorizon,
	seedProject,
	seedWork,
	seedWorkPlanningDates,
	seedWorkStatus,
} from "../helpers/domain";

export async function seedMobileBetaProject(
	ctx: SeedContext
): Promise<SeededProject> {
	const project = await seedProject(ctx, {
		name: "Mobile Beta",
		prefix: "mobile-beta",
		shortCode: "MOB",
		starterConfiguration: "Mobile Application",
	});

	const onboardingFeature = await seedWork(ctx, {
		prefix: "mob-onboarding-feature",
		projectId: project.id,
		title: "Onboarding walkthrough",
		type: "Feature",
	});
	const onboardingLive = await seedWorkStatus(ctx, {
		prefix: "mob-onboarding-feature",
		status: "In Progress",
		work: onboardingFeature,
	});
	await seedWorkPlanningDates(ctx, {
		plannedStart: "2026-09-05",
		prefix: "mob-onboarding-dates",
		targetDate: "2026-09-25",
		work: onboardingLive,
	});

	const pushTask = await seedWork(ctx, {
		prefix: "mob-push-task",
		projectId: project.id,
		title: "Configure push notifications",
		type: "Task",
	});
	await seedHorizon(ctx, {
		horizon: "Now",
		prefix: "mob-push-horizon",
		workId: pushTask.id,
	});

	await seedWork(ctx, {
		prefix: "mob-crash-bug",
		projectId: project.id,
		title: "Crash on cold start",
		type: "Bug",
	});

	const perfImprovement = await seedWork(ctx, {
		prefix: "mob-perf-improvement",
		projectId: project.id,
		title: "Reduce launch time",
		type: "Improvement",
	});
	await seedHorizon(ctx, {
		horizon: "Later",
		prefix: "mob-perf-horizon",
		workId: perfImprovement.id,
	});

	return project;
}
