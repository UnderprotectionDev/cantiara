import { getPrismaClient } from "@cantiara/db";
import { env } from "@cantiara/env/server";

import { createAuth } from "./create-auth";

export const auth = createAuth({
	baseURL: env.BETTER_AUTH_URL,
	github: {
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET,
	},
	prisma: getPrismaClient(),
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.CORS_ORIGIN],
});
