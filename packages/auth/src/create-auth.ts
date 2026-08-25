import type { PrismaClient } from "@cantiara/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";

import { createAccountSessionAccess } from "./account-sessions";
import {
	type GitHubAvailability,
	githubWaitingResponse,
	isGitHubWaiting,
	probeGitHubAvailability,
} from "./github-availability";
import {
	ensureWorkspaceForAccount,
	GITHUB_IDENTITY_SCOPES,
	genericSignInFailureResponse,
	isGitHubSignInPath,
	toWebAppCallbackURL,
} from "./github-login";
import {
	clientIpFromRequest,
	createMemoryRateLimiter,
	type RateLimiter,
} from "./rate-limit";
import {
	type AuditLog,
	createMemoryAuditLog,
	createMemorySecurityEventLog,
	SESSION_SIGNED_IN_EVENT_TYPE,
	SESSION_SIGNED_OUT_EVENT_TYPE,
	type SecurityEventLog,
	sessionAuditEvent,
} from "./session-events";
import {
	isPastAbsoluteLifetime,
	isPastIdleExpiry,
	SESSION_IDLE_SECONDS,
	SESSION_UPDATE_AGE_SECONDS,
} from "./session-policy";

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60_000;

export interface CreateAuthOptions {
	auditLog?: AuditLog;
	baseURL: string;
	github: {
		clientId: string;
		clientSecret: string;
	};
	githubAvailability?: () => Promise<GitHubAvailability>;
	now?: () => Date;
	prisma: PrismaClient;
	rateLimit?: {
		windowMs: number;
		maxAttempts: number;
		limiter?: RateLimiter;
	};
	secret: string;
	securityEventLog?: SecurityEventLog;
	trustedOrigins: string[];
}

export function createAuth(options: CreateAuthOptions) {
	const configuredLimit = options.rateLimit;
	const maxAttempts = configuredLimit
		? configuredLimit.maxAttempts
		: DEFAULT_MAX_ATTEMPTS;
	const windowMs = configuredLimit
		? configuredLimit.windowMs
		: DEFAULT_WINDOW_MS;
	const limiter =
		configuredLimit?.limiter ??
		createMemoryRateLimiter({ maxAttempts, windowMs });
	const auditLog = options.auditLog ?? createMemoryAuditLog();
	const securityEventLog =
		options.securityEventLog ?? createMemorySecurityEventLog();
	const now = options.now ?? (() => new Date());
	const githubAvailability =
		options.githubAvailability ?? (() => probeGitHubAvailability());

	const auth = betterAuth({
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ["github"],
			},
			encryptOAuthTokens: true,
		},
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				path: "/",
				sameSite: "lax",
				secure: true,
			},
			useSecureCookies: true,
		},
		baseURL: options.baseURL,
		database: prismaAdapter(options.prisma, {
			provider: "postgresql",
		}),
		databaseHooks: {
			session: {
				create: {
					after: async (session) => {
						await ensureWorkspaceForAccount(options.prisma, session.userId);
						await auditLog.append(
							sessionAuditEvent({
								accountId: session.userId,
								actorId: session.userId,
								now: now(),
								secret: options.secret,
								sessionId: session.id,
								type: SESSION_SIGNED_IN_EVENT_TYPE,
							})
						);
					},
				},
			},
			user: {
				create: {
					after: async (user) => {
						await ensureWorkspaceForAccount(options.prisma, user.id);
					},
				},
			},
		},
		emailAndPassword: {
			enabled: false,
		},
		hooks: {
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/get-session") {
					return;
				}
				const { returned } = ctx.context;
				if (!returned || returned instanceof Response) {
					return;
				}
				const payload = returned as {
					session?: {
						createdAt?: Date | string;
						expiresAt?: Date | string;
						id?: string;
					};
				};
				if (!(payload.session?.createdAt && payload.session.id)) {
					return;
				}
				const nowDate = now();
				const idleExpired = payload.session.expiresAt
					? isPastIdleExpiry(new Date(payload.session.expiresAt), nowDate)
					: false;
				if (
					!(
						isPastAbsoluteLifetime(
							new Date(payload.session.createdAt),
							nowDate
						) || idleExpired
					)
				) {
					return;
				}
				await options.prisma.session.deleteMany({
					where: { id: payload.session.id },
				});
				ctx.context.returned = null;
			}),
		},
		rateLimit: {
			enabled: false,
		},
		secret: options.secret,
		session: {
			cookieCache: {
				enabled: false,
			},
			expiresIn: SESSION_IDLE_SECONDS,
			updateAge: SESSION_UPDATE_AGE_SECONDS,
		},
		socialProviders: {
			github: {
				clientId: options.github.clientId,
				clientSecret: options.github.clientSecret,
				disableDefaultScope: true,
				scope: [...GITHUB_IDENTITY_SCOPES],
			},
		},
		telemetry: { enabled: false },
		trustedOrigins: options.trustedOrigins,
	});

	const accountAccess = createAccountSessionAccess({
		auditLog,
		auth,
		githubAvailability,
		now,
		prisma: options.prisma,
		secret: options.secret,
		securityEventLog,
		trustedOrigins: options.trustedOrigins,
	});

	const innerHandler = auth.handler.bind(auth);
	const handler = (request: Request) =>
		handleAuthRequest(request, {
			accountAccess,
			auditLog,
			auth,
			githubAvailability,
			innerHandler,
			limiter,
			now,
			prisma: options.prisma,
			secret: options.secret,
			trustedOrigins: options.trustedOrigins,
		});

	return Object.assign(auth, {
		accountAccess,
		auditLog,
		handler,
		securityEventLog,
	});
}

