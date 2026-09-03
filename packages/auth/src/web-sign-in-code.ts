import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@cantiara/db";

import { AccountAccessError } from "./account-access-error";
import { SIGN_IN_FAILED_MESSAGE } from "./github-login";
import { isExpiredSessionLifetime } from "./session-policy";
import { TAURI_ONE_TIME_CODE_SECONDS } from "./tauri-session";

export const WEB_SIGN_IN_CODE_PARAM = "code" as const;

const TRUSTED_RETURN_PATHS = new Set([
	"/account",
	"/completion-effects",
	"/dashboard",
	"/sessions",
]);

const CODE_IDENTIFIER_PREFIX = "web-sign-in:";

function hashWebOneTimeCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}

function generateWebOneTimeCode(): string {
	return randomBytes(32).toString("base64url");
}

function codeIdentifier(code: string): string {
	return `${CODE_IDENTIFIER_PREFIX}${hashWebOneTimeCode(code)}`;
}

export async function mintWebOneTimeCode(deps: {
	now: () => Date;
	prisma: PrismaClient;
	returnPath: string;
	sessionCookie: string;
	sessionId: string;
}): Promise<string> {
	const code = generateWebOneTimeCode();
	const now = deps.now();
	await deps.prisma.verification.create({
		data: {
			expiresAt: new Date(now.getTime() + TAURI_ONE_TIME_CODE_SECONDS * 1000),
			id: crypto.randomUUID(),
			identifier: codeIdentifier(code),
			value: JSON.stringify({
				returnPath: trustedReturnPath(deps.returnPath),
				sessionCookie: deps.sessionCookie,
				sessionId: deps.sessionId,
			}),
		},
	});
	return code;
}

export async function consumeWebOneTimeCode(deps: {
	code: string;
	now: () => Date;
	prisma: PrismaClient;
}): Promise<{ redirect: string; sessionCookie: string }> {
	const identifier = codeIdentifier(deps.code);
	const row = await deps.prisma.verification.findFirst({
		where: { identifier },
	});
	if (!row) {
		throw new AccountAccessError(401, SIGN_IN_FAILED_MESSAGE);
	}
	const consumed = await deps.prisma.verification.deleteMany({
		where: { id: row.id },
	});
	if (consumed.count !== 1) {
		throw new AccountAccessError(401, SIGN_IN_FAILED_MESSAGE);
	}
	if (row.expiresAt.getTime() <= deps.now().getTime()) {
		throw new AccountAccessError(401, SIGN_IN_FAILED_MESSAGE);
	}
	let payload: {
		returnPath?: unknown;
		sessionCookie?: unknown;
		sessionId?: unknown;
	} | null = null;
	try {
		payload = JSON.parse(row.value) as {
			returnPath?: unknown;
			sessionCookie?: unknown;
			sessionId?: unknown;
		};
	} catch {
		payload = null;
	}
	if (
		payload === null ||
		typeof payload.sessionCookie !== "string" ||
		payload.sessionCookie.length === 0 ||
		typeof payload.sessionId !== "string"
	) {
		throw new AccountAccessError(401, SIGN_IN_FAILED_MESSAGE);
	}
	const session = await deps.prisma.session.findUnique({
		where: { id: payload.sessionId },
	});
	if (
		!session ||
		isExpiredSessionLifetime({
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
			now: deps.now(),
		})
	) {
		throw new AccountAccessError(401, SIGN_IN_FAILED_MESSAGE);
	}
	return {
		redirect: trustedReturnPath(
			typeof payload.returnPath === "string" ? payload.returnPath : "/dashboard"
		),
		sessionCookie: payload.sessionCookie,
	};
}

export function webSignInReturnURL(location: string, code: string): string {
	const url = new URL(location);
	url.pathname = "/login";
	url.search = "";
	url.hash = "";
	url.searchParams.set(WEB_SIGN_IN_CODE_PARAM, code);
	return url.toString();
}

export function trustedReturnPath(path: string): string {
	return TRUSTED_RETURN_PATHS.has(path) ? path : "/dashboard";
}
