import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@cantiara/db";

import {
	AccountAccessError,
	SESSION_WRITE_UNAUTHORIZED_MESSAGE,
} from "./account-access-error";
import { SIGN_IN_FAILED_MESSAGE } from "./github-login";
import { isExpiredSessionLifetime } from "./session-policy";
import { TAURI_ONE_TIME_CODE_SECONDS } from "./tauri-session";

const CODE_IDENTIFIER_PREFIX = "tauri-sign-in:";

function hashTauriOneTimeCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}

function generateTauriOneTimeCode(): string {
	return randomBytes(32).toString("base64url");
}

function codeIdentifier(code: string): string {
	return `${CODE_IDENTIFIER_PREFIX}${hashTauriOneTimeCode(code)}`;
}

export async function mintTauriOneTimeCode(deps: {
	now: () => Date;
	prisma: PrismaClient;
	sessionId: string;
}): Promise<string> {
	const code = generateTauriOneTimeCode();
	const now = deps.now();
	await deps.prisma.verification.create({
		data: {
			expiresAt: new Date(now.getTime() + TAURI_ONE_TIME_CODE_SECONDS * 1000),
			id: crypto.randomUUID(),
			identifier: codeIdentifier(code),
			value: deps.sessionId,
		},
	});
	return code;
}

export async function consumeTauriOneTimeCode(deps: {
	code: string;
	now: () => Date;
	prisma: PrismaClient;
}): Promise<{ token: string }> {
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
	const session = await deps.prisma.session.findUnique({
		where: { id: row.value },
	});
	if (
		!session ||
		isExpiredSessionLifetime({
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
			now: deps.now(),
		})
	) {
		throw new AccountAccessError(401, SESSION_WRITE_UNAUTHORIZED_MESSAGE);
	}
	return { token: session.token };
}
