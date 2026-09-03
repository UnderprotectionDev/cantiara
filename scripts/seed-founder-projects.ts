/**
 * Idempotent founder Projects on the product database (hosted Neon when
 * DATABASE_URL is not loopback). Re-run safe: skips a name that already
 * exists in the Workspace. Uses createProject so starter configuration
 * matches the Projects create flow.
 *
 * FOUNDER_EMAIL — optional. When unset, requires exactly one GitHub-linked
 * Workspace owner.
 *
 *   bun run scripts/seed-founder-projects.ts
 */
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";

import { createProject } from "../apps/server/src/features/project-shell/server/project-shell";

const FOUNDER_PROJECTS = [
	{
		name: "Harbor",
		starterConfiguration: "Blank Project",
	},
	{
		name: "Atlas",
		starterConfiguration: "Solo SaaS",
	},
	{
		name: "Lumen",
		starterConfiguration: "Open Source Library",
	},
] as const;

async function founderUserId(prisma: ReturnType<typeof getPrismaClient>) {
	const email = process.env.FOUNDER_EMAIL?.trim();
	if (email) {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new Error("No user matches FOUNDER_EMAIL");
		}
		return user.id;
	}
	const users = await prisma.user.findMany({
		include: { accounts: true, workspace: true },
	});
	const linked = users.filter(
		(user) =>
			user.workspace &&
			user.accounts.some((account) => account.providerId === "github")
	);
	if (linked.length === 0) {
		throw new Error("No GitHub-linked Workspace owner to seed");
	}
	if (linked.length > 1) {
		throw new Error(
			`Set FOUNDER_EMAIL; found ${linked.length} GitHub-linked Workspace owners`
		);
	}
	const [founder] = linked;
	if (!founder) {
		throw new Error("No GitHub-linked Workspace owner to seed");
	}
	return founder.id;
}

async function main() {
	const prisma = getPrismaClient();
	const userId = await founderUserId(prisma);
	const access = await getAccountAccessForUser(prisma, userId);
	if (!access) {
		throw new Error("Founder has no GitHub Workspace access");
	}
	await FOUNDER_PROJECTS.reduce(async (previous, seed) => {
		await previous;
		const existing = await prisma.project.findFirst({
			where: { name: seed.name, workspaceId: access.workspaceId },
		});
		if (existing) {
			console.log(`skip ${seed.name} (${seed.starterConfiguration})`);
			return;
		}
		const outcome = await createProject(prisma, {
			actorId: access.accountId,
			idempotencyKey: `seed-founder-project:${seed.name}`,
			origin: "human",
			payload: {
				name: seed.name,
				starterConfiguration: seed.starterConfiguration,
			},
			workspaceId: access.workspaceId,
		});
		if (outcome.status !== "committed" && outcome.status !== "replayed") {
			throw new Error(`Failed to seed ${seed.name}: ${outcome.status}`);
		}
		console.log(
			`${outcome.status} ${seed.name} (${seed.starterConfiguration})`
		);
	}, Promise.resolve());
}

await main();
