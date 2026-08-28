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
import { env } from "@cantiara/env/server";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import {
	apiHandlerFor,
	rpcHandlerFor,
	unmatchedRpcEnvelope,
} from "./features/web-macos-client/server/rpc-dispatch";

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

export const app = new Hono<EvlogVariables>();

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

app.use("/*", async (c, next) => {
	const { appRouter: liveRouter } = await import("./routes");
	const liveRpcHandler = rpcHandlerFor(liveRouter);
	const liveApiHandler = apiHandlerFor(liveRouter);
	const context = {
		...(await createContext({ context: c })),
		log: c.get("log"),
	};

	const rpcResult = await liveRpcHandler.handle(c.req.raw, {
		context,
		prefix: "/rpc",
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	if (c.req.path === "/rpc" || c.req.path.startsWith("/rpc/")) {
		const envelope = unmatchedRpcEnvelope(c.get("log"));
		return c.json({ json: envelope.json }, envelope.status);
	}

	const apiResult = await liveApiHandler.handle(c.req.raw, {
		context,
		prefix: "/api-reference",
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => c.text("OK"));
