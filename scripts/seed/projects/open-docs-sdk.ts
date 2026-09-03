import type { SeedContext } from "../helpers/context";
import {
	type SeededProject,
	seedHorizon,
	seedProject,
	seedProjectDocument,
	seedWork,
	seedWorkStatus,
} from "../helpers/domain";

export async function seedOpenDocsSdkProject(
	ctx: SeedContext
): Promise<SeededProject> {
	const project = await seedProject(ctx, {
		name: "Open Docs SDK",
		prefix: "open-docs-sdk",
		shortCode: "ODS",
		starterConfiguration: "Open Source Library",
	});

	const readmeFeature = await seedWork(ctx, {
		prefix: "ods-readme-feature",
		projectId: project.id,
		title: "Rewrite README quickstart",
		type: "Feature",
	});
	await seedWorkStatus(ctx, {
		prefix: "ods-readme-feature",
		status: "In Progress",
		work: readmeFeature,
	});

	const semverTask = await seedWork(ctx, {
		prefix: "ods-semver-task",
		projectId: project.id,
		title: "Document semver policy",
		type: "Task",
	});
	await seedHorizon(ctx, {
		horizon: "Next",
		prefix: "ods-semver-horizon",
		workId: semverTask.id,
	});

	await seedWork(ctx, {
		prefix: "ods-release-research",
		projectId: project.id,
		title: "Compare release automation tools",
		type: "Research",
	});

	const flakyBug = await seedWork(ctx, {
		prefix: "ods-flaky-bug",
		projectId: project.id,
		title: "Fix flaky publish script",
		type: "Bug",
	});
	await seedWorkStatus(ctx, {
		prefix: "ods-flaky-bug",
		status: "Blocked",
		work: flakyBug,
	});

	await seedProjectDocument(ctx, {
		body: "## Maintainer guide\n\nRelease checklist and support expectations.",
		prefix: "ods-maintainer-guide",
		projectId: project.id,
		title: "Maintainer guide",
	});

	return project;
}
