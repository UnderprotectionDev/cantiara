import { getPrismaClient } from "@cantiara/db";
import { env } from "@cantiara/env/server";

import { createPrismaAuditLog } from "./audit-log";
import { createAuth } from "./create-auth";
import {
	createPostgresSecurityEventLog,
	LOCAL_SECURITY_EVENT_LOG_URL,
} from "./security-event-log";

export const auth = createAuth({
	auditLog: createPrismaAuditLog(getPrismaClient()),
	baseURL: env.BETTER_AUTH_URL,
	github: {
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET,
	},
	prisma: getPrismaClient(),
	secret: env.BETTER_AUTH_SECRET,
	securityEventLog: createPostgresSecurityEventLog(
		securityEventLogConnectionString()
	),
	trustedOrigins: [env.CORS_ORIGIN],
});

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
