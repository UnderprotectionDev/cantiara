import {
	CLIENT_SHELL_COPY,
	issueMainFlowFailure,
	type MainFlowFailurePackage,
	writeMainFlowFailureLog,
} from "@cantiara/api/client-shell-failure";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

import type { AppRouter } from "../../../routes";
import { attachMainFlowFailure } from "./main-flow-failure";

export interface UnmatchedRpcEnvelope {
	json: {
		code: "NOT_FOUND";
		data: MainFlowFailurePackage;
		defined: false;
		message: string;
		status: 404;
	};
	status: 404;
}

function createApiHandler(router: AppRouter) {
	return new OpenAPIHandler(router, {
		clientInterceptors: [attachMainFlowFailure],
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
	});
}

function createRpcHandler(router: AppRouter) {
	return new RPCHandler(router, {
		clientInterceptors: [attachMainFlowFailure],
	});
}

interface ProductHandlers {
	apiHandler: ReturnType<typeof createApiHandler>;
	keys: string;
	router: AppRouter;
	rpcHandler: ReturnType<typeof createRpcHandler>;
}

let cached: ProductHandlers | undefined;

function handlerKeys(router: AppRouter): string {
	return Object.keys(router).sort().join(",");
}

export function productHandlersFor(router: AppRouter): ProductHandlers {
	const keys = handlerKeys(router);
	if (cached && cached.router === router && cached.keys === keys) {
		return cached;
	}
	const next = {
		apiHandler: createApiHandler(router),
		keys,
		router,
		rpcHandler: createRpcHandler(router),
	};
	cached = next;
	return next;
}

export function rpcHandlerFor(router: AppRouter) {
	return productHandlersFor(router).rpcHandler;
}

export function apiHandlerFor(router: AppRouter) {
	return productHandlersFor(router).apiHandler;
}

export function unmatchedRpcEnvelope(log?: unknown): UnmatchedRpcEnvelope {
	const failure = issueMainFlowFailure(
		{
			reason: CLIENT_SHELL_COPY.failed,
			written: false,
		},
		{
			write: (record) => {
				writeMainFlowFailureLog(log, record);
			},
		}
	);
	return {
		json: {
			code: "NOT_FOUND",
			data: failure,
			defined: false,
			message: failure.reason,
			status: 404,
		},
		status: 404,
	};
}
