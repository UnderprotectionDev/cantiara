/**
 * Account Access seam — GitHub sign-in, Account, Workspace, Sessions,
 * revoke, lifetime, CSRF, revoke replay, GitHub outage waiting,
 * login OAuth revocation, GitHub App uninstall independence,
 * Tauri one-time code / bearer, and Confirm GitHub Identity start,
 * callback, grant mint, and single-use consume.
 * Synthetic fixture for the sign-in, session, and confirmation slice of
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Hesap ve kişisel veri).
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
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
	CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
	CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE,
	SESSION_REVOKED_EVENT_TYPE,
	SESSION_SIGNED_IN_EVENT_TYPE,
	SESSION_SIGNED_OUT_EVENT_TYPE,
} from "./session-events";
import {
	allowProductCorsOrigin,
	isClipperExtensionOrigin,
	oneTimeCodeFromDeepLink,
	productCorsOrigins,
	productTrustedOrigins,
	TAURI_CALLBACK_URL,
} from "./tauri-session";
import { WEB_SIGN_IN_CODE_PARAM } from "./web-sign-in-code";

const DATABASE_URL = localTestDatabaseUrl();

const BASE_URL = "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3001";
const LOOPBACK_WEB_ORIGIN = "http://127.0.0.1:3001";

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
const TAURI_ONE_TIME_CODE = /^[A-Za-z0-9_-]{32,}$/;
const PKCE_CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,}$/;
const MAC_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CantiaraTest";
const WINDOWS_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) CantiaraTest";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

function installGitHubOAuthDouble(options: {
	confirmationCodeChallenge?: () => string | undefined;
	isAccessTokenRevoked?: (token: string) => boolean;
	profileForCode: (code: string) => GitHubProfile | "fail";
}) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url.startsWith("https://github.com/login/oauth/access_token")) {
			const body = await readFetchBody(input, init);
			const params = new URLSearchParams(body);
			const code = params.get("code") ?? "";
			const redirectUri = params.get("redirect_uri") ?? "";
			if (redirectUri.includes("confirm-github-identity")) {
				const verifier = params.get("code_verifier") ?? "";
				const expectedChallenge = options.confirmationCodeChallenge?.();
				if (
					!(
						verifier &&
						(!expectedChallenge ||
							pkceChallenge(verifier) === expectedChallenge)
					)
				) {
					return Response.json({ error: "invalid_grant" });
				}
			}
			if (options.profileForCode(code) === "fail") {
				return Response.json({ error: "bad_verification_code" });
			}
			return Response.json({
				access_token: `gho_${code}`,
				scope: "read:user,user:email",
				token_type: "bearer",
			});
		}
		if (url.startsWith("https://api.github.com/user")) {
			const token = bearerToken(init);
			if (options.isAccessTokenRevoked?.(token)) {
				return new Response("unauthorized", { status: 401 });
			}
			const code = token.replace("gho_", "");
			const profile = options.profileForCode(code);
			if (profile === "fail") {
				return new Response("unauthorized", { status: 401 });
			}
			if (url.startsWith("https://api.github.com/user/emails")) {
				return Response.json([
					{ email: profile.email, primary: true, verified: true },
				]);
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
			throw new Error(
				"GitHub App installation must not be consulted for login"
			);
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
	callbackURL = `${WEB_ORIGIN}/dashboard`,
	origin = WEB_ORIGIN
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
				origin,
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
	input: {
		code: string;
		origin?: string;
		state: string;
		ip?: string;
		userAgent?: string;
	}
) {
	const url = new URL(`${BASE_URL}/api/auth/callback/github`);
	url.searchParams.set("code", input.code);
	url.searchParams.set("state", input.state);
	const headers: Record<string, string> = {
		cookie: cookies.header(),
		origin: input.origin ?? WEB_ORIGIN,
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

function bearerProductRequest(
	token: string,
	input: { origin?: string | null; userAgent?: string } = {}
) {
	const headers = new Headers({
		authorization: `Bearer ${token}`,
	});
	if (input.origin !== null && input.origin !== undefined) {
		headers.set("origin", input.origin);
	}
	if (input.userAgent) {
		headers.set("user-agent", input.userAgent);
	}
	return new Request(`${BASE_URL}/account-access`, { headers });
}

async function exchangeTauriCode(
	handler: (request: Request) => Promise<Response>,
	input: { code: string; ip?: string; userAgent?: string }
) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		"x-forwarded-for": input.ip ?? "203.0.113.10",
	};
	if (input.userAgent) {
		headers["user-agent"] = input.userAgent;
	}
	return await handler(
		new Request(`${BASE_URL}/api/auth/tauri/exchange`, {
			body: JSON.stringify({ code: input.code }),
			headers,
			method: "POST",
		})
	);
}

function authorizationState(authorizeUrl: string): string {
	const state = new URL(authorizeUrl).searchParams.get("state");
	if (!state) {
		throw new Error("GitHub authorization URL is missing state");
	}
	return state;
}

function confirmAuthorizeUrl(started: { status?: string; url?: string }): URL {
	if (started.status !== "redirect" || typeof started.url !== "string") {
		throw new Error("Confirm GitHub Identity did not start a GitHub tour");
	}
	return new URL(started.url);
}

function createTestClock(start = Date.now()) {
	let current = start;
	return {
		advanceMs(ms: number) {
			current += ms;
		},
		now() {
			return new Date(current);
		},
	};
}

function otherFounder(): GitHubProfile {
	return {
		email: "other@example.com",
		id: 7777,
		login: "other",
		name: "Other",
	};
}

function pkceChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
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
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
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
			trustedOrigins: productTrustedOrigins(WEB_ORIGIN),
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

	it("does not treat a GitHub-less Account as a signed-in founder session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-without-github",
			userAgent: MAC_USER_AGENT,
		});
		await prisma.account.deleteMany({ where: { providerId: "github" } });
		expect(
			await auth.accountAccess.current(productRequest(cookies))
		).toBeNull();
		const sessionResponse = await auth.handler(
			new Request(`${BASE_URL}/api/auth/get-session`, {
				headers: {
					cookie: cookies.header(),
					origin: WEB_ORIGIN,
				},
			})
		);
		expect(await sessionResponse.json()).toBeNull();
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("hands the web app a one-time code when GitHub returns on a different hostname", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const startCookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			startCookies,
			"203.0.113.10",
			`${LOOPBACK_WEB_ORIGIN}/dashboard`,
			LOOPBACK_WEB_ORIGIN
		);
		const callback = await completeGitHubCallback(auth.handler, startCookies, {
			code: "founder-loopback",
			origin: LOOPBACK_WEB_ORIGIN,
			state: authorizationState(String((await jsonBody(start)).url)),
		});
		const location = callback.headers.get("location") ?? "";
		expect(location.startsWith(`${LOOPBACK_WEB_ORIGIN}/login?`)).toBe(true);
		const returned = new URL(location);
		expect([...returned.searchParams.keys()]).toEqual([WEB_SIGN_IN_CODE_PARAM]);
		const code = returned.searchParams.get(WEB_SIGN_IN_CODE_PARAM);
		expect(code).toMatch(TAURI_ONE_TIME_CODE);
		expect(
			callback.headers
				.getSetCookie()
				.filter((header) => SESSION_COOKIE.test(header))
		).toHaveLength(0);

		const exchanged = await auth.handler(
			new Request(`${BASE_URL}/api/auth/web/exchange`, {
				body: JSON.stringify({ code }),
				headers: {
					"content-type": "application/json",
					origin: LOOPBACK_WEB_ORIGIN,
				},
				method: "POST",
			})
		);
		expect(exchanged.ok).toBe(true);
		const webCookies = cookieJar();
		webCookies.apply(exchanged);
		expect(
			exchanged.headers
				.getSetCookie()
				.filter((header) => SESSION_COOKIE.test(header)).length
		).toBeGreaterThan(0);
		const session = await auth.accountAccess.current(
			productRequest(webCookies, { origin: LOOPBACK_WEB_ORIGIN })
		);
		expect(session?.user.id).toBeTruthy();
		await expect(
			auth.accountAccess.write(
				productRequest(webCookies, { origin: LOOPBACK_WEB_ORIGIN })
			)
		).resolves.toMatchObject({ written: true });
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

	it("returns only a one-time code on the Tauri deep link after GitHub sign-in", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const location = callback.headers.get("location") ?? "";
		expect(location.startsWith(`${TAURI_CALLBACK_URL}?`)).toBe(true);
		const deepLink = new URL(location);
		expect([...deepLink.searchParams.keys()]).toEqual(["code"]);
		expect(deepLink.searchParams.get("code")).toMatch(TAURI_ONE_TIME_CODE);
		expect(oneTimeCodeFromDeepLink(`${location}&token=session`)).toBeNull();
		expect(
			oneTimeCodeFromDeepLink(`${location}&access_token=gho_x`)
		).toBeNull();
		expect(location.toLowerCase()).not.toContain("token");
		expect(location).not.toContain("gho_");
		const sessionCookies = callback.headers
			.getSetCookie()
			.filter((header) => SESSION_COOKIE.test(header));
		expect(sessionCookies).toHaveLength(0);
		restore();
	});

	it("exchanges the Tauri one-time code for a bearer product session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-exchange",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		expect(code).toBeTruthy();

		const exchanged = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			userAgent: MAC_USER_AGENT,
		});
		const body = await jsonBody(exchanged);
		expect(exchanged.ok).toBe(true);
		expect(typeof body.token).toBe("string");
		expect(String(body.token).length).toBeGreaterThan(8);
		expect(JSON.stringify(body).toLowerCase()).not.toContain("gho_");

		const session = await auth.accountAccess.current(
			bearerProductRequest(String(body.token), { userAgent: MAC_USER_AGENT })
		);
		expect(session?.user.id).toBeTruthy();
		await expect(
			auth.accountAccess.write(
				bearerProductRequest(String(body.token), { userAgent: MAC_USER_AGENT })
			)
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("rejects reuse of a Tauri one-time code", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-reuse",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		const first = await exchangeTauriCode(auth.handler, { code: code ?? "" });
		expect(first.ok).toBe(true);
		const replay = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			ip: "198.51.100.40",
		});
		expect(replay.status).toBe(401);
		expect((await jsonBody(replay)).message).toBe(SIGN_IN_FAILED_MESSAGE);
		restore();
	});

	it("rejects an expired Tauri one-time code", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = { now: new Date() };
		const auth = createAccess({
			now: () => new Date(clock.now.getTime()),
		});
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-expired",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		clock.now = new Date(clock.now.getTime() + 5 * 60 * 1000 + 1000);
		const exchanged = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			ip: "198.51.100.41",
		});
		expect(exchanged.status).toBe(401);
		expect((await jsonBody(exchanged)).message).toBe(SIGN_IN_FAILED_MESSAGE);
		restore();
	});

	it("lists the Tauri bearer session and stops writes after Revoke Session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const web = await signInDevice(auth, {
			code: "founder-web-list",
			userAgent: WINDOWS_USER_AGENT,
		});
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"198.51.100.42",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-list",
			ip: "198.51.100.42",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		const exchanged = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			ip: "198.51.100.43",
			userAgent: MAC_USER_AGENT,
		});
		const token = String((await jsonBody(exchanged)).token);
		expect(exchanged.ok).toBe(true);

		const listed = await auth.accountAccess.list(productRequest(web));
		expect(listed).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					current: true,
					device: "Windows",
				}),
				expect.objectContaining({
					current: false,
					device: "Mac",
				}),
			])
		);
		expect(listed).toHaveLength(2);
		for (const session of listed) {
			expect(session).not.toHaveProperty("token");
			expect(Number.isNaN(Date.parse(session.lastActivity))).toBe(false);
		}
		expect(JSON.stringify(listed)).not.toContain(token);

		const tauriSession = listed.find((session) => session.device === "Mac");
		await auth.accountAccess.revoke(
			productRequest(web),
			tauriSession?.id ?? ""
		);

		await expect(
			auth.accountAccess.write(bearerProductRequest(token))
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await expect(
			auth.accountAccess.write(productRequest(web))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("applies the same idle lifetime to a Tauri bearer session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = { now: new Date() };
		const auth = createAccess({
			now: () => new Date(clock.now.getTime()),
		});
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-idle",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		const exchanged = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			ip: "198.51.100.44",
			userAgent: MAC_USER_AGENT,
		});
		const token = String((await jsonBody(exchanged)).token);
		const session = await auth.accountAccess.current(
			bearerProductRequest(token)
		);
		expect(session).toBeTruthy();
		const remaining =
			new Date(session?.session.expiresAt ?? 0).getTime() - Date.now();
		expect(remaining).toBeGreaterThan(TWELVE_HOURS_MS - 120_000);
		expect(remaining).toBeLessThanOrEqual(TWELVE_HOURS_MS + 120_000);

		clock.now = new Date(
			new Date(session?.session.expiresAt ?? 0).getTime() + 1000
		);
		expect(
			await auth.accountAccess.current(bearerProductRequest(token))
		).toBeNull();
		await expect(
			auth.accountAccess.write(bearerProductRequest(token))
		).rejects.toMatchObject({ status: 401 });
		restore();
	});

	it("applies the same absolute lifetime to a Tauri bearer session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = { now: new Date() };
		const auth = createAccess({
			now: () => new Date(clock.now.getTime()),
		});
		const cookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			cookies,
			"203.0.113.10",
			TAURI_CALLBACK_URL
		);
		const callback = await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-tauri-absolute",
			state: authorizationState(String((await jsonBody(start)).url)),
			userAgent: MAC_USER_AGENT,
		});
		const code = new URL(
			callback.headers.get("location") ?? ""
		).searchParams.get("code");
		const exchanged = await exchangeTauriCode(auth.handler, {
			code: code ?? "",
			ip: "198.51.100.45",
			userAgent: MAC_USER_AGENT,
		});
		const token = String((await jsonBody(exchanged)).token);
		const session = await auth.accountAccess.current(
			bearerProductRequest(token)
		);
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
			await auth.accountAccess.current(bearerProductRequest(token))
		).toBeNull();
		await expect(
			auth.accountAccess.write(bearerProductRequest(token))
		).rejects.toMatchObject({ status: 401 });
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
		expect(authorizeUrl.searchParams.get("prompt")).toBeNull();
		expect(await auth.accountAccess.githubAvailability()).toEqual({
			status: "up",
		});
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
		const restore = installGitHubOAuthDouble({
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

		const again = await signInDevice(auth, {
			code: "founder-app-uninstalled-again",
			ip: "198.51.100.30",
			userAgent: WINDOWS_USER_AGENT,
		});
		const signedInAgain = await auth.api.getSession({
			headers: new Headers({ cookie: again.header() }),
		});
		expect(signedInAgain?.user.id).toBe(signedIn?.user.id);
		expect(
			await getAccountAccessForUser(prisma, signedInAgain?.user.id ?? "")
		).toEqual(before);
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
			expect(await auth.accountAccess.githubAvailability()).toEqual({
				message: "Waiting for GitHub",
				status: "waiting",
			});
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
			expect(
				await auth.accountAccess.startConfirmGitHubIdentity(
					productRequest(cookies),
					"account-closure-start"
				)
			).toEqual({
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

	it("marks Confirm GitHub Identity ready without minting a grant while GitHub is up", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-ready",
			userAgent: MAC_USER_AGENT,
		});
		expect(
			await auth.accountAccess.confirmGitHubIdentity(productRequest(cookies))
		).toEqual({ status: "ready" });
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				""
			)
		).rejects.toMatchObject({
			message: "operationId is required",
			status: 400,
		});
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("starts Confirm GitHub Identity as a new GitHub authorization-code tour with PKCE and select_account", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-start",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		expect(started.status).toBe("redirect");
		const authorizeUrl = confirmAuthorizeUrl(started);
		expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
			"https://github.com/login/oauth/authorize"
		);
		expect(authorizeUrl.searchParams.get("prompt")).toBe("select_account");
		expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
		expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
		expect(authorizeUrl.searchParams.get("code_challenge")).toMatch(
			PKCE_CODE_CHALLENGE
		);
		expect(authorizeUrl.searchParams.get("state")).toBeTruthy();
		expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
			`${BASE_URL}/api/auth/confirm-github-identity/callback`
		);
		const scopes = (authorizeUrl.searchParams.get("scope") ?? "")
			.split(SCOPE_SEPARATOR)
			.filter(Boolean)
			.sort();
		expect(scopes).toEqual(["read:user", "user:email"]);
		expect(scopes.join(" ")).not.toMatch(REPO_SCOPES);
		expect(authorizeUrl.search).not.toContain("client_secret");
		expect(await auth.accountAccess.list(productRequest(cookies))).toHaveLength(
			1
		);
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("mints a one-time Confirm GitHub Identity grant for the matching GitHub user and intended operation", async () => {
		const pkce = { challenge: "" };
		const restore = installGitHubOAuthDouble({
			confirmationCodeChallenge: () => pkce.challenge,
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-match",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		pkce.challenge =
			confirmAuthorizeUrl(started).searchParams.get("code_challenge") ?? "";
		await auth.accountAccess.completeConfirmGitHubIdentity(
			productRequest(cookies),
			{
				code: "founder-confirm-match-callback",
				state: confirmAuthorizeUrl(started).searchParams.get("state") ?? "",
			}
		);
		expect(await auth.accountAccess.list(productRequest(cookies))).toHaveLength(
			1
		);
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"account-closure-cancel"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await auth.accountAccess.consumeConfirmGitHubIdentityGrant(
			productRequest(cookies),
			"account-closure-start"
		);
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("rejects a Confirm GitHub Identity callback for a different GitHub user without a grant", async () => {
		const other: GitHubProfile = {
			email: "other@example.com",
			id: 7777,
			login: "other",
			name: "Other",
		};
		const restore = installGitHubOAuthDouble({
			profileForCode: (code) => (code.includes("other") ? other : founder),
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-mismatch",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				{
					code: "other-github-user",
					state: confirmAuthorizeUrl(started).searchParams.get("state") ?? "",
				}
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).resolves.toMatchObject({ written: true });
		restore();
	});

	it("rejects an expired Confirm GitHub Identity tour and an expired grant", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const clock = createTestClock();
		const auth = createAccess({ now: clock.now });
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-expiry",
			userAgent: MAC_USER_AGENT,
		});
		const expiredTour = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		clock.advanceMs(TEN_MINUTES_MS + 1);
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				{
					code: "founder-confirm-expired-tour",
					state:
						confirmAuthorizeUrl(expiredTour).searchParams.get("state") ?? "",
				}
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		const liveTour = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"personal-data-erase"
		);
		await auth.accountAccess.completeConfirmGitHubIdentity(
			productRequest(cookies),
			{
				code: "founder-confirm-expired-grant",
				state: confirmAuthorizeUrl(liveTour).searchParams.get("state") ?? "",
			}
		);
		clock.advanceMs(TEN_MINUTES_MS + 1);
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"personal-data-erase"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("rejects Confirm GitHub Identity state and PKCE failures without minting a grant", async () => {
		const pkce = { challenge: "" };
		const restore = installGitHubOAuthDouble({
			confirmationCodeChallenge: () => pkce.challenge,
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-pkce",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"security-redaction"
		);
		const authorizeUrl = confirmAuthorizeUrl(started);
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				{
					code: "founder-confirm-pkce-callback",
					state: "not-the-tour-state",
				}
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		pkce.challenge = "not-the-code-challenge-from-this-tour";
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				{
					code: "founder-confirm-pkce-callback",
					state: authorizeUrl.searchParams.get("state") ?? "",
				}
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"security-redaction"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("rejects Confirm GitHub Identity callback replay so the grant stays one-time", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-replay",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"early-permanent-delete"
		);
		const input = {
			code: "founder-confirm-replay-callback",
			state: confirmAuthorizeUrl(started).searchParams.get("state") ?? "",
		};
		await auth.accountAccess.completeConfirmGitHubIdentity(
			productRequest(cookies),
			input
		);
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				input
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		await auth.accountAccess.consumeConfirmGitHubIdentityGrant(
			productRequest(cookies),
			"early-permanent-delete"
		);
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies),
				"early-permanent-delete"
			)
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});
		restore();
	});

	it("completes Confirm GitHub Identity over the product callback without creating a second session", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-http",
			userAgent: MAC_USER_AGENT,
		});
		const started = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-cancel"
		);
		const callbackUrl = new URL(
			`${BASE_URL}/api/auth/confirm-github-identity/callback`
		);
		callbackUrl.searchParams.set("code", "founder-confirm-http-callback");
		callbackUrl.searchParams.set(
			"state",
			confirmAuthorizeUrl(started).searchParams.get("state") ?? ""
		);
		const callback = await auth.handler(
			new Request(callbackUrl, {
				headers: {
					cookie: cookies.header(),
				},
			})
		);
		expect(callback.status).toBe(302);
		expect(callback.headers.get("location")).toBe(
			`${WEB_ORIGIN}/confirm-github-identity`
		);
		expect(await auth.accountAccess.list(productRequest(cookies))).toHaveLength(
			1
		);
		await auth.accountAccess.consumeConfirmGitHubIdentityGrant(
			productRequest(cookies),
			"account-closure-cancel"
		);
		restore();
	});

	it("records Confirm GitHub Identity start, success, and failure as secret-free Denetim kaydı", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: (code) =>
				code.includes("other") ? otherFounder() : founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-confirm-audit",
			userAgent: MAC_USER_AGENT,
		});
		const failed = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		await expect(
			auth.accountAccess.completeConfirmGitHubIdentity(
				productRequest(cookies),
				{
					code: "other-github-user-audit",
					state: confirmAuthorizeUrl(failed).searchParams.get("state") ?? "",
				}
			)
		).rejects.toMatchObject({ status: 401 });
		const succeeded = await auth.accountAccess.startConfirmGitHubIdentity(
			productRequest(cookies),
			"account-closure-start"
		);
		await auth.accountAccess.completeConfirmGitHubIdentity(
			productRequest(cookies),
			{
				code: "founder-confirm-audit-callback",
				state: confirmAuthorizeUrl(succeeded).searchParams.get("state") ?? "",
			}
		);
		const events = await auth.auditLog.list();
		const confirmation = events.filter((event) =>
			event.type.startsWith("confirm_github_identity.")
		);
		expect(confirmation.map((event) => event.type)).toEqual([
			CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
			CONFIRM_GITHUB_IDENTITY_FAILED_EVENT_TYPE,
			CONFIRM_GITHUB_IDENTITY_STARTED_EVENT_TYPE,
			CONFIRM_GITHUB_IDENTITY_SUCCEEDED_EVENT_TYPE,
		]);
		const serialized = JSON.stringify(confirmation);
		expect(serialized).not.toContain(FOUNDER_EMAIL);
		expect(serialized).not.toContain("other@example.com");
		expect(serialized).not.toContain("gho_");
		expect(serialized).not.toContain("client_secret");
		for (const event of confirmation) {
			expect(event.accountAlias).toMatch(HEX_ALIAS);
			expect(event.actorAlias).toBe(event.accountAlias);
			expect(event.sessionAlias).toMatch(HEX_ALIAS);
		}
		restore();
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
		expect(new URL(String(payload.url)).searchParams.get("prompt")).toBe(
			"consent"
		);
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

		const laterCookies = cookieJar();
		const laterStart = await startGitHubSignIn(
			auth.handler,
			laterCookies,
			"198.51.100.29"
		);
		expect(
			new URL(String((await jsonBody(laterStart)).url)).searchParams.get(
				"prompt"
			)
		).toBeNull();
		restore();
	});

	it("ends product sessions when GitHub rejects the login OAuth token", async () => {
		const revokedTokens = new Set<string>();
		const restore = installGitHubOAuthDouble({
			isAccessTokenRevoked: (token) => revokedTokens.has(token),
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-github-rejected-token",
			userAgent: MAC_USER_AGENT,
		});
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).resolves.toMatchObject({ written: true });

		revokedTokens.add("gho_founder-github-rejected-token");

		const sessionResponse = await auth.handler(
			new Request(`${BASE_URL}/api/auth/get-session`, {
				headers: {
					cookie: cookies.header(),
					origin: WEB_ORIGIN,
				},
			})
		);
		expect(sessionResponse.ok).toBe(true);
		expect(await sessionResponse.clone().json()).toBeNull();
		await expect(
			auth.accountAccess.write(productRequest(cookies))
		).rejects.toMatchObject({
			message: SESSION_WRITE_UNAUTHORIZED_MESSAGE,
			status: 401,
		});

		const nextCookies = cookieJar();
		const start = await startGitHubSignIn(
			auth.handler,
			nextCookies,
			"198.51.100.31"
		);
		expect(
			new URL(String((await jsonBody(start)).url)).searchParams.get("prompt")
		).toBe("consent");
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
		await expect(
			auth.accountAccess.startConfirmGitHubIdentity(
				productRequest(cookies, { origin: null }),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: CSRF_REJECTED_MESSAGE,
			status: 403,
		});
		await expect(
			auth.accountAccess.consumeConfirmGitHubIdentityGrant(
				productRequest(cookies, { origin: "https://evil.example" }),
				"account-closure-start"
			)
		).rejects.toMatchObject({
			message: CSRF_REJECTED_MESSAGE,
			status: 403,
		});
		restore();
	});

	it("accepts cookie CSRF from the Tauri webview origin", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = await signInDevice(auth, {
			code: "founder-tauri-csrf",
			userAgent: MAC_USER_AGENT,
		});
		await expect(
			auth.accountAccess.write(
				productRequest(cookies, { origin: "tauri://localhost" })
			)
		).resolves.toMatchObject({ written: true });
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

describe("Account Access CORS origins", () => {
	it("allows the 127.0.0.1 loopback alias of the web origin", () => {
		expect(productCorsOrigins(WEB_ORIGIN)).toEqual(
			expect.arrayContaining(["http://localhost:3001", "http://127.0.0.1:3001"])
		);
		expect(productTrustedOrigins(WEB_ORIGIN)).toEqual(
			expect.arrayContaining(["http://localhost:3001", "http://127.0.0.1:3001"])
		);
	});

	it("allows Chromium and Firefox extension origins and not Safari", () => {
		expect(allowProductCorsOrigin("chrome-extension://abcd", WEB_ORIGIN)).toBe(
			"chrome-extension://abcd"
		);
		expect(allowProductCorsOrigin("moz-extension://abcd", WEB_ORIGIN)).toBe(
			"moz-extension://abcd"
		);
		expect(
			allowProductCorsOrigin("safari-web-extension://abcd", WEB_ORIGIN)
		).toBeUndefined();
		expect(isClipperExtensionOrigin("safari-web-extension://abcd")).toBe(false);
	});

	it("reflects http(s) Origins in development so forwarded Cloud Agent browsers can write", () => {
		const previous = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = "development";
			expect(
				allowProductCorsOrigin("https://3001-agent.example.test", WEB_ORIGIN)
			).toBe("https://3001-agent.example.test");
			process.env.NODE_ENV = "production";
			expect(
				allowProductCorsOrigin("https://3001-agent.example.test", WEB_ORIGIN)
			).toBeUndefined();
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});
