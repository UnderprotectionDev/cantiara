import type { PrismaClient } from "../../packages/db/src/index.ts";

const LOCAL_DATABASE_PATTERN = /127\.0\.0\.1|localhost/;

export function isLocalDatabaseUrl(databaseUrl: string): boolean {
	return LOCAL_DATABASE_PATTERN.test(databaseUrl);
}

export function assertHostedSeedAllowed(databaseUrl: string): void {
	if (isLocalDatabaseUrl(databaseUrl)) {
		return;
	}
	if (process.env.NODE_ENV === "development") {
		return;
	}
	if (process.env.SEED_CONFIRM === "hosted") {
		return;
	}
	console.error(
		"Refusing to seed a hosted database outside development without SEED_CONFIRM=hosted."
	);
	console.error("Example: SEED_CONFIRM=hosted bun run db:seed");
	process.exit(1);
}

export interface SeedTarget {
	actorId: string;
	email: string;
	workspaceId: string;
}

export async function findSeedTarget(
	prisma: PrismaClient,
	_databaseUrl: string
): Promise<SeedTarget> {
	const email = process.env.SEED_USER_EMAIL?.trim();
	if (email) {
		const user = await prisma.user.findUnique({
			include: { workspace: true },
			where: { email },
		});
		if (!user?.workspace) {
			throw new Error(
				`No Workspace found for SEED_USER_EMAIL=${email}. Sign in once with GitHub first.`
			);
		}
		return {
			actorId: user.id,
			email: user.email,
			workspaceId: user.workspace.id,
		};
	}

	const githubWorkspace = await prisma.workspace.findFirst({
		include: {
			owner: {
				include: {
					accounts: {
						where: { providerId: "github" },
					},
				},
			},
		},
		orderBy: { createdAt: "asc" },
		where: {
			owner: {
				accounts: {
					some: { providerId: "github" },
				},
			},
		},
	});
	if (githubWorkspace) {
		return {
			actorId: githubWorkspace.ownerId,
			email: githubWorkspace.owner.email,
			workspaceId: githubWorkspace.id,
		};
	}

	const workspace = await prisma.workspace.findFirst({
		include: { owner: true },
		orderBy: { createdAt: "asc" },
	});
	if (workspace) {
		return {
			actorId: workspace.ownerId,
			email: workspace.owner.email,
			workspaceId: workspace.id,
		};
	}

	throw new Error(
		"No Workspace found. Sign in once with GitHub, then run: bun run db:seed"
	);
}
