import { clearWorkspace } from "./clear-workspace";
import {
	assertHostedSeedAllowed,
	findSeedTarget,
	isLocalDatabaseUrl,
} from "./find-target";
import type { SeedContext } from "./helpers/context";
import { disconnectSeedPrismaClient, getSeedPrismaClient } from "./prisma";
import { seedDemoData } from "./seed-demo-data";

function parseArgs(argv: string[]): { dryRun: boolean } {
	return { dryRun: argv.includes("--dry-run") };
}

async function main(): Promise<void> {
	process.env.NODE_ENV ??= "development";

	const databaseUrl = process.env.DATABASE_URL ?? "";
	if (!databaseUrl) {
		console.error("DATABASE_URL is required.");
		console.error(
			"Set it in Cursor My Secrets or export DATABASE_URL before running seed."
		);
		process.exit(1);
	}

	const { dryRun } = parseArgs(process.argv.slice(2));
	assertHostedSeedAllowed(databaseUrl);

	const prisma = getSeedPrismaClient();
	const target = await findSeedTarget(prisma, databaseUrl);

	console.log(
		`Seed target: ${target.email} (workspace ${target.workspaceId})${
			dryRun ? " [dry-run]" : ""
		}`
	);
	console.log(
		`Database: ${isLocalDatabaseUrl(databaseUrl) ? "local" : "hosted"}`
	);

	const ctx: SeedContext = {
		actorId: target.actorId,
		dryRun,
		prisma,
		workspaceId: target.workspaceId,
	};

	if (!dryRun) {
		console.log("Clearing workspace content...");
		await clearWorkspace(prisma, target.workspaceId, target.actorId);
	}

	console.log("Seeding demo data...");
	const summary = await seedDemoData(ctx);

	console.log("Seed complete.");
	console.log(`Projects (${summary.projects.length}):`);
	for (const project of summary.projects) {
		console.log(`  - ${project.name} (${project.shortCode})`);
	}
	console.log(`Work records: ${summary.work}`);
	console.log(`Documents: ${summary.documents}`);
	console.log(`Tags: ${summary.tags}`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await disconnectSeedPrismaClient();
	});
