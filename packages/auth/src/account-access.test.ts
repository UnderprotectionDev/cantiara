/**
 * Account Access seam — GitHub sign-in, Account, and single Workspace.
 * Synthetic fixture for the sign-in/admission slice of
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Hesap ve kişisel veri).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAuth } from "./create-auth";
import {
	getAccountAccessForUser,
	SIGN_IN_FAILED_MESSAGE,
	WORKSPACE_DEFAULT_NAME,
} from "./github-login";

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

function installGitHubOAuthDouble(options: {
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
		return originalFetch(input, init);
	};
	return () => {
		globalThis.fetch = originalFetch;
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
	input: { code: string; state: string; ip?: string }
) {
	const url = new URL(`${BASE_URL}/api/auth/callback/github`);
	url.searchParams.set("code", input.code);
	url.searchParams.set("state", input.state);
	const response = await handler(
		new Request(url, {
			headers: {
				cookie: cookies.header(),
				origin: WEB_ORIGIN,
				"x-forwarded-for": input.ip ?? "203.0.113.10",
			},
		})
	);
	cookies.apply(response);
	return response;
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
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	function createAccess() {
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

	it("keeps a valid session without consulting a GitHub App installation", async () => {
		const restore = installGitHubOAuthDouble({
			profileForCode: () => founder,
		});
		const auth = createAccess();
		const cookies = cookieJar();
		const start = await startGitHubSignIn(auth.handler, cookies);
		await completeGitHubCallback(auth.handler, cookies, {
			code: "founder-first",
			state: authorizationState(String((await jsonBody(start)).url)),
		});
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: cookies.header() }),
		});
		expect(session?.user.id).toBeTruthy();
		expect("githubAppInstallation" in prisma).toBe(false);
		restore();
	});
});
