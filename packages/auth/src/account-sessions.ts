import type { PrismaClient } from "@cantiara/db";

import {
	AccountAccessError,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import { assertCookieCsrf } from "./csrf";
import {
	type GitHubAvailability,
	githubWaitingPayload,
	WAITING_FOR_GITHUB_MESSAGE,
} from "./github-availability";
import { identityAlias } from "./identity-alias";
import {
	type AuditLog,
	SESSION_REVOKED_EVENT_TYPE,
	type SecurityEventLog,
	sessionAuditEvent,
} from "./session-events";
import {
	deviceFromUserAgent,
	isExpiredSessionLifetime,
} from "./session-policy";

export interface AccountSession {
	current: boolean;
	device: string;
	id: string;
	lastActivity: string;
}

export interface ProductSession {
	session: {
		id: string;
		createdAt: Date;
		expiresAt: Date;
		token: string;
		userId: string;
	};
	user: { id: string };
}

export interface ProductAuth {
	api: {
		getSession: (args: {
			headers: Headers;
			query?: { disableCookieCache?: boolean; disableRefresh?: boolean };
		}) => Promise<ProductSession | null>;
	};
}

export interface GitHubIdentityConfirmation {
	message: string;
	status: "waiting";
}

export interface AccountSessionAccess {
	applyGitHubAppUninstalled: (input: {
		githubUserId?: string;
		installationId: string;
	}) => Promise<void>;
	applyGitHubLoginOAuthRevoked: (githubUserId: string) => Promise<void>;
	confirmGitHubIdentity: (
		request: Request
	) => Promise<GitHubIdentityConfirmation>;
	consumeConfirmGitHubIdentityGrant: (
		request: Request,
		operationId: string
	) => Promise<void>;
	current: (request: Request) => Promise<ProductSession | null>;
	githubAvailability: () => Promise<GitHubAvailability>;
	list: (request: Request) => Promise<AccountSession[]>;
	replay: () => Promise<void>;
	revoke: (request: Request, sessionId: string) => Promise<void>;
	revokeOthers: (request: Request) => Promise<void>;
	write: (request: Request) => Promise<{ written: true; workspaceId: string }>;
}

export function createAccountSessionAccess(deps: {
	auth: ProductAuth;
	auditLog: AuditLog;
	githubAvailability: () => Promise<GitHubAvailability>;
	now?: () => Date;
	prisma: PrismaClient;
	secret: string;
	securityEventLog: SecurityEventLog;
	trustedOrigins: readonly string[];
}): AccountSessionAccess {
	const now = deps.now ?? (() => new Date());

	async function current(request: Request): Promise<ProductSession | null> {
		let session: ProductSession | null;
		try {
			session = await deps.auth.api.getSession({
				headers: request.headers,
				query: { disableCookieCache: true, disableRefresh: true },
			});
		} catch {
			return null;
		}
		if (!session) {
			return null;
		}
		if (
			isExpiredSessionLifetime({
				createdAt: new Date(session.session.createdAt),
				expiresAt: new Date(session.session.expiresAt),
				now: now(),
			})
		) {
			await deps.prisma.session.deleteMany({
				where: { id: session.session.id },
			});
			return null;
		}
		return session;
	}

	async function requireSession(request: Request): Promise<ProductSession> {
		const session = await current(request);
		if (!session) {
			throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
		}
		return session;
	}

	async function recordRevoke(input: {
		accountId: string;
		actorId: string;
		sessionId: string;
	}) {
		const event = sessionAuditEvent({
			accountId: input.accountId,
			actorId: input.actorId,
			now: now(),
			secret: deps.secret,
			sessionId: input.sessionId,
			type: SESSION_REVOKED_EVENT_TYPE,
		});
		await deps.auditLog.append(event);
		await deps.securityEventLog.append(event);
	}

	function liveSessionsForUser(userId: string) {
		return deps.prisma.session.findMany({
			orderBy: { updatedAt: "desc" },
			where: {
				expiresAt: { gt: now() },
				userId,
			},
		});
	}

	return {
		applyGitHubAppUninstalled(_input) {
			return Promise.resolve();
		},
		async applyGitHubLoginOAuthRevoked(githubUserId) {
			const githubAccount = await deps.prisma.account.findFirst({
				where: {
					accountId: githubUserId,
					providerId: "github",
				},
			});
			if (!githubAccount) {
				return;
			}
			const sessions = await liveSessionsForUser(githubAccount.userId);
			await Promise.all(
				sessions.map((session) =>
					recordRevoke({
						accountId: githubAccount.userId,
						actorId: githubAccount.userId,
						sessionId: session.id,
					})
				)
			);
			await deps.prisma.session.deleteMany({
				where: { userId: githubAccount.userId },
			});
			await deps.prisma.account.update({
				data: {
					accessToken: null,
					accessTokenExpiresAt: null,
					idToken: null,
					refreshToken: null,
					refreshTokenExpiresAt: null,
				},
				where: { id: githubAccount.id },
			});
		},
		async confirmGitHubIdentity(request) {
			await requireSession(request);
			if ((await deps.githubAvailability()) === "waiting") {
				return githubWaitingPayload();
			}
			throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
		},
		async consumeConfirmGitHubIdentityGrant(request, _operationId) {
			await requireSession(request);
			if ((await deps.githubAvailability()) === "waiting") {
				throw new AccountAccessError(503, WAITING_FOR_GITHUB_MESSAGE);
			}
			throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
		},
		current,
		githubAvailability: () => deps.githubAvailability(),
		async list(request) {
			const session = await requireSession(request);
			const listed = await liveSessionsForUser(session.user.id);
			return listed.map((item) => ({
				current: item.id === session.session.id,
				device: deviceFromUserAgent(item.userAgent),
				id: item.id,
				lastActivity: item.updatedAt.toISOString(),
			}));
		},
		async replay() {
			const liveIds = await deps.prisma.session.findMany({
				select: { id: true },
			});
			const revokeIds: string[] = [];
			await deps.securityEventLog.replay((event) => {
				if (event.type !== SESSION_REVOKED_EVENT_TYPE) {
					return Promise.resolve();
				}
				for (const live of liveIds) {
					if (
						identityAlias("session", live.id, deps.secret) ===
						event.sessionAlias
					) {
						revokeIds.push(live.id);
					}
				}
				return Promise.resolve();
			});
			if (revokeIds.length > 0) {
				await deps.prisma.session.deleteMany({
					where: { id: { in: revokeIds } },
				});
			}
		},
		async revoke(request, sessionId) {
			assertCookieCsrf(request, deps.trustedOrigins);
			const session = await requireSession(request);
			const target = await deps.prisma.session.findFirst({
				where: {
					expiresAt: { gt: now() },
					id: sessionId,
					userId: session.user.id,
				},
			});
			if (!target) {
				throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
			}
			await recordRevoke({
				accountId: session.user.id,
				actorId: session.user.id,
				sessionId: target.id,
			});
			await deps.prisma.session.deleteMany({
				where: { id: target.id },
			});
		},
		async revokeOthers(request) {
			assertCookieCsrf(request, deps.trustedOrigins);
			const session = await requireSession(request);
			const others = (await liveSessionsForUser(session.user.id)).filter(
				(item) => item.id !== session.session.id
			);
			await Promise.all(
				others.map((other) =>
					recordRevoke({
						accountId: session.user.id,
						actorId: session.user.id,
						sessionId: other.id,
					})
				)
			);
			if (others.length > 0) {
				await deps.prisma.session.deleteMany({
					where: { id: { in: others.map((other) => other.id) } },
				});
			}
		},
		async write(request) {
			assertCookieCsrf(request, deps.trustedOrigins);
			const session = await requireSession(request);
			const workspace = await deps.prisma.workspace.update({
				data: { updatedAt: now() },
				where: { ownerId: session.user.id },
			});
			return { workspaceId: workspace.id, written: true as const };
		},
	};
}
