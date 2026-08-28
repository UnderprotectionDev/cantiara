import { getPrismaClient, readGeneratedClientStamp } from "@cantiara/db";
import { env } from "@cantiara/env/server";

import { createPrismaAuditLog } from "./audit-log";
import { createAuth } from "./create-auth";
import { rebindWhenStampChanges } from "./rebind-when-stamp-changes";
import {
	createPostgresSecurityEventLog,
	LOCAL_SECURITY_EVENT_LOG_URL,
} from "./security-event-log";
import { productTrustedOrigins } from "./tauri-session";

function createProductAuth() {
	const prisma = getPrismaClient();
	return createAuth({
		auditLog: createPrismaAuditLog(prisma),
		baseURL: env.BETTER_AUTH_URL,
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		},
		prisma,
		secret: env.BETTER_AUTH_SECRET,
		securityEventLog: createPostgresSecurityEventLog(
			securityEventLogConnectionString()
		),
		trustedOrigins: productTrustedOrigins(env.CORS_ORIGIN),
	});
}

export const auth = rebindWhenStampChanges(
	createProductAuth,
	readGeneratedClientStamp
);

function securityEventLogConnectionString(): string {
	if (env.SECURITY_EVENT_LOG_DATABASE_URL) {
		return env.SECURITY_EVENT_LOG_DATABASE_URL;
	}
	if (env.NODE_ENV === "production") {
		throw new Error(
			"SECURITY_EVENT_LOG_DATABASE_URL is required in production"
		);
	}
	return LOCAL_SECURITY_EVENT_LOG_URL;
}