interface AuthSessionLookup {
	api: {
		getSession: (args: { headers: Headers }) => Promise<{
			session: { id: string };
			user: { id: string };
		} | null>;
	};
}

async function handleAuthRequest(
	request: Request,
	deps: {
		accountAccess: { current: (request: Request) => Promise<unknown> };
		auditLog: AuditLog;
		auth: AuthSessionLookup;
		githubAvailability: () => Promise<GitHubAvailability>;
		innerHandler: (request: Request) => Promise<Response>;
		limiter: RateLimiter;
		now: () => Date;
		prisma: PrismaClient;
		secret: string;
		trustedOrigins: string[];
	}
): Promise<Response> {
	const { pathname } = new URL(request.url);
	const isSignIn = isGitHubSignInPath(pathname);
	const ip = clientIpFromRequest(request);

	if (isSignIn && !deps.limiter.consume(`ip:${ip}`)) {
		return genericSignInFailureResponse(429);
	}

	if (isSignIn && isGitHubWaiting(await deps.githubAvailability())) {
		return githubWaitingResponse();
	}

	const authRequest = await requestWithWebAppCallback(
		await requestWithDisabledRefreshWhenGitHubWaits(
			request,
			deps.githubAvailability
		),
		deps.trustedOrigins
	);

	if (pathname.endsWith("/sign-out") && request.method === "POST") {
		await recordSignOutAudit({
			auditLog: deps.auditLog,
			auth: deps.auth,
			now: deps.now,
			request: authRequest,
			secret: deps.secret,
		});
	}

	let response: Response;
	try {
		response = await deps.innerHandler(authRequest);
	} catch {
		return isSignIn ? genericSignInFailureResponse() : Response.error();
	}

	if (isSignIn && response.status >= 400) {
		return genericSignInFailureResponse(response.status === 429 ? 429 : 401);
	}

	if (pathname.endsWith("/sign-in/social") && response.ok) {
		response = await withConsentPromptIfLoginOAuthRevoked(
			response,
			deps.prisma
		);
	}

	if (pathname.includes("/list-sessions")) {
		return stripSessionTokens(response);
	}

	response = await hideGetSessionIfLoginOAuthRevoked(
		pathname,
		response,
		deps.accountAccess,
		authRequest
	);

	if (!pathname.includes("/callback/github")) {
		return response;
	}

	return admitGitHubCallback(request, response, deps);
}

async function hideGetSessionIfLoginOAuthRevoked(
	pathname: string,
	response: Response,
	accountAccess: { current: (request: Request) => Promise<unknown> },
	authRequest: Request
): Promise<Response> {
	if (!(pathname.endsWith("/get-session") && response.ok)) {
		return response;
	}
	let payload: unknown;
	try {
		payload = await response.clone().json();
	} catch {
		return response;
	}
	const hadSession = Boolean(
		payload &&
			typeof payload === "object" &&
			"session" in payload &&
			(payload as { session?: unknown }).session
	);
	if (!hadSession) {
		return response;
	}
	const live = await accountAccess.current(authRequest);
	if (live) {
		return response;
	}
	return Response.json(null);
}

async function recordSignOutAudit(deps: {
	auditLog: AuditLog;
	auth: AuthSessionLookup;
	now: () => Date;
	request: Request;
	secret: string;
}): Promise<void> {
	let session: {
		session: { id: string };
		user: { id: string };
	} | null;
	try {
		session = await deps.auth.api.getSession({
			headers: deps.request.headers,
		});
	} catch {
		return;
	}
	if (!session) {
		return;
	}
	await deps.auditLog.append(
		sessionAuditEvent({
			accountId: session.user.id,
			actorId: session.user.id,
			now: deps.now(),
			secret: deps.secret,
			sessionId: session.session.id,
			type: SESSION_SIGNED_OUT_EVENT_TYPE,
		})
	);
}

