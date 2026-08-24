import type { PrismaClient } from "@cantiara/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import {
	ensureWorkspaceForAccount,
	GITHUB_IDENTITY_SCOPES,
	genericSignInFailureResponse,
	isGitHubSignInPath,
} from "./github-login";
import {
	clientIpFromRequest,
	createMemoryRateLimiter,
	type RateLimiter,
} from "./rate-limit";

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60_000;

export interface CreateAuthOptions {
	baseURL: string;
	github: {
		clientId: string;
		clientSecret: string;
	};
	prisma: PrismaClient;
	rateLimit?: {
		windowMs: number;
		maxAttempts: number;
		limiter?: RateLimiter;
	};
	secret: string;
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
		rateLimit: {
			enabled: false,
		},
		secret: options.secret,
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

	const innerHandler = auth.handler.bind(auth);
	const handler = (request: Request) =>
		handleAuthRequest(request, { auth, innerHandler, limiter });

	return Object.assign(auth, { handler });
}

interface AuthSessionLookup {
	api: {
		getSession: (args: {
			headers: Headers;
		}) => Promise<{ user: { id: string } } | null>;
	};
}

async function handleAuthRequest(
	request: Request,
	deps: {
		auth: AuthSessionLookup;
		innerHandler: (request: Request) => Promise<Response>;
		limiter: RateLimiter;
	}
): Promise<Response> {
	const { pathname } = new URL(request.url);
	const isSignIn = isGitHubSignInPath(pathname);
	const ip = clientIpFromRequest(request);

	if (isSignIn && !deps.limiter.consume(`ip:${ip}`)) {
		return genericSignInFailureResponse(429);
	}

	let response: Response;
	try {
		response = await deps.innerHandler(request);
	} catch {
		return isSignIn ? genericSignInFailureResponse() : Response.error();
	}

	if (isSignIn && response.status >= 400) {
		return genericSignInFailureResponse(response.status === 429 ? 429 : 401);
	}

	if (!pathname.includes("/callback/github")) {
		return response;
	}

	return admitGitHubCallback(request, response, deps);
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
