import {
	issueMainFlowFailure,
	writeMainFlowFailureLog,
} from "@cantiara/api/client-shell-failure";
import { createContext } from "@cantiara/api/context";
import { DESKTOP_API_HEADER } from "@cantiara/api/desktop-api-window";
import {
	AccountAccessError,
	allowProductCorsOrigin,
	assertCookieCsrf,
	auth,
	productCorsOrigins,
} from "@cantiara/auth";
import { resetPrismaClientCache } from "@cantiara/db";
import { env } from "@cantiara/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { initLogger } from "evlog";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { attachMainFlowFailure } from "./features/web-macos-client/server/main-flow-failure";
import { appRouter } from "./routes";

initLogger({
	env: { service: "cantiara-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

const app = new Hono<EvlogVariables>();

app.use(
	evlog({
		drain: process.env.NODE_ENV === "production" ? undefined : createFsDrain(),
	})
);
app.use("*", async (c, next) => {
	await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
	await next();
});

app.use(
	"/*",
	cors({
		allowHeaders: ["Content-Type", "Authorization", DESKTOP_API_HEADER],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		origin: (origin) => allowProductCorsOrigin(origin, env.CORS_ORIGIN) ?? "",
	})
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use("/rpc/*", async (c, next) => {
	const { method } = c.req;
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
		await next();
		return;
	}
	try {
		assertCookieCsrf(c.req.raw, productCorsOrigins(env.CORS_ORIGIN));
	} catch (error) {
		if (error instanceof AccountAccessError && error.status === 403) {
			const failure = issueMainFlowFailure(
				{
					reason: error.message,
					written: false,
				},
				{
					write: (record) => {
						writeMainFlowFailureLog(c.get("log"), record);
					},
				}
			);
			return c.json(
				{
					code: "FORBIDDEN",
					data: failure,
					defined: true,
					message: failure.reason,
					status: 403,
				},
				403
			);
		}
		throw error;
	}
	await next();
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	clientInterceptors: [attachMainFlowFailure],
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	clientInterceptors: [attachMainFlowFailure],
});

app.use("/*", async (c, next) => {
	const context = {
		...(await createContext({ context: c })),
		log: c.get("log"),
	};

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		context,
		prefix: "/rpc",
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		context,
		prefix: "/api-reference",
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => c.text("OK"));

export default app;

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		resetPrismaClientCache();
	});
}
