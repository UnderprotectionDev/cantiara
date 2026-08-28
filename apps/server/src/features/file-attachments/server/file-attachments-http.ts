import type { Context } from "@cantiara/api/context";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import type { Context as HonoContext } from "hono";

import { readAccessibleFileBytes } from "./file-attachments";

const CONTENT_PATH = /^\/api\/file-attachments\/([^/]+)\/versions\/([^/]+)$/;

export async function handleFileAttachmentContent(
	c: HonoContext,
	context: Context
): Promise<Response | null> {
	const match = CONTENT_PATH.exec(new URL(c.req.url).pathname);
	if (!match) {
		return null;
	}
	const userId = context.session?.user?.id;
	if (!userId) {
		return c.body(null, 401);
	}
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		return c.body(null, 401);
	}
	const [_full, fileAttachmentId, versionId] = match;
	if (!(fileAttachmentId && versionId)) {
		return c.body(null, 404);
	}
	const body = await readAccessibleFileBytes(getPrismaClient(), {
		fileAttachmentId,
		versionId,
		workspaceId: access.workspaceId,
	});
	if (!body) {
		return c.body(null, 404);
	}
	return new Response(Buffer.from(body.bytes), {
		headers: {
			"Content-Disposition": `attachment; filename="${body.filename.replaceAll('"', "")}"`,
			"Content-Type": body.mimeType,
		},
		status: 200,
	});
}
