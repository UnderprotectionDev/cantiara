import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@cantiara/db";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

import {
	AccountAccessError,
	OPERATION_ID_REQUIRED_MESSAGE,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import { GITHUB_IDENTITY_SCOPES } from "./github-login";

export const CONFIRM_GITHUB_IDENTITY_GRANT_SECONDS = 10 * 60;

export const CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH =
	"/api/auth/confirm-github-identity/callback";

export const CONFIRM_GITHUB_IDENTITY_RETURN_PATH = "/confirm-github-identity";

export const CONFIRM_GITHUB_IDENTITY_OPERATION_IDS = [
	"account-closure-start",
	"account-closure-cancel",
	"early-permanent-delete",
	"security-redaction",
	"personal-data-erase",
] as const;

export type ConfirmGitHubIdentityOperationId =
	(typeof CONFIRM_GITHUB_IDENTITY_OPERATION_IDS)[number];

export type ConfirmGitHubIdentityStart =
	| { message: string; status: "waiting" }
	| { status: "redirect"; url: string };

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const TOUR_PREFIX = "confirm-github-identity-tour:";
const GRANT_PREFIX = "confirm-github-identity-grant:";
const EXCHANGE_TIMEOUT_MS = 2000;

export function isConfirmGitHubIdentityOperationId(
	value: string
): value is ConfirmGitHubIdentityOperationId {
	return (CONFIRM_GITHUB_IDENTITY_OPERATION_IDS as readonly string[]).includes(
		value
	);
}

export function confirmGitHubIdentityRedirectUri(baseURL: string): string {
	return `${trimTrailingSlash(baseURL)}${CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH}`;
}

export function isConfirmGitHubIdentityCallbackPath(pathname: string): boolean {
	return pathname.endsWith("/confirm-github-identity/callback");
}

export function confirmGitHubIdentityReturnURL(
	trustedOrigins: readonly string[]
): string {
	const webOrigin = trustedOrigins[0] ?? "";
	return `${trimTrailingSlash(webOrigin)}${CONFIRM_GITHUB_IDENTITY_RETURN_PATH}`;
}

export function requireConfirmGitHubIdentityOperationId(
	operationId: string
): ConfirmGitHubIdentityOperationId {
	const trimmed = operationId.trim();
	if (!isConfirmGitHubIdentityOperationId(trimmed)) {
		throw new AccountAccessError(400, OPERATION_ID_REQUIRED_MESSAGE);
	}
	return trimmed;
}

export async function startConfirmGitHubIdentityTour(deps: {
	accountId: string;
	baseURL: string;
	githubClientId: string;
	now: Date;
	operationId: ConfirmGitHubIdentityOperationId;
	prisma: PrismaClient;
	secret: string;
}): Promise<string> {
	const state = randomBytes(32).toString("base64url");
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const encryptedVerifier = await symmetricEncrypt({
		data: verifier,
		key: deps.secret,
	});
	await deps.prisma.verification.create({
		data: {
			expiresAt: grantExpiresAt(deps.now),
			id: crypto.randomUUID(),
			identifier: tourIdentifier(state),
			value: JSON.stringify({
				accountId: deps.accountId,
				codeVerifier: encryptedVerifier,
				operationId: deps.operationId,
			}),
		},
	});
	const authorize = new URL(GITHUB_AUTHORIZE_URL);
	authorize.searchParams.set("client_id", deps.githubClientId);
	authorize.searchParams.set("code_challenge", challenge);
	authorize.searchParams.set("code_challenge_method", "S256");
	authorize.searchParams.set("prompt", "select_account");
	authorize.searchParams.set(
		"redirect_uri",
		confirmGitHubIdentityRedirectUri(deps.baseURL)
	);
	authorize.searchParams.set("response_type", "code");
	authorize.searchParams.set("scope", GITHUB_IDENTITY_SCOPES.join(" "));
	authorize.searchParams.set("state", state);
	return authorize.toString();
}

export async function completeConfirmGitHubIdentityTour(deps: {
	accountId: string;
	baseURL: string;
	code: string;
	expectedGitHubUserId: string;
	github: { clientId: string; clientSecret: string };
	now: Date;
	prisma: PrismaClient;
	secret: string;
	state: string;
}): Promise<void> {
	if (!(deps.code && deps.state)) {
		throw unauthorized();
	}
	const row = await deps.prisma.verification.findFirst({
		where: { identifier: tourIdentifier(deps.state) },
	});
	if (!row) {
		throw unauthorized();
	}
	const consumed = await deps.prisma.verification.deleteMany({
		where: { id: row.id },
	});
	if (consumed.count !== 1) {
		throw unauthorized();
	}
	if (row.expiresAt.getTime() <= deps.now.getTime()) {
		throw unauthorized();
	}
	const payload = parseTourValue(row.value);
	if (
		!(
			payload &&
			payload.accountId === deps.accountId &&
			isConfirmGitHubIdentityOperationId(payload.operationId)
		)
	) {
		throw unauthorized();
	}
	const verifier = await decryptVerifier(payload.codeVerifier, deps.secret);
	const githubUserId = await exchangeConfirmationCode({
		baseURL: deps.baseURL,
		code: deps.code,
		github: deps.github,
		verifier,
	});
	if (githubUserId !== deps.expectedGitHubUserId) {
		throw unauthorized();
	}
	await mintConfirmGitHubIdentityGrant({
		accountId: deps.accountId,
		now: deps.now,
		operationId: payload.operationId,
		prisma: deps.prisma,
	});
}

export async function consumeConfirmGitHubIdentityGrantRecord(deps: {
	accountId: string;
	now: Date;
	operationId: ConfirmGitHubIdentityOperationId;
	prisma: PrismaClient;
}): Promise<void> {
	const identifier = grantIdentifier(deps.accountId, deps.operationId);
	const row = await deps.prisma.verification.findFirst({
		where: { identifier },
	});
	if (!row) {
		throw unauthorized();
	}
	const consumed = await deps.prisma.verification.deleteMany({
		where: { id: row.id },
	});
	if (consumed.count !== 1) {
		throw unauthorized();
	}
	if (row.expiresAt.getTime() <= deps.now.getTime()) {
		throw unauthorized();
	}
}

function unauthorized(cause?: unknown): AccountAccessError {
	return new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE, {
		cause,
	});
}

