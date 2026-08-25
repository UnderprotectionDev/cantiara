/**
 * Account Access seam — GitHub sign-in, Account, Workspace, Sessions,
 * revoke, lifetime, CSRF, revoke replay, GitHub outage waiting,
 * login OAuth revocation, and GitHub App uninstall independence.
 * Synthetic fixture for the sign-in and session slice of
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Hesap ve kişisel veri).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	AccountAccessError,
	CSRF_REJECTED_MESSAGE,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import { createPrismaAuditLog } from "./audit-log";
import { type CreateAuthOptions, createAuth } from "./create-auth";
import {
	getAccountAccessForUser,
	SIGN_IN_FAILED_MESSAGE,
	WORKSPACE_DEFAULT_NAME,
} from "./github-login";
import {
	SESSION_REVOKED_EVENT_TYPE,
	SESSION_SIGNED_IN_EVENT_TYPE,
	SESSION_SIGNED_OUT_EVENT_TYPE,
} from "./session-events";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const BASE_URL = "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3001";

interface GitHubProfile {
	email: string;
	id: number;
	login: string;
	name: string;
}

const BEARER_PREFIX = /^Bearer\s+/i;
const SCOPE_SEPARATOR = /[+\s]/;
const SESSION_COOKIE = /session_token/i;
const HTTP_ONLY = /httponly/i;
const SECURE_COOKIE = /secure/i;
const SAME_SITE_LAX = /samesite=lax/i;
const WORKSPACE_LEAK = /workspace/i;
const REPO_SCOPES = /repo|workflow|admin/;
const FOUNDER_EMAIL = "founder@example.com";
const HEX_ALIAS = /^[a-f0-9]{64}$/;
const MAC_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CantiaraTest";
const WINDOWS_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) CantiaraTest";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function installGitHubOAuthDouble(options: {
	onAppInstallationLookup?: () => void;
	profileForCode: (code: string) => GitHubProfile | "fail";
}) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url.startsWith("https://github.com/login/oauth/access_token")) {
			const body = await readFetchBody(input, init);
			const params = new URLSearchParams(body);
			const code = params.get("code") ?? "";
			if (options.profileForCode(code) === "fail") {
				return Response.json({ error: "bad_verification_code" });
			}
			return Response.json({
				access_token: `gho_${code}`,
				scope: "read:user,user:email",
				token_type: "bearer",
			});
		}
		if (url.startsWith("https://api.github.com/user/emails")) {
			const code = bearerToken(init).replace("gho_", "");
			const profile = options.profileForCode(code);
			if (profile === "fail") {
				return new Response("unauthorized", { status: 401 });
			}
			return Response.json([
				{ email: profile.email, primary: true, verified: true },
			]);
		}
		if (url.startsWith("https://api.github.com/user")) {
			const code = bearerToken(init).replace("gho_", "");
			const profile = options.profileForCode(code);
			if (profile === "fail") {
				return new Response("unauthorized", { status: 401 });
			}
			return Response.json({
				avatar_url: null,
				email: profile.email,
				id: profile.id,
				login: profile.login,
				name: profile.name,
			});
		}
		if (url === "https://api.github.com/" || url === "https://api.github.com") {
			return new Response(null, { status: 200 });
		}
		if (url.includes("/app/installations") || url.includes("/installation/")) {
			options.onAppInstallationLookup?.();
			return Response.json({ message: "Not Found" }, { status: 404 });
		}
		return originalFetch(input, init);
	};
	return () => {
		globalThis.fetch = originalFetch;
	};
}

function installGitHubDownDouble() {
	const inner = globalThis.fetch;
	globalThis.fetch = (input, init) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url.includes("github.com")) {
			return Promise.reject(new Error("GitHub unavailable"));
		}
		return inner(input, init);
	};
	return () => {
		globalThis.fetch = inner;
	};
}

function bearerToken(init?: RequestInit): string {
	return (
		new Headers(init?.headers)
			.get("authorization")
			?.replace(BEARER_PREFIX, "") ?? ""
	);
}

async function readFetchBody(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<string> {
	if (typeof init?.body === "string") {
		return init.body;
	}
	if (init?.body instanceof URLSearchParams) {
		return init.body.toString();
	}
	if (input instanceof Request) {
		return await input.clone().text();
	}
	return "";
}

function cookieJar() {
	const jar = new Map<string, string>();
	return {
		apply(response: Response) {
			for (const header of response.headers.getSetCookie()) {
				const [pair] = header.split(";", 1);
				if (!pair) {
					continue;
				}
				const eq = pair.indexOf("=");
				if (eq === -1) {
					continue;
				}
				jar.set(pair.slice(0, eq), pair.slice(eq + 1));
			}
		},
		header() {
			return [...jar.entries()]
				.map(([name, value]) => `${name}=${value}`)
				.join("; ");
		},
	};
}

async function startGitHubSignIn(
	handler: (request: Request) => Promise<Response>,
	cookies: ReturnType<typeof cookieJar>,
	ip = "203.0.113.10",
	callbackURL = `${WEB_ORIGIN}/dashboard`
) {
	const response = await handler(
		new Request(`${BASE_URL}/api/auth/sign-in/social`, {
			body: JSON.stringify({
				callbackURL,
				provider: "github",
			}),
			headers: {
				"content-type": "application/json",
				cookie: cookies.header(),
				origin: WEB_ORIGIN,
				"x-forwarded-for": ip,
			},
			method: "POST",
		})
	);
	cookies.apply(response);
	return response;
}

async function completeGitHubCallback(
	handler: (request: Request) => Promise<Response>,
	cookies: ReturnType<typeof cookieJar>,
	input: { code: string; state: string; ip?: string; userAgent?: string }
) {
	const url = new URL(`${BASE_URL}/api/auth/callback/github`);
	url.searchParams.set("code", input.code);
	url.searchParams.set("state", input.state);
	const headers: Record<string, string> = {
		cookie: cookies.header(),
		origin: WEB_ORIGIN,
		"x-forwarded-for": input.ip ?? "203.0.113.10",
	};
	if (input.userAgent) {
		headers["user-agent"] = input.userAgent;
	}
	const response = await handler(
		new Request(url, {
			headers,
		})
	);
	cookies.apply(response);
	return response;
}

function productRequest(
	cookies: ReturnType<typeof cookieJar>,
	input: { origin?: string | null; userAgent?: string } = {}
) {
	const headers = new Headers({
		cookie: cookies.header(),
	});
	if (input.origin !== null) {
		headers.set("origin", input.origin ?? WEB_ORIGIN);
	}
	if (input.userAgent) {
		headers.set("user-agent", input.userAgent);
	}
	return new Request(`${BASE_URL}/account-access`, { headers });
}

function authorizationState(authorizeUrl: string): string {
	const state = new URL(authorizeUrl).searchParams.get("state");
	if (!state) {
		throw new Error("GitHub authorization URL is missing state");
	}
	return state;
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
	try {
		return (await response.clone().json()) as Record<string, unknown>;
	} catch {
		return { raw: await response.clone().text() };
	}
}

describe("Account Access", () => {
	let prisma: PrismaClient;
	let pool: Pool;
	const founder: GitHubProfile = {
		email: "founder@example.com",
		id: 4242,
		login: "founder",
		name: "Founder",
	};

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
		await prisma.auditEvent.deleteMany();
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	function createAccess(overrides: Partial<CreateAuthOptions> = {}) {
		return createAuth({
			baseURL: BASE_URL,
			github: {
				clientId: "test-github-client-id",
				clientSecret: "test-github-client-secret",
			},
			prisma,
			rateLimit: {
				maxAttempts: 3,
				windowMs: 60_000,
			},
			secret: "test-secret-test-secret-test-secret-32",
			trustedOrigins: [WEB_ORIGIN],
			...overrides,
		});
	}

	it("creates an Account and one Workspace on the first GitHub sign-in", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();

		const start = await startGitHubSignIn(auth.handler, cookies);
		const payload = await jsonBody(start);
		expect(start.ok).toBe(true);
		expect(typeof payload.url).toBe("string");
		const authorizeUrl = String(payload.url);
		expect(authorizeUrl).toContain("github.com/login/oauth/authorize");

		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-first",
			state: authorizationState(authorizeUrl),
		});
		expect(callback.status).toBeLessThan(400);

		const session = await auth.api.getSession({
			headers: new Headers({ cookie: cookies.header() }),
		});
		expect(session?.user.email).toBe(founder.email);

		const access = await getAccountAccessForUser(
			prisma,
			session?.user.id ?? ""
		);
		expect(access).toMatchObject({
			githubUserId: String(founder.id),
			workspaceName: WORKSPACE_DEFAULT_NAME,
		});
		expect(await prisma.workspace.count()).toBe(1);
		restore();
	});

	it("returns to the web app dashboard after GitHub sign-in, not the auth origin", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			"/dashboard"
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-dashboard",
			state: authorizationState(String((await jsonBody(start)).url)),
		});
		const location = callback.headers.get("location") ?? "";
		expect(location).toBe(`${WEB_ORIGIN}/dashboard`);
		expect(location).not.toContain(new URL(BASE_URL).host);
		restore();
	});

	it("returns to Sessions after GitHub sign-in when that is the callback", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			"/sessions"
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-sessions",
			state: authorizationState(String((await jsonBody(start)).url)),
		});
		expect(callback.headers.get("location")).toBe(`${WEB_ORIGIN}/sessions`);
		restore();
	});

	it("reuses the same Account and Workspace on a later GitHub sign-in", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();

		const firstCookies = cookieJar();
		const firstStart = await startGitHubSignIn(auth.handler, firstCookies);
		await completeGitHubCallback(auth.handler, firstCookies, {
			code: "founder-first",
			state: authorizationState(String((await jsonBody(firstStart)).url)),
		});
		const firstSession = await auth.api.getSession({
			headers: new Headers({ cookie: firstCookies.header() }),
		});
		const firstAccess = await getAccountAccessForUser(
			prisma,
			firstSession?.user.id ?? ""
		);

		const secondCookies = cookieJar();
		const secondStart = await startGitHubSignIn(
			auth.handler,
			secondCookies,
			"198.51.100.20"
		);
		await completeGitHubCallback(auth.handler, secondCookies, {
			code: "founder-again",
			ip: "198.51.100.20",
			state: authorizationState(String((await jsonBody(secondStart)).url)),
		});
		const secondSession = await auth.api.getSession({
			headers: new Headers({ cookie: secondCookies.header() }),
		});
		const secondAccess = await getAccountAccessForUser(
			prisma,
			secondSession?.user.id ?? ""
		);

		expect(secondAccess?.accountId).toBe(firstAccess?.accountId);
		expect(secondAccess?.workspaceId).toBe(firstAccess?.workspaceId);
		expect(await prisma.workspace.count()).toBe(1);
		expect(await prisma.user.count()).toBe(1);
		restore();
	});

	it("does not expose email and password sign-in", async () => {
		const auth = createAccess();
		const response = await auth.handler(
			new Request(`${BASE_URL}/api/auth/sign-in/email`, {
				body: JSON.stringify({
					email: "founder@example.com",
					password: "not-a-product-password",
				}),
				headers: {
					"content-type": "application/json",
					origin: WEB_ORIGIN,
				},
				method: "POST",
			})
		);
		expect(response.status).toBeGreaterThanOrEqual(400);
		const sessionCookies = response.headers
			.getSetCookie()
			.filter((header) => SESSION_COOKIE.test(header));
		expect(sessionCookies).toHaveLength(0);
	});

	it("requests only GitHub identity scopes and not repository scopes", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const start = await startGitHubSignIn(auth.handler, cookieJar());
		const authorizeUrl = new URL(String((await jsonBody(start)).url));
		const scopes = (authorizeUrl.searchParams.get("scope") ?? "")
			.split(SCOPE_SEPARATOR)
			.filter(Boolean)
			.sort();
		expect(scopes).toEqual(["read:user", "user:email"]);
		expect(scopes.join(" ")).not.toMatch(REPO_SCOPES);
		restore();
	});

	it("hides whether an Account or Workspace exists when GitHub sign-in fails", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: (code) => (code === "fail" ? "fail" : founder),
		});
		const auth = createAccess();

		const unknownCookies = cookieJar();
		const unknownStart = await startGitHubSignIn(auth.handler, unknownCookies);
		const unknownFailure = await completeGitHubCallback(
			auth.handler,
			unknownCookies,
			{
				code: "fail",
				state: authorizationState(String((await jsonBody(unknownStart)).url)),
			}
		);

		const admittedCookies = cookieJar();
		const admittedStart = await startGitHubSignIn(
			auth.handler,
			admittedCookies,
			"198.51.100.8"
		);
		await completeGitHubCallback(auth.handler, admittedCookies, {
			code: "founder-first",
			ip: "198.51.100.8",
			state: authorizationState(String((await jsonBody(admittedStart)).url)),
		});

		const knownCookies = cookieJar();
		const knownStart = await startGitHubSignIn(
			auth.handler,
			knownCookies,
			"198.51.100.9"
		);
		const knownFailure = await completeGitHubCallback(
			auth.handler,
			knownCookies,
			{
				code: "fail",
				ip: "198.51.100.9",
				state: authorizationState(String((await jsonBody(knownStart)).url)),
			}
		);

		const unknownBody = await jsonBody(unknownFailure);
		const knownBody = await jsonBody(knownFailure);
		expect(unknownFailure.status).toBe(knownFailure.status);
		expect(unknownBody).toEqual(knownBody);
		expect(unknownBody.message).toBe(SIGN_IN_FAILED_MESSAGE);
		expect(JSON.stringify(unknownBody)).not.toMatch(WORKSPACE_LEAK);
		expect(JSON.stringify(unknownBody)).not.toContain(FOUNDER_EMAIL);
		restore();
	});

	it("sets the web session cookie as Secure, HttpOnly, and SameSite=Lax", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(auth.handler, cookies);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-first",
			state: authorizationState(String((await jsonBody(start)).url)),
		});
		const sessionCookie = callback.headers
			.getSetCookie()
			.find((header) => SESSION_COOKIE.test(header));
		expect(sessionCookie).toBeDefined();
		expect(sessionCookie).toMatch(HTTP_ONLY);
		expect(sessionCookie).toMatch(SECURE_COOKIE);
		expect(sessionCookie).toMatch(SAME_SITE_LAX);
		restore();
	});

	it("rate limits GitHub sign-in start by IP", async () => {
		const auth = createAccess();
		const cookies = cookieJar();
		const ip = "203.0.113.99";
		const responses: Response[] = [
			await startGitHubSignIn(auth.handler, cookies, ip),
			await startGitHubSignIn(auth.handler, cookies, ip),
			await startGitHubSignIn(auth.handler, cookies, ip),
			await startGitHubSignIn(auth.handler, cookies, ip),
		];
		const limited = responses.at(3);
		expect(limited?.status).toBe(429);
		expect((await jsonBody(limited as Response)).message).toBe(
			SIGN_IN_FAILED_MESSAGE
		);
	});

	it("rejects an authorized write without a session cookie", async () => {
		const auth = createAccess();
		await expect(
			auth.accountAccess.write(
				new Request(`${BASE_URL}/account-access`, {
					headers: { origin: WEB_ORIGIN },
				})
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
	});

	it("keeps Hesap identity and a valid product session when the GitHub App is uninstalled", async () => {
		let installationLookups = 0;
		const restore = installGitHubOAuthDouble({
			onAppInstallationLookup: () => {
				installationLookups += 1;
			},
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-app-uninstalled",
			userAgent: MAC_USER_AGENT,
		});
		const signedIn = await auth.api.getSession({
			headers: new Headers({ cookie: cookies.header() }),
		});
		const before = await getAccountAccessForUser(
			prisma,
			signedIn?.user.id ?? ""
		);
		expect(before?.githubUserId).toBe(String(founder.id));

		await auth.accountAccess.applyGitHubAppUninstalled({
			githubUserId: String(founder.id),
			installationId: "inst-uninstalled",
		});

		expect(
			(await auth.accountAccess.current(productRequest(cookies)))?.session.id
		).toBe(signedIn?.session.id);
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).resolves.toMatchObject({ written: true });
		expect(
			await getAccountAccessForUser(prisma, signedIn?.user.id ?? "")
		).toEqual(before);
		expect(installationLookups).toBe(0);
		restore();
	});

	it("keeps a valid session when GitHub is down and does not extend it", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-github-down",
			userAgent: MAC_USER_AGENT,
		});
		const before = await auth.accountAccess.current(productRequest(cookies));
		expect(before).toBeTruthy();
		const staleExpiresAt = new Date(Date.now() + TWELVE_HOURS_MS - 120_000);
		await prisma.session.update({
			data: { expiresAt: staleExpiresAt },
			where: { id: before?.session.id ?? "" },
		});
		const restoreDown = installGitHubDownDouble();
		try {
			const after = await auth.accountAccess.current(productRequest(cookies));
			expect(after?.session.id).toBe(before?.session.id);
			await expect(
				auth.accountAccess.write(productRequest(cookies))
			).resolves.toMatchObject({ written: true });
			const sessionResponse = await auth.handler(
				new Request(`${BASE_URL}/api/auth/get-session`, {
					headers: {
						cookie: cookies.header(),
						origin: WEB_ORIGIN,
					},
				})
			);
			expect(sessionResponse.ok).toBe(true);
			const payload = await jsonBody(sessionResponse);
			const session = payload.session as { expiresAt?: string } | undefined;
			expect(new Date(session?.expiresAt ?? 0).getTime()).toBe(
				staleExpiresAt.getTime()
			);
			const still = await auth.accountAccess.current(productRequest(cookies));
			expect(new Date(still?.session.expiresAt ?? 0).getTime()).toBe(
				staleExpiresAt.getTime()
			);
		} finally {
			restoreDown();
			restore();
		}
	});

	it("waits visibly on a new GitHub sign-in when GitHub is down", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const restoreDown = installGitHubDownDouble();
		try {
			const auth = createAccess();
			const start = await startGitHubSignIn(auth.handler, cookieJar());
			expect(start.status).toBe(503);
			expect(await jsonBody(start)).toEqual({
				message: "Waiting for GitHub",
				status: "waiting",
			});
			expect(await auth.accountAccess.githubAvailability()).toBe("waiting");
		} finally {
			restoreDown();
			restore();
		}
	});

	it("waits on Confirm GitHub Identity and does not consume a high-risk grant when GitHub is down", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-wait",
			userAgent: MAC_USER_AGENT,
		});
		const restoreDown = installGitHubDownDouble();
		try {
			const started = await auth.accountAccess.confirmGitHubIdentity(
				productRequest(cookies)
			);
			expect(started).toEqual({
				message: "Waiting for GitHub",
				status: "waiting",
			});
			await expect(
				auth.accountAccess.consumeConfirmGitHubIdentityGrant(
					productRequest(cookies),
					"account-closure-start"
				)
			).rejects.toMatchObject({
				message: "Waiting for GitHub",
				status: 503,
			});
			await expect(
				auth.accountAccess.write(productRequest(cookies))
			).resolves.toMatchObject({ written: true });
		} finally {
			restoreDown();
			restore();
		}
	});

	it("revokes a product session while GitHub is down", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-revoke-down",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-revoke-down-other",
			ip: "198.51.100.26",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const otherId = listed.find((session) => !session.current)?.id ?? "";
		const restoreDown = installGitHubDownDouble();
		try {
			await auth.accountAccess.revoke(productRequest(current), otherId);
			await expect(
				auth.accountAccess.write(productRequest(other))
			).rejects.toMatchObject({
				message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
				status: 401,
			});
			await expect(
				auth.accountAccess.write(productRequest(current))
			).resolves.toMatchObject({ written: true });
		} finally {
			restoreDown();
			restore();
		}
	});

	it("ends every product session when GitHub login OAuth is revoked and the next sign-in asks for consent", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-login-revoked",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-login-revoked-other",
			ip: "198.51.100.27",
			userAgent: WINDOWS_USER_AGENT,
		});
		const signedIn = await auth.api.getSession({
			headers: new Headers({ cookie: current.header() }),
		});
		const before = await getAccountAccessForUser(
			prisma,
			signedIn?.user.id ?? ""
		);
		expect(before?.githubUserId).toBe(String(founder.id));

		await auth.accountAccess.applyGitHubLoginOAuthRevoked(String(founder.id));

		await expect(
			auth.accountAccess.write(productRequest(current))
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await expect(
			auth.accountAccess.write(productRequest(other))
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});

		const nextCookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			nextCookies,
			"198.51.100.28"
		);
		const payload = await jsonBody(start);
		expect(start.ok).toBe(true);
		expect(String(payload.url)).toContain("github.com/login/oauth/authorize");
		const callback = await completeGitHubCallback(auth.handler, nextCookies, {
			code: "founder-login-revoked-again",
			ip: "198.51.100.28",
			state: authorizationState(String(payload.url)),
		});
		expect(callback.status).toBeGreaterThanOrEqual(300);
		expect(callback.status).toBeLessThan(400);
		const signedInAgain = await auth.api.getSession({
			headers: new Headers({ cookie: nextCookies.header() }),
		});
		const after = await getAccountAccessForUser(
			prisma,
			signedInAgain?.user.id ?? ""
		);
		expect(after).toEqual(before);
		await expect(
			auth.accountAccess.write(productRequest(nextCookies))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	async function signInDevice(
		auth: ReturnType<typeof createAccess>,
		input: { code: string; ip?: string; userAgent: string }
	) {
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			input.ip ?? "203.0.113.10"
		);
		await completeGitHubCallback(auth.handler, cookies, {
			code: input.code,
			ip: input.ip,
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: input.userAgent,
		});
		return cookies;
	}

	it("lists Sessions with device and last activity and without the session token", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const mac = await signInDevice(auth, {
			code: "founder-mac",
			userAgent: MAC_USER_AGENT,
		});
		const windows = await signInDevice(auth, {
			code: "founder-windows",
			ip: "198.51.100.20",
			userAgent: WINDOWS_USER_AGENT,
		});

		const listed = await auth.accountAccess.list(productRequest(mac));
		const tokens = await prisma.session.findMany({ select: { token: true } });

		expect(listed).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					current: true,
					device: "Mac",
				}),
				expect.objectContaining({
					current: false,
					device: "Windows",
				}),
			])
		);
		expect(listed).toHaveLength(2);
		for (const session of listed) {
			expect(session).not.toHaveProperty("token");
			expect(Number.isNaN(Date.parse(session.lastActivity))).toBe(false);
		}
		expect(JSON.stringify(listed)).not.toContain(tokens[0]?.token);
		expect(JSON.stringify(listed)).not.toContain(tokens[1]?.token);
		expect(windows.header()).toBeTruthy();
		restore();
	});

	it("ends this product session when Revoke Session targets the current session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-self",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-self-other",
			ip: "198.51.100.25",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const currentId = listed.find((session) => session.current)?.id;
		expect(currentId).toBeDefined();

		await auth.accountAccess.revoke(productRequest(current), currentId ?? "");

		await expect(
			auth.accountAccess.write(productRequest(current))
		).rejects.toMatchObject({
			message: "Unauthorized",
			status: 401,
		});
		await expect(
			auth.accountAccess.write(productRequest(other))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("keeps this product session when the Denetim kaydı cannot be written", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess({
			auditLog: {
				append: (event) => {
					if (event.type === SESSION_REVOKED_EVENT_TYPE) {
						return Promise.reject(new Error("audit unavailable"));
					}
					return Promise.resolve();
				},
				list: () => Promise.resolve([]),
			},
		});
		const current = await signInDevice(auth, {
			code: "founder-audit-fail",
			userAgent: MAC_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const currentId = listed.find((session) => session.current)?.id;
		expect(currentId).toBeDefined();

		await expect(
			auth.accountAccess.revoke(productRequest(current), currentId ?? "")
		).rejects.toThrow("audit unavailable");
		await expect(
			auth.accountAccess.write(productRequest(current))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("records a Prisma Denetim kaydı when Revoke Session succeeds", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		await prisma.auditEvent.deleteMany();
		const auth = createAccess({
			auditLog: createPrismaAuditLog(prisma),
		});
		const current = await signInDevice(auth, {
			code: "founder-prisma-audit",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-prisma-audit-other",
			ip: "198.51.100.26",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const otherId = listed.find((session) => !session.current)?.id;
		expect(otherId).toBeDefined();

		await auth.accountAccess.revoke(productRequest(current), otherId ?? "");

		const events = await prisma.auditEvent.findMany();
		expect(
			events.filter((event) => event.type === SESSION_SIGNED_IN_EVENT_TYPE)
		).toHaveLength(2);
		expect(
			events.filter((event) => event.type === SESSION_REVOKED_EVENT_TYPE)
		).toHaveLength(1);
		await expect(
			auth.accountAccess.write(productRequest(other))
		).rejects.toMatchObject({ status: 401 });
		restore();
	});

	it("rejects writes from a revoked session while the other session still writes", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-current",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-other",
			ip: "198.51.100.21",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const otherId = listed.find((session) => !session.current)?.id;
		expect(otherId).toBeDefined();

		await auth.accountAccess.revoke(productRequest(current), otherId ?? "");

		await expect(
			auth.accountAccess.write(productRequest(other))
		).rejects.toMatchObject({
			message: "Unauthorized",
			status: 401,
		});
		await expect(
			auth.accountAccess.write(productRequest(current))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("keeps the current session writing after Revoke Other Sessions", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-keep",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-drop",
			ip: "198.51.100.22",
			userAgent: WINDOWS_USER_AGENT,
		});

		await auth.accountAccess.revokeOthers(productRequest(current));

		await expect(
			auth.accountAccess.write(productRequest(other))
		).rejects.toBeInstanceOf(AccountAccessError);
		await expect(
			auth.accountAccess.write(productRequest(current))
		).resolves.toMatchObject({ written: true });
		const remaining = await auth.accountAccess.list(productRequest(current));
		expect(remaining).toEqual([
			expect.objectContaining({ current: true, device: "Mac" }),
		]);
		restore();
	});

	it("does not apply cookie session writes without CSRF origin", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-csrf",
			userAgent: MAC_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(cookies));

		await expect(
			auth.accountAccess.write(productRequest(cookies, { origin: null }))
		).rejects.toMatchObject({
			message: CSRF_REJECTED_MESSAGE,
			status: 403,
		});
		await expect(
			auth.accountAccess.write(
				productRequest(cookies, { origin: "https://evil.example" })
			)
		).rejects.toMatchObject({
			message: CSRF_REJECTED_MESSAGE,
			status: 403,
		});
		await expect(
			auth.accountAccess.revoke(
				productRequest(cookies, { origin: null }),
				listed[0]?.id ?? ""
			)
		).rejects.toMatchObject({ status: 403 });
		restore();
	});

	it("ends a session after 12 hours of inactivity", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = { now: new Date() };
		const auth = createAccess({
			now: () => new Date(clock.now.getTime()),
		});
		const cookies = await signInDevice(auth, {
			code: "founder-idle",
			userAgent: MAC_USER_AGENT,
		});
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: cookies.header() }),
		});
		expect(session).toBeTruthy();
		const remaining =
			new Date(session?.session.expiresAt ?? 0).getTime() - Date.now();
		expect(remaining).toBeGreaterThan(TWELVE_HOURS_MS - 120_000);
		expect(remaining).toBeLessThanOrEqual(TWELVE_HOURS_MS + 120_000);

		clock.now = new Date(
			new Date(session?.session.expiresAt ?? 0).getTime() + 1000
		);

		expect(
			await auth.accountAccess.current(productRequest(cookies))
		).toBeNull();
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).rejects.toMatchObject({ status: 401 });
		restore();
	});

	it("ends a session 30 days after creation even when idle expiry is still ahead", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = { now: new Date() };
		const auth = createAccess({
			now: () => new Date(clock.now.getTime()),
		});
		const cookies = await signInDevice(auth, {
			code: "founder-absolute",
			userAgent: MAC_USER_AGENT,
		});
		const session = await auth.accountAccess.current(productRequest(cookies));
		expect(session).toBeTruthy();
		const createdAt = new Date(session?.session.createdAt ?? 0);
		clock.now = new Date(createdAt.getTime() + THIRTY_DAYS_MS + 1000);
		await prisma.session.update({
			data: {
				expiresAt: new Date(clock.now.getTime() + TWELVE_HOURS_MS),
			},
			where: { id: session?.session.id ?? "" },
		});

		expect(
			await auth.accountAccess.current(productRequest(cookies))
		).toBeNull();
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).rejects.toMatchObject({ status: 401 });
		restore();
	});

	it("records a secret-free Denetim kaydı for revoke", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-audit",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-audit-other",
			ip: "198.51.100.23",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const otherSession = listed.find((session) => !session.current);
		const row = await prisma.session.findUniqueOrThrow({
			where: { id: otherSession?.id ?? "" },
		});
		const actor = await auth.api.getSession({
			headers: new Headers({ cookie: current.header() }),
		});

		await auth.accountAccess.revoke(
			productRequest(current),
			otherSession?.id ?? ""
		);

		const events = await auth.auditLog.list();
		const securityEvents = await auth.securityEventLog.list();
		const revoked = events.filter(
			(event) => event.type === SESSION_REVOKED_EVENT_TYPE
		);
		expect(
			events.filter((event) => event.type === SESSION_SIGNED_IN_EVENT_TYPE)
		).toHaveLength(2);
		expect(
			events.filter((event) => event.type === SESSION_SIGNED_OUT_EVENT_TYPE)
		).toHaveLength(0);
		expect(revoked).toHaveLength(1);
		expect(securityEvents).toEqual(revoked);
		expect(revoked[0]?.accountAlias).toMatch(HEX_ALIAS);
		expect(revoked[0]?.actorAlias).toBe(revoked[0]?.accountAlias);
		expect(revoked[0]?.sessionAlias).toMatch(HEX_ALIAS);
		expect(Number.isNaN(Date.parse(revoked[0]?.occurredAt ?? ""))).toBe(false);
		const serialized = JSON.stringify({ events, securityEvents });
		expect(serialized).not.toContain(row.token);
		expect(serialized).not.toContain(actor?.user.id ?? "missing-id");
		expect(serialized).not.toContain(FOUNDER_EMAIL);
		expect(other.header()).toBeTruthy();
		restore();
	});

	it("replays a session revoke so a restored live row stays unauthorized", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const current = await signInDevice(auth, {
			code: "founder-replay",
			userAgent: MAC_USER_AGENT,
		});
		const other = await signInDevice(auth, {
			code: "founder-replay-other",
			ip: "198.51.100.24",
			userAgent: WINDOWS_USER_AGENT,
		});
		const listed = await auth.accountAccess.list(productRequest(current));
		const otherId = listed.find((session) => !session.current)?.id ?? "";
		const snapshot = await prisma.session.findUniqueOrThrow({
			where: { id: otherId },
		});

		await auth.accountAccess.revoke(productRequest(current), otherId);
		await prisma.session.create({
			data: {
				createdAt: snapshot.createdAt,
				expiresAt: snapshot.expiresAt,
				id: snapshot.id,
				ipAddress: snapshot.ipAddress,
				token: snapshot.token,
				updatedAt: snapshot.updatedAt,
				userAgent: snapshot.userAgent,
				userId: snapshot.userId,
			},
		});

		expect(
			await prisma.session.findUnique({ where: { id: otherId } })
		).toMatchObject({ id: otherId, token: snapshot.token });
		await expect(
			auth.accountAccess.write(productRequest(other))
		).resolves.toMatchObject({ written: true });

		await auth.accountAccess.replay();

		await expect(
			auth.accountAccess.write(productRequest(other))
		).rejects.toMatchObject({ status: 401 });
		await expect(
			auth.accountAccess.write(productRequest(current))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("records a Denetim kaydı for GitHub sign-in and not a security-event", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-signed-in-audit",
			userAgent: MAC_USER_AGENT,
		});
		const events = await auth.auditLog.list();
		expect(events).toEqual([
			expect.objectContaining({ type: SESSION_SIGNED_IN_EVENT_TYPE }),
		]);
		expect(events[0]?.accountAlias).toMatch(HEX_ALIAS);
		expect(events[0]?.sessionAlias).toMatch(HEX_ALIAS);
		expect(await auth.securityEventLog.list()).toEqual([]);
		expect(cookies.header()).toBeTruthy();
		restore();
	});

	it("records a Denetim kaydı for Sign Out and not a security-event", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-signed-out-audit",
			userAgent: MAC_USER_AGENT,
		});
		const response = await auth.handler(
			new Request(`${BASE_URL}/api/auth/sign-out`, {
				headers: {
					cookie: cookies.header(),
					origin: WEB_ORIGIN,
				},
				method: "POST",
			})
		);
		expect(response.ok).toBe(true);
		const events = await auth.auditLog.list();
		expect(
			events.filter((event) => event.type === SESSION_SIGNED_IN_EVENT_TYPE)
		).toHaveLength(1);
		expect(
			events.filter((event) => event.type === SESSION_SIGNED_OUT_EVENT_TYPE)
		).toHaveLength(1);
		expect(
			events.filter((event) => event.type === SESSION_REVOKED_EVENT_TYPE)
		).toHaveLength(0);
		expect(await auth.securityEventLog.list()).toEqual([]);
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).rejects.toMatchObject({ status: 401 });
		restore();
	});
});
