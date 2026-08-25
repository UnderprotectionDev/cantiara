import { auth } from "@cantiara/auth";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	context: HonoContext;
}

export async function createContext({ context }: CreateContextOptions) {
	const request = context.req.raw;
	const session = await auth.accountAccess.current(request);
	return {
		auth: null,
		request,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