function tourIdentifier(state: string): string {
	return `${TOUR_PREFIX}${state}`;
}

function grantIdentifier(
	accountId: string,
	operationId: ConfirmGitHubIdentityOperationId
): string {
	return `${GRANT_PREFIX}${accountId}:${operationId}`;
}

function grantExpiresAt(now: Date): Date {
	return new Date(now.getTime() + CONFIRM_GITHUB_IDENTITY_GRANT_SECONDS * 1000);
}

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseTourValue(value: string): {
	accountId: string;
	codeVerifier: string;
	operationId: string;
} | null {
	try {
		const parsed = JSON.parse(value) as {
			accountId?: unknown;
			codeVerifier?: unknown;
			operationId?: unknown;
		};
		if (
			typeof parsed.accountId === "string" &&
			typeof parsed.codeVerifier === "string" &&
			typeof parsed.operationId === "string"
		) {
			return {
				accountId: parsed.accountId,
				codeVerifier: parsed.codeVerifier,
				operationId: parsed.operationId,
			};
		}
		return null;
	} catch {
		return null;
	}
}

async function decryptVerifier(
	stored: string,
	secret: string
): Promise<string> {
	try {
		return await symmetricDecrypt({ data: stored, key: secret });
	} catch (error) {
		throw unauthorized(error);
	}
}

async function mintConfirmGitHubIdentityGrant(deps: {
	accountId: string;
	now: Date;
	operationId: ConfirmGitHubIdentityOperationId;
	prisma: PrismaClient;
}): Promise<void> {
	const identifier = grantIdentifier(deps.accountId, deps.operationId);
	await deps.prisma.verification.deleteMany({
		where: { identifier },
	});
	await deps.prisma.verification.create({
		data: {
			expiresAt: grantExpiresAt(deps.now),
			id: crypto.randomUUID(),
			identifier,
			value: "issued",
		},
	});
}

async function exchangeConfirmationCode(deps: {
	baseURL: string;
	code: string;
	github: { clientId: string; clientSecret: string };
	verifier: string;
}): Promise<string> {
	let tokenResponse: Response;
	try {
		tokenResponse = await fetch(GITHUB_TOKEN_URL, {
			body: new URLSearchParams({
				client_id: deps.github.clientId,
				client_secret: deps.github.clientSecret,
				code: deps.code,
				code_verifier: deps.verifier,
				redirect_uri: confirmGitHubIdentityRedirectUri(deps.baseURL),
			}),
			headers: {
				accept: "application/json",
				"content-type": "application/x-www-form-urlencoded",
				"user-agent": "Cantiara",
			},
			method: "POST",
			signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
		});
	} catch (error) {
		throw unauthorized(error);
	}
	let tokenPayload: { access_token?: unknown; error?: unknown };
	try {
		tokenPayload = (await tokenResponse.json()) as {
			access_token?: unknown;
			error?: unknown;
		};
	} catch (error) {
		throw unauthorized(error);
	}
	if (
		!(
			tokenResponse.ok &&
			typeof tokenPayload.access_token === "string" &&
			tokenPayload.access_token &&
			!tokenPayload.error
		)
	) {
		throw unauthorized();
	}
	let userResponse: Response;
	try {
		userResponse = await fetch(GITHUB_USER_URL, {
			headers: {
				accept: "application/vnd.github+json",
				authorization: `Bearer ${tokenPayload.access_token}`,
				"user-agent": "Cantiara",
			},
			method: "GET",
			signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
		});
	} catch (error) {
		throw unauthorized(error);
	}
	if (!userResponse.ok) {
		throw unauthorized();
	}
	let profile: { id?: unknown };
	try {
		profile = (await userResponse.json()) as { id?: unknown };
	} catch (error) {
		throw unauthorized(error);
	}
	if (typeof profile.id === "number" || typeof profile.id === "string") {
		return String(profile.id);
	}
	throw unauthorized();
}
