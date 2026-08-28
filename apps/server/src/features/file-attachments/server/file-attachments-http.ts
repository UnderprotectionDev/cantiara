import type { Context } from "@cantiara/api/context";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import type { Context as HonoContext } from "hono";

import {
	readAccessibleFileBytes,
	readIsolatedPreviewBytes,
} from "./file-attachments";
import { THUMBNAIL_SIZE, type ThumbnailSize } from "./file-attachments-model";
import { isolatedContentHeaders } from "./file-attachments-preview";

const CONTENT_PATH =
	/^\/api\/file-attachments\/([^/]+)\/versions\/([^/]+)(?:\/(preview|thumbnails\/(small|medium)))?$/;

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
	const [_full, fileAttachmentId, versionId, extra, thumbnailSize] = match;
	if (!(fileAttachmentId && versionId)) {
		return c.body(null, 404);
	}
	if (extra === "preview") {
		const body = await readIsolatedPreviewBytes(getPrismaClient(), {
			fileAttachmentId,
			kind: "preview",
			versionId,
			workspaceId: access.workspaceId,
		});
		if (!body) {
			return c.body(null, 404);
		}
		return new Response(Buffer.from(body.bytes), {
			headers: isolatedContentHeaders({
				disposition: "inline",
				filename: body.filename,
				mimeType: body.mimeType,
			}),
			status: 200,
		});
	}
	if (
		thumbnailSize === THUMBNAIL_SIZE.small ||
		thumbnailSize === THUMBNAIL_SIZE.medium
	) {
		const size: ThumbnailSize = thumbnailSize;
		const body = await readIsolatedPreviewBytes(getPrismaClient(), {
			fileAttachmentId,
			kind: size,
			versionId,
			workspaceId: access.workspaceId,
		});
		if (!body) {
			return c.body(null, 404);
		}
		return new Response(Buffer.from(body.bytes), {
			headers: isolatedContentHeaders({
				disposition: "inline",
				filename: body.filename,
				mimeType: body.mimeType,
			}),
			status: 200,
		});
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
		headers: isolatedContentHeaders({
			disposition: "attachment",
			filename: body.filename,
			mimeType: body.mimeType,
		}),
		status: 200,
	});
}
