import type { SeedContext } from "../helpers/context";
import {
	type SeededProject,
	seedBlocker,
	seedChecklistItem,
	seedHorizon,
	seedIncludeWork,
	seedMilestone,
	seedProject,
	seedProjectDocument,
	seedProjectSource,
	seedWork,
	seedWorkClose,
	seedWorkPlanningDates,
	seedWorkStatus,
	seedWorkspaceTag,
} from "../helpers/domain";

export async function seedCantiaraProject(
	ctx: SeedContext
): Promise<SeededProject> {
	const project = await seedProject(ctx, {
		name: "Cantiara",
		prefix: "cantiara",
		shortCode: "CNT",
		starterConfiguration: "Solo SaaS",
	});

	const checkoutFeature = await seedWork(ctx, {
		prefix: "cantiara-checkout-feature",
		projectId: project.id,
		title: "Checkout flow",
		type: "Feature",
	});
	let checkoutFeatureLive = await seedWorkStatus(ctx, {
		prefix: "cantiara-checkout-feature",
		status: "In Progress",
		work: checkoutFeature,
	});
	checkoutFeatureLive = await seedChecklistItem(ctx, {
		prefix: "cantiara-checkout-check-1",
		title: "Review payment provider docs",
		work: checkoutFeatureLive,
	});
	checkoutFeatureLive = await seedChecklistItem(ctx, {
		prefix: "cantiara-checkout-check-2",
		title: "Validate guest wallet edge cases",
		work: checkoutFeatureLive,
	});

	const cardTask = await seedWork(ctx, {
		prefix: "cantiara-card-task",
		projectId: project.id,
		title: "Add card validation",
		type: "Task",
	});
	await seedIncludeWork(ctx, {
		feature: checkoutFeatureLive,
		prefix: "cantiara-card-include",
		work: cardTask,
	});

	const webhookBug = await seedWork(ctx, {
		prefix: "cantiara-webhook-bug",
		projectId: project.id,
		title: "Payment webhook timeout",
		type: "Bug",
	});
	const webhookBugLive = await seedWorkStatus(ctx, {
		prefix: "cantiara-webhook-bug",
		status: "Blocked",
		work: webhookBug,
	});

	const authTask = await seedWork(ctx, {
		prefix: "cantiara-auth-task",
		projectId: project.id,
		title: "Ship auth middleware",
		type: "Task",
	});
	await seedBlocker(ctx, {
		blocked: webhookBugLive,
		prefix: "cantiara-webhook-blocker",
		source: authTask,
	});

	const research = await seedWork(ctx, {
		prefix: "cantiara-research",
		projectId: project.id,
		title: "Chargeback patterns",
		type: "Research",
	});
	const researchLive = await seedWorkPlanningDates(ctx, {
		plannedStart: "2026-09-01",
		prefix: "cantiara-research-dates",
		targetDate: "2026-09-15",
		work: research,
	});
	await seedHorizon(ctx, {
		horizon: "Now",
		prefix: "cantiara-research-horizon",
		workId: researchLive.id,
	});

	const docsTask = await seedWork(ctx, {
		prefix: "cantiara-docs-task",
		projectId: project.id,
		title: "Write API docs",
		type: "Task",
	});
	await seedHorizon(ctx, {
		horizon: "Next",
		prefix: "cantiara-docs-horizon",
		workId: docsTask.id,
	});

	const latencyImprovement = await seedWork(ctx, {
		prefix: "cantiara-latency",
		projectId: project.id,
		title: "Reduce checkout latency",
		type: "Improvement",
	});
	const latencyLive = await seedWorkStatus(ctx, {
		prefix: "cantiara-latency-progress",
		status: "In Progress",
		work: latencyImprovement,
	});
	await seedWorkPlanningDates(ctx, {
		plannedStart: "2026-09-03",
		prefix: "cantiara-latency-dates",
		reappearDate: "2026-09-10",
		targetDate: "2026-09-20",
		work: latencyLive,
	});

	const abandonedTask = await seedWork(ctx, {
		prefix: "cantiara-abandoned",
		projectId: project.id,
		title: "Prototype coupon codes",
		type: "Task",
	});
	const abandonedLive = await seedWorkStatus(ctx, {
		prefix: "cantiara-abandoned-progress",
		status: "In Progress",
		work: abandonedTask,
	});
	await seedWorkClose(ctx, {
		prefix: "cantiara-abandoned-close",
		result: "Abandoned",
		work: abandonedLive,
	});

	const completedBug = await seedWork(ctx, {
		prefix: "cantiara-completed-bug",
		projectId: project.id,
		title: "Fix currency rounding",
		type: "Bug",
	});
	const completedLive = await seedWorkStatus(ctx, {
		prefix: "cantiara-completed-progress",
		status: "In Progress",
		work: completedBug,
	});
	await seedWorkClose(ctx, {
		prefix: "cantiara-completed-close",
		result: "Completed",
		work: completedLive,
	});

	await seedMilestone(ctx, {
		prefix: "cantiara-beta",
		projectId: project.id,
		targetDate: "2026-10-01",
		title: "Private beta",
		work: checkoutFeatureLive,
	});

	await seedWorkspaceTag(ctx, {
		name: "payments",
		prefix: "cantiara-tag-payments",
		work: webhookBugLive,
	});
	await seedWorkspaceTag(ctx, {
		name: "checkout",
		prefix: "cantiara-tag-checkout",
		work: checkoutFeatureLive,
	});

	await seedProjectDocument(ctx, {
		body: "## Scope\n\nGuest checkout, saved cards, and webhook reconciliation.",
		prefix: "cantiara-checkout-spec",
		projectId: project.id,
		title: "Checkout scope",
	});
	await seedProjectDocument(ctx, {
		body: "## Notes\n\nTrack chargeback research findings here.",
		prefix: "cantiara-research-notes",
		projectId: project.id,
		title: "Chargeback research notes",
	});
	await seedProjectSource(ctx, {
		capturedContent: "Checkout Session creates a hosted payment page.",
		prefix: "cantiara-stripe-checkout-source",
		projectId: project.id,
		title: "Stripe Checkout",
		url: "https://docs.stripe.com/payments/checkout",
	});

	return project;
}
