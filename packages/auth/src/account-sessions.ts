import type { PrismaClient } from "@cantiara/db";

import {
	AccountAccessError,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import {
	type ConfirmGitHubIdentityStart,
	completeConfirmGitHubIdentityTour,
	consumeConfirmGitHubIdentityGrantRecord,
	requireConfirmGitHubIdentityOperationId,
	startConfirmGitHubIdentityTour,
} from "./confirm-github-identity";
import { assertCookieCsrf } from "./csrf";
import {
	type GitHubAvailability,
	type GitHubAvailabilityReport,
	githubAvailabilityReport,
	githubWaitingPayload,
	isGitHubWaiting,
	WAITING_FOR_GITHUB_MESSAGE,
} from "./github-availability";
import { getAccountAccessForUser } from "./github-login";
import { inspectGitHubLoginAccessToken } from "./github-login-token";
import { identityAlias } from "./identity-alias";
import {
	type AuditLog,
	CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE,
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

export type GitHubIdentityConfirmation =
	| { status: "ready" }
	| { message: string; status: "waiting" };

export interface AccountSessionAccess {
	applyGitHubAppUninstalled: (input: {
		githubUserId?: string;
		installationId: string;
	}) => Promise<void>;
	applyGitHubLoginOAuthRevoked: (githubUserId: string) => Promise<void>;
	completeConfirmGitHubIdentity: (
		request: Request,
		input: { code: string; state: string }
	) => Promise<void>;
	confirmGitHubIdentity: (
		request: Request
	) => Promise<GitHubIdentityConfirmation>;
	consumeConfirmGitHubIdentityGrant: (
		request: Request,
		operationId: string
	) => Promise<void>;
	current: (request: Request) => Promise<ProductSession | null>;
	githubAvailability: () => Promise<GitHubAvailabilityReport>;
	list: (request: Request) => Promise<AccountSession[]>;
	replay: () => Promise<void>;
	revoke: (request: Request, sessionId: string) => Promise<void>;
	revokeOthers: (request: Request) => Promise<void>;
	startConfirmGitHubIdentity: (
		request: Request,
		operationId: string
	) => Promise<ConfirmGitHubIdentityStart>;
	write: (request: Request) => Promise<{ written: true; workspaceId: string }>;
}

export function createAccountSessionAccess(deps: {
	auth: ProductAuth;
	auditLog: AuditLog;
	baseURL: string;
	github: { clientId: string; clientSecret: string };
	githubAvailability: () => Promise<GitHubAvailability>;
	now?: () => Date;
	prisma: PrismaClient;
	secret: string;
	securityEventLog: SecurityEventLog;
	trustedOrigins: readonly string[];
}): AccountSessionAccess {
	const now = deps.now ?? (() => new Date());

	async function applyGitHubLoginOAuthRevoked(githubUserId: string) {
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
	}

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
		const access = await getAccountAccessForUser(deps.prisma, session.user.id);
		if (!access) {
			return null;
		}
		if (isGitHubWaiting(await deps.githubAvailability())) {
			return session;
		}
		const githubAccount = await deps.prisma.account.findFirst({
			where: {
				providerId: "github",
				userId: session.user.id,
			},
		});
		if (!githubAccount) {
			return null;
		}
		if (!githubAccount.accessToken) {
			await applyGitHubLoginOAuthRevoked(githubAccount.accountId);
			return null;
		}
		const inspection = await inspectGitHubLoginAccessToken({
			secret: deps.secret,
			storedAccessToken: githubAccount.accessToken,
		});
		if (inspection === "revoked") {
			await applyGitHubLoginOAuthRevoked(githubAccount.accountId);
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

	async function recordConfirm(input: {
		accountId: string;
		sessionId: string;
		type:
			| typeof CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE
			| typeof CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE
			| typeof CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE;
	}) {
		await deps.auditLog.append(
			sessionAuditEvent({
				accountId: input.accountId,
				actorId: input.accountId,
				now: now(),
				secret: deps.secret,
				sessionId: input.sessionId,
				type: input.type,
			})
		);
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
		applyGitHubLoginOAuthRevoked,
		async completeConfirmGitHubIdentity(request, input) {
			const session = await requireSession(request);
			if (isGitHubWaiting(await deps.githubAvailability())) {
				throw new AccountAccessError(503, WAITING_FOR_GITHUB_MESSAGE);
			}
			const access = await getAccountAccessForUser(
				deps.prisma,
				session.user.id
			);
			if (!access) {
				throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
			}
			try {
				await completeConfirmGitHubIdentityTour({
					accountId: session.user.id,
					baseURL: deps.baseURL,
					code: input.code,
					expectedGitHubUserId: access.githubUserId,
					github: deps.github,
					now: now(),
					prisma: deps.prisma,
					secret: deps.secret,
					state: input.state,
				});
			} catch (error) {
				await recordConfirm({
					accountId: session.user.id,
					sessionId: session.session.id,
					type: CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE,
				});
				throw error;
			}
			await recordConfirm({
				accountId: session.user.id,
				sessionId: session.session.id,
				type: CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE,
			});
		},
		async confirmGitHubIdentity(request) {
			await requireSession(request);
			if (isGitHubWaiting(await deps.githubAvailability())) {
				return githubWaitingPayload();
			}
			return { status: "ready" as const };
		},
		async consumeConfirmGitHubIdentityGrant(request, operationId) {
			assertCookieCsrf(request, deps.trustedOrigins);
			const session = await requireSession(request);
			const confirmedOperationId =
				requireConfirmGitHubIdentityOperationId(operationId);
			if (isGitHubWaiting(await deps.githubAvailability())) {
				throw new AccountAccessError(503, WAITING_FOR_GITHUB_MESSAGE);
			}
			await consumeConfirmGitHubIdentityGrantRecord({
				accountId: session.user.id,
				now: now(),
				operationId: confirmedOperationId,
				prisma: deps.prisma,
			});
		},
		current,
		async githubAvailability() {
			return githubAvailabilityReport(await deps.githubAvailability());
		},
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
		async startConfirmGitHubIdentity(request, operationId) {
			assertCookieCsrf(request, deps.trustedOrigins);
			const session = await requireSession(request);
			const confirmedOperationId =
				requireConfirmGitHubIdentityOperationId(operationId);
			if (isGitHubWaiting(await deps.githubAvailability())) {
				return githubWaitingPayload();
			}
			const access = await getAccountAccessForUser(
				deps.prisma,
				session.user.id
			);
			if (!access) {
				throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
			}
			const url = await startConfirmGitHubIdentityTour({
				accountId: session.user.id,
				baseURL: deps.baseURL,
				githubClientId: deps.github.clientId,
				now: now(),
				operationId: confirmedOperationId,
				prisma: deps.prisma,
				secret: deps.secret,
			});
			await recordConfirm({
				accountId: session.user.id,
				sessionId: session.session.id,
				type: CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
			});
			return { status: "redirect" as const, url };
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
