import { describe, expect, it, vi } from "vitest";
import type { ProductAuth, ProductSession } from "./account-sessions";
import { createAccountSessionAccess } from "./account-sessions";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

const WEB_ORIGIN = "http://localhost:3001";
const SECRET = "test-secret-test-secret-test-secret-32";

function productSession(): ProductSession {
	return {
		session: {
			createdAt: new Date(),
			id: "session-current",
			token: "token-current",
			userId: "user-1",
		},
		user: { id: "user-1" },
	};
}

function productRequest() {
	return new Request("http://localhost:3000/account-access", {
		headers: {
			cookie: "better-auth.session_token=token-current",
			origin: WEB_ORIGIN,
		},
	});
}

function throwingGetSessionAuth(): ProductAuth {
	return {
		api: {
			getSession: () =>
				Promise.reject(
					Object.assign(new Error("Failed to get session"), {
						name: "APIError",
					})
				),
			listSessions: () =>
				Promise.reject(new Error("listSessions should not run")),
			revokeOtherSessions: () => Promise.resolve({ status: true }),
			revokeSession: () => Promise.resolve({ status: true }),
		},
	};
}

describe("Account session access", () => {
	it("treats a thrown session lookup as no product session", async () => {
		const access = createAccountSessionAccess({
			auditLog: { append: vi.fn(), list: async () => [] },
			auth: throwingGetSessionAuth(),
			prisma: {
				session: {
					deleteMany: vi.fn(),
					findFirst: vi.fn(),
					findMany: vi.fn(),
				},
			} as never,
			secret: SECRET,
			securityEventLog: {
				append: vi.fn(),
				list: async () => [],
				replay: async () => undefined,
			},
			trustedOrigins: [WEB_ORIGIN],
		});

		await expect(access.current(productRequest())).resolves.toBeNull();
		await expect(
			access.revoke(productRequest(), "session-current")
		).rejects.toMatchObject({
			status: 401,
		});
	});

	it("revokes without Better Auth listSessions when the lookup throws", async () => {
		const session = productSession();
		const deleted: string[] = [];
		const events: Array<{ type: string }> = [];
		const access = createAccountSessionAccess({
			auditLog: {
				append: (event) => {
					events.push(event);
					return Promise.resolve();
				},
				list: async () => [],
			},
			auth: {
				api: {
					getSession: ({ query }) => {
						if (!query?.disableRefresh) {
							return Promise.reject(
								Object.assign(new Error("Failed to get session"), {
									name: "APIError",
								})
							);
						}
						return Promise.resolve(session);
					},
					listSessions: () =>
						Promise.reject(new Error("listSessions unavailable")),
					revokeOtherSessions: () => Promise.resolve({ status: true }),
					revokeSession: () => Promise.resolve({ status: true }),
				},
			},
			prisma: {
				session: {
					deleteMany: ({ where }: { where: { id: string } }) => {
						deleted.push(where.id);
						return Promise.resolve({ count: 1 });
					},
					findFirst: () =>
						Promise.resolve({
							expiresAt: new Date(Date.now() + 60_000),
							id: "session-current",
							updatedAt: new Date(),
							userAgent: "Mozilla/5.0 (Macintosh) Test",
							userId: "user-1",
						}),
					findMany: vi.fn(),
				},
			} as never,
			secret: SECRET,
			securityEventLog: {
				append: (event) => {
					events.push(event);
					return Promise.resolve();
				},
				list: async () => [],
				replay: async () => undefined,
			},
			trustedOrigins: [WEB_ORIGIN],
		});

		await access.revoke(productRequest(), "session-current");

		expect(deleted).toEqual(["session-current"]);
		expect(events.map((event) => event.type)).toEqual([
			SESSION_REVOKED_EVENT_TYPE,
			SESSION_REVOKED_EVENT_TYPE,
		]);
	});
});
