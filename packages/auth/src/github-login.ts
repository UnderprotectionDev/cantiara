import type { PrismaClient } from "@cantiara/db";

export const GITHUB_IDENTITY_SCOPES = ["read:user", "user:email"] as const;

export const SIGN_IN_FAILED_MESSAGE = "Sign-in failed";

export const WORKSPACE_DEFAULT_NAME = "Workspace";

export interface AccountAccess {
	accountId: string;
	githubUserId: string;
	workspaceId: string;
	workspaceName: string;
}

export function genericSignInFailureResponse(status = 401): Response {
	return Response.json({ message: SIGN_IN_FAILED_MESSAGE }, { status });
}

export function toWebAppCallbackURL(
	callbackURL: string,
	origin: string | null,
	trustedOrigins: readonly string[]
): string {
	if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
		return callbackURL;
	}
	if (!(origin && trustedOrigins.includes(origin))) {
		return callbackURL;
	}
	return `${origin}${callbackURL}`;
}

export async function ensureWorkspaceForAccount(
	prisma: PrismaClient,
	ownerId: string
) {
	const existing = await prisma.workspace.findUnique({
		where: { ownerId },
	});
	if (existing) {
		return existing;
	}

	try {
		return await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: WORKSPACE_DEFAULT_NAME,
				ownerId,
			},
		});
	} catch (error) {
		const raced = await prisma.workspace.findUnique({
			where: { ownerId },
		});
		if (raced) {
			return raced;
		}
		throw new Error("Failed to admit the account to its Workspace", {
			cause: error,
		});
	}
}

export async function getAccountAccessForUser(
	prisma: PrismaClient,
	userId: string
): Promise<AccountAccess | null> {
	const workspace = await prisma.workspace.findUnique({
		where: { ownerId: userId },
	});
	if (!workspace) {
		return null;
	}

	const githubAccount = await prisma.account.findFirst({
		where: {
			providerId: "github",
			userId,
		},
	});
	if (!githubAccount) {
		return null;
	}

	return {
		accountId: userId,
		githubUserId: githubAccount.accountId,
		workspaceId: workspace.id,
		workspaceName: workspace.name,
	};
}

export function isGitHubSignInPath(pathname: string): boolean {
	return (
		pathname.endsWith("/sign-in/social") ||
		pathname.includes("/callback/github")
	);
}
