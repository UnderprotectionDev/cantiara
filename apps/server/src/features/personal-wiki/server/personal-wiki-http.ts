import type { Context } from "@cantiara/api/context";
import type { Context as HonoContext } from "hono";

import { leakNothingWikiResponse } from "./personal-wiki";

const WIKI_VISITOR_PATH = /^\/wiki(?:\/.*)?$/;

export function handleWikiVisitorGet(
	c: HonoContext,
	_context: Context
): Response | null {
	const { pathname } = new URL(c.req.url);
	if (!WIKI_VISITOR_PATH.test(pathname)) {
		return null;
	}
	const result = leakNothingWikiResponse();
	return c.body(result.body, result.status);
}