async function stripSessionTokens(response: Response): Promise<Response> {
	if (!response.ok) {
		return response;
	}
	try {
		const body: unknown = await response.clone().json();
		if (!Array.isArray(body)) {
			return response;
		}
		const stripped = body.map((entry) => {
			if (entry && typeof entry === "object") {
				return Object.fromEntries(
					Object.entries(entry).filter(([key]) => key !== "token")
				);
			}
			return entry;
		});
		return Response.json(stripped, { status: response.status });
	} catch {
		return response;
	}
}

async function admitGitHubCallback(
	request: Request,
	response: Response,
	deps: {
		auth: AuthSessionLookup;
		limiter: RateLimiter;
	}
): Promise<Response> {
	const session = await deps.auth.api.getSession({
		headers: cookieHeadersFromResponse(request, response),
	});
	if (!session) {
		return genericSignInFailureResponse(401);
	}
	if (!deps.limiter.consume(`account:${session.user.id}`)) {
		return genericSignInFailureResponse(429);
	}
	return response;
}

function cookieHeadersFromResponse(
	request: Request,
	response: Response
): Headers {
	const headers = new Headers(request.headers);
	const jar = new Map<string, string>();
	mergeCookieHeader(jar, request.headers.get("cookie") ?? "");
	for (const setCookie of response.headers.getSetCookie()) {
		const [pair] = setCookie.split(";", 1);
		if (pair) {
			mergeCookieHeader(jar, pair);
		}
	}
	headers.set(
		"cookie",
		[...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
	);
	return headers;
}

async function requestWithDisabledRefreshWhenGitHubWaits(
	request: Request,
	githubAvailability: () => Promise<GitHubAvailability>
): Promise<Request> {
	const url = new URL(request.url);
	if (!url.pathname.endsWith("/get-session")) {
		return request;
	}
	if (!isGitHubWaiting(await githubAvailability())) {
		return request;
	}
	url.searchParams.set("disableRefresh", "true");
	return new Request(url.toString(), request);
}

async function withConsentPromptIfLoginOAuthRevoked(
	response: Response,
	prisma: PrismaClient
): Promise<Response> {
	const revoked = await prisma.account.findFirst({
		select: { id: true },
		where: { accessToken: null, providerId: "github" },
	});
	if (!revoked) {
		return response;
	}

	const location = response.headers.get("location");
	const redirected = location ? addConsentPrompt(location) : location;
	let payload: Record<string, unknown> | null = null;
	try {
		payload = (await response.clone().json()) as Record<string, unknown>;
	} catch {
		payload = null;
	}
	const nextUrl =
		typeof payload?.url === "string" ? addConsentPrompt(payload.url) : null;
	const jsonChanged = Boolean(payload && nextUrl && nextUrl !== payload.url);
	const locationChanged = Boolean(
		location && redirected && redirected !== location
	);
	if (!(jsonChanged || locationChanged)) {
		return response;
	}

	if (jsonChanged && payload && nextUrl) {
		const headers = new Headers();
		for (const cookie of response.headers.getSetCookie()) {
			headers.append("set-cookie", cookie);
		}
		if (locationChanged && redirected) {
			headers.set("location", redirected);
		}
		return Response.json(
			{ ...payload, url: nextUrl },
			{ headers, status: response.status }
		);
	}

	const headers = new Headers(response.headers);
	if (redirected) {
		headers.set("location", redirected);
	}
	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

function addConsentPrompt(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.searchParams.set("prompt", "consent");
		return parsed.toString();
	} catch {
		return url;
	}
}

async function requestWithWebAppCallback(
	request: Request,
	trustedOrigins: string[]
): Promise<Request> {
	const { pathname } = new URL(request.url);
	if (request.method !== "POST" || !pathname.endsWith("/sign-in/social")) {
		return request;
	}
	let body: Record<string, unknown>;
	try {
		body = (await request.clone().json()) as Record<string, unknown>;
	} catch {
		return request;
	}
	if (typeof body.callbackURL !== "string") {
		return request;
	}
	const callbackURL = toWebAppCallbackURL(
		body.callbackURL,
		request.headers.get("origin"),
		trustedOrigins
	);
	if (callbackURL === body.callbackURL) {
		return request;
	}
	return new Request(request, {
		body: JSON.stringify({ ...body, callbackURL }),
	});
}

function mergeCookieHeader(jar: Map<string, string>, header: string) {
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		if (!trimmed) {
			continue;
		}
		const separator = trimmed.indexOf("=");
		if (separator === -1) {
			continue;
		}
		jar.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
	}
}
