import type { PrismaClient } from "@cantiara/db";

import {
	AccountAccessError,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import { assertCookieCsrf } from "./csrf";
import { identityAlias } from "./identity-alias";
import type { AuditLog, SecurityEventLog } from "./session-events";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";
import { deviceFromUserAgent, isPastAbsoluteLifetime } from "./session-policy";

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
		token: string;
		userId: string;
	};
	user: { id: string };
}

export interface ProductAuth {
	api: {
		getSession: (args: {
			headers: Headers;
			query?: { disableCookieCache?: boolean };
		}) => Promise<ProductSession | null>;
		listSessions: (args: { headers: Headers }) => Promise<
			Array<{
				id: string;
				token: string;
				userAgent?: string | null;
				updatedAt: Date | string;
				userId: string;
			}>
		>;
		revokeSession: (args: {
			headers: Headers;
			body: { token: string };
		}) => Promise<unknown>;
		revokeOtherSessions: (args: { headers: Headers }) => Promise<unknown>;
	};
}

export interface AccountSessionAccess {
	current: (request: Request) => Promise<ProductSession | null>;
	list: (request: Request) => Promise<AccountSession[]>;
	replay: () => Promise<void>;
	revoke: (request: Request, sessionId: string) => Promise<void>;
	revokeOthers: (request: Request) => Promise<void>;
	write: (request: Request) => Promise<{ written: true; workspaceId: string }>;
}

export function createAccountSessionAccess(deps: {
	auth: ProductAuth;
	auditLog: AuditLog;
	now?: () => Date;
	prisma: PrismaClient;
	secret: string;
	securityEventLog: SecurityEventLog;
	trustedOrigins: readonly string[];
}): AccountSessionAccess {
	const now = deps.now ?? (() => new Date());

	async function current(request: Request): Promise<ProductSession | null> {
		const session = await deps.auth.api.getSession({
			headers: request.headers,
			query: { disableCookieCache: true },
		});
		if (!session) {
			return null;
		}
		if (isPastAbsoluteLifetime(new Date(session.session.createdAt), now())) {
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
		const event = {
			accountAlias: identityAlias("account", input.accountId, deps.secret),
			actorAlias: identityAlias("account", input.actorId, deps.secret),
			id: crypto.randomUUID(),
			occurredAt: now().toISOString(),
			sessionAlias: identityAlias("session", input.sessionId, deps.secret),
			type: SESSION_REVOKED_EVENT_TYPE,
		};
		await deps.auditLog.append(event);
		await deps.securityEventLog.append(event);
	}

	return {
		current,
		async list(request) {
			const session = await requireSession(request);
			const listed = await deps.auth.api.listSessions({
				headers: request.headers,
			});
			return listed.map((item) => ({
				current: item.id === session.session.id,
				device: deviceFromUserAgent(item.userAgent),
				id: item.id,
				lastActivity: new Date(item.updatedAt).toISOString(),
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
			const listed = await deps.auth.api.listSessions({
				headers: request.headers,
			});
			const target = listed.find((item) => item.id === sessionId);
			if (!target || target.userId !== session.user.id) {
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
			const listed = await deps.auth.api.listSessions({
				headers: request.headers,
			});
			const others = listed.filter((item) => item.id !== session.session.id);
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
