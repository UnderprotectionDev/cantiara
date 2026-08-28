/**
 * File Attachments seam — accept/reject, quota, atomic finalize,
 * version pins, retry idempotency, isolated preview, derived Gallery thumbnails,
 * Capture attachment promotion, marking layer, and location-bound Work origin.
 * Synthetic `Dosya sınırları` fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Dosya güvenliği).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { envelopeSeal } from "../../capture-triage/server/capture-staging-crypto";
import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	cancelFileUpload,
	discardCaptureStaging,
	finalizeFileUpload,
	getFileAttachment,
	getFileQuota,
	listFileAttachmentRelations,
	listFileAttachments,
	permanentlyDeleteFileAttachment,
	pinFileVersion,
	previewUploadNewVersion,
	promoteCaptureAttachment,
	putStagingBytes,
	readAccessibleFileBytes,
	readIsolatedPreviewBytes,
	relateFileAttachment,
	setFileLifecycle,
	stageFileUpload,
	sweepExpiredFileStaging,
	zipCanEnterExternalSurface,
} from "./file-attachments";
import {
	createMemoryCaptureStagingSource,
	createPrismaCaptureStagingSource,
} from "./file-attachments-capture-staging";
import type { ImageDerivativeEngine } from "./file-attachments-derivatives";
import {
	appendMark,
	approveSharePublishItem,
	confirmLocationWorkBind,
	getMarkingLayer,
	listSharePublishItems,
	previewLocationWorkBind,
	undoMark,
} from "./file-attachments-marking";
import {
	CSV_PREVIEW_MAX_ROWS,
	contentPathFor,
	EXTERNAL_SURFACE_AUDIENCE,
	FILE_ATTACHMENT_COPY,
	FILE_ATTACHMENT_QUOTA,
	FILE_KIND,
	FILE_LIFECYCLE,
	FILE_PIN_KIND,
	FILE_TYPE_INTEGRITY_BUDGET_MS,
	IMAGE_DERIVATIVE_LIMITS,
	LOCATION_SURFACE,
	MARKING_TOOLS,
	ORIGIN_LOCATION_KIND,
	PREVIEW_MODE,
	PREVIEW_STATUS,
	previewPathFor,
	SHARE_PUBLISH_ITEM_KIND,
	STAGING_TTL_MS,
	THUMBNAIL_SIZE,
	thumbnailPathFor,
} from "./file-attachments-model";
import { fileCanEnterExternalSurface } from "./file-attachments-preview";
import { sniffFileBytes } from "./file-attachments-sniff";
import {
	createFailingPromoteStore,
	createPrismaFileObjectStore,
} from "./file-attachments-store";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const PNG_BYTES = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
		"base64"
	)
);

const HTML_BYTES = new TextEncoder().encode("<html><body>run</body></html>");
const RAW_OBJECT_URL = /r2\.|amazonaws|cloudflarestorage|cdn\./i;
const IFRAME_MARK = /<iframe/i;
const SUPPORT_REFERENCE = /^CANT-[0-9A-F]{8}$/;
const SECRET_FREE_FAILURE = /html><body|BETTER_AUTH|r2\./i;

async function seedWorkspace(prisma: PrismaClient) {
	const user = await prisma.user.create({
		data: {
			email: `founder-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: crypto.randomUUID(),
			name: "Founder",
		},
	});
	const workspace = await prisma.workspace.create({
		data: {
			id: crypto.randomUUID(),
			name: "Workspace",
			ownerId: user.id,
		},
	});
	return { actorId: user.id, workspaceId: workspace.id };
}

async function openProject(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Atlas",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

function uploadCommand(input: {
	actorId: string;
	declaredMime?: string;
	filename?: string;
	idempotencyKey: string;
	projectId?: string;
	targetFileAttachmentId?: string;
	workspaceId: string;
	byteOffset?: number;
}) {
	return {
		actorId: input.actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			byteOffset: input.byteOffset,
			declaredMime: input.declaredMime ?? "image/png",
			filename: input.filename ?? "shot.png",
			scope: input.projectId
				? { kind: "project" as const, projectId: input.projectId }
				: { kind: "personal-wiki" as const },
			targetFileAttachmentId: input.targetFileAttachmentId,
		},
		workspaceId: input.workspaceId,
	};
}

async function commitPng(
	prisma: PrismaClient,
	input: {
		actorId: string;
		bytes?: Uint8Array;
		filename?: string;
		idempotencyKey: string;
		projectId?: string;
		targetFileAttachmentId?: string;
		workspaceId: string;
	},
	deps?: Parameters<typeof stageFileUpload>[2]
) {
	const command = uploadCommand({
		actorId: input.actorId,
		filename: input.filename,
		idempotencyKey: input.idempotencyKey,
		projectId: input.projectId,
		targetFileAttachmentId: input.targetFileAttachmentId,
		workspaceId: input.workspaceId,
	});
	const staged = await stageFileUpload(prisma, command, deps);
	if (staged.status !== "staged") {
		return staged;
	}
	const put = await putStagingBytes(
		prisma,
		{
			bytes: input.bytes ?? PNG_BYTES,
			operationId: staged.operation.operationId,
		},
		deps
	);
	if (put.status !== "staged") {
		return put;
	}
	return await finalizeFileUpload(prisma, command, deps);
}

async function commitTyped(
	prisma: PrismaClient,
	input: {
		actorId: string;
		bytes: Uint8Array;
		filename: string;
		idempotencyKey: string;
		mime: string;
		projectId?: string;
		workspaceId: string;
	},
	deps?: Parameters<typeof stageFileUpload>[2]
) {
	const command = uploadCommand({
		actorId: input.actorId,
		declaredMime: input.mime,
		filename: input.filename,
		idempotencyKey: input.idempotencyKey,
		projectId: input.projectId,
		workspaceId: input.workspaceId,
	});
	const staged = await stageFileUpload(prisma, command, deps);
	if (staged.status !== "staged") {
		return staged;
	}
	const put = await putStagingBytes(
		prisma,
		{
			bytes: input.bytes,
			operationId: staged.operation.operationId,
		},
		deps
	);
	if (put.status !== "staged") {
		return put;
	}
	return await finalizeFileUpload(prisma, command, deps);
}

async function commitTypedCases(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	workspaceId: string,
	cases: readonly {
		bytes: Uint8Array;
		filename: string;
		kind: string;
		mime: string;
		mode: string;
		sniff?: { ext: string; mime: string };
	}[],
	index = 0
): Promise<Awaited<ReturnType<typeof commitTyped>>[]> {
	const file = cases[index];
	if (!file) {
		return [];
	}
	const outcome = await commitTyped(
		prisma,
		{
			actorId,
			bytes: file.bytes,
			filename: file.filename,
			idempotencyKey: file.filename,
			mime: file.mime,
			projectId,
			workspaceId,
		},
		{
			sniff: file.sniff ? () => Promise.resolve(file.sniff) : undefined,
		}
	);
	const rest = await commitTypedCases(
		prisma,
		actorId,
		projectId,
		workspaceId,
		cases,
		index + 1
	);
	return [outcome, ...rest];
}

describe("File Attachments", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.fileObjectBlob.deleteMany();
		await prisma.fileImageDerivative.deleteMany();
		await prisma.fileAttachmentStaging.deleteMany();
		await prisma.typedRelation.deleteMany();
		await prisma.fileAttachment.deleteMany();
		await prisma.captureStagingObject.deleteMany();
		await prisma.captureInboxItem.deleteMany();
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("finalizes a File Attachment in exactly one Project or Personal Wiki", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const projectFile = await commitPng(prisma, {
			actorId,
			idempotencyKey: "png-project",
			projectId: project.id,
			workspaceId,
		});
		expect(projectFile.status).toBe("committed");
		if (projectFile.status !== "committed") {
			return;
		}
		expect(projectFile.file.scope).toEqual({
			kind: "project",
			projectId: project.id,
		});
		expect(projectFile.file.title).toBe("shot.png");
		expect(projectFile.file.kind).toBe(FILE_KIND.image);
		const wiki = await commitPng(prisma, {
			actorId,
			filename: "wiki.png",
			idempotencyKey: "png-wiki",
			workspaceId,
		});
		expect(wiki.status).toBe("committed");
		if (wiki.status !== "committed") {
			return;
		}
		expect(wiki.file.scope).toEqual({ kind: "personal-wiki" });
		const listed = await listFileAttachments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		expect(listed.map((item) => item.id)).toEqual([projectFile.file.id]);
	});

	it("rejects forbidden types and MIME mismatch before a visible File Attachment exists", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const html = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				declaredMime: "text/html",
				filename: "page.html",
				idempotencyKey: "html",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(html).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.typeRejected,
			status: "rejected",
		});
		const staged = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				declaredMime: "image/jpeg",
				filename: "photo.jpg",
				idempotencyKey: "mismatch",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		const put = await putStagingBytes(prisma, {
			bytes: PNG_BYTES,
			operationId: staged.operation.operationId,
		});
		expect(put).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.mimeMismatch,
			status: "rejected",
		});
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
	});

	it("counts Active Archive and Trash toward quota and frees only after permanent delete", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const limits = {
			maxOriginalBytes: PNG_BYTES.byteLength * 2,
			maxVersions: 2,
		};
		const first = await commitPng(
			prisma,
			{
				actorId,
				idempotencyKey: "q1",
				projectId: project.id,
				workspaceId,
			},
			{ quota: limits }
		);
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			return;
		}
		await setFileLifecycle(prisma, {
			fileAttachmentId: first.file.id,
			lifecycle: FILE_LIFECYCLE.archived,
		});
		const second = await commitPng(
			prisma,
			{
				actorId,
				filename: "two.png",
				idempotencyKey: "q2",
				projectId: project.id,
				workspaceId,
			},
			{ quota: limits }
		);
		expect(second.status).toBe("committed");
		if (second.status !== "committed") {
			return;
		}
		await setFileLifecycle(prisma, {
			fileAttachmentId: second.file.id,
			lifecycle: FILE_LIFECYCLE.trash,
		});
		const blocked = await commitPng(
			prisma,
			{
				actorId,
				filename: "three.png",
				idempotencyKey: "q3",
				projectId: project.id,
				workspaceId,
			},
			{ quota: limits }
		);
		expect(blocked).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.quotaExceeded,
			status: "rejected",
		});
		const readable = await getFileAttachment(prisma, {
			id: first.file.id,
			workspaceId,
		});
		expect(readable?.id).toBe(first.file.id);
		const quota = await getFileQuota(prisma, workspaceId, { quota: limits });
		expect(quota.usedVersions).toBe(2);
		expect(quota.warn).toBe(true);
		expect(quota.warning).toBe(FILE_ATTACHMENT_COPY.quotaWarning);
		expect(quota.maxOriginalBytes).toBe(limits.maxOriginalBytes);
		await permanentlyDeleteFileAttachment(prisma, first.file.id);
		const third = await commitPng(
			prisma,
			{
				actorId,
				filename: "three.png",
				idempotencyKey: "q3-after-delete",
				projectId: project.id,
				workspaceId,
			},
			{ quota: limits }
		);
		expect(third.status).toBe("committed");
	});

	it("keeps the Workspace 25 GB and 20_000 version ceilings in the quota contract", () => {
		expect(FILE_ATTACHMENT_QUOTA).toEqual({
			maxOriginalBytes: 25 * 1024 * 1024 * 1024,
			maxVersions: 20_000,
			warnRatio: 0.8,
		});
	});

	it("leaves no visible File Attachment when finalize cannot promote the object", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const deps = {
			store: createFailingPromoteStore(createPrismaFileObjectStore()),
		};
		const failed = await commitPng(
			prisma,
			{
				actorId,
				idempotencyKey: "fail-promote",
				projectId: project.id,
				workspaceId,
			},
			deps
		);
		expect(failed.status).toBe("rejected");
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const dangling = await prisma.fileAttachment.findMany();
		expect(dangling).toEqual([]);
	});

	it("replays the same key and fingerprint and conflicts when the payload changes", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const command = uploadCommand({
			actorId,
			idempotencyKey: "same-key",
			projectId: project.id,
			workspaceId,
		});
		const first = await commitPng(prisma, {
			actorId,
			idempotencyKey: "same-key",
			projectId: project.id,
			workspaceId,
		});
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			return;
		}
		const replay = await finalizeFileUpload(prisma, command);
		expect(replay.status).toBe("replayed");
		if (replay.status !== "replayed") {
			return;
		}
		expect(replay.file.id).toBe(first.file.id);
		const listed = await listFileAttachments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		expect(listed).toHaveLength(1);
		const conflict = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				filename: "other.png",
				idempotencyKey: "same-key",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(conflict.status).toBe("conflict");
	});

	it("restarts from byte zero and refuses ranged resume", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const ranged = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				byteOffset: 12,
				idempotencyKey: "resume",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(ranged).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.restartFromByteZero,
			status: "rejected",
		});
		const staged = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				idempotencyKey: "drop",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		const incomplete = await finalizeFileUpload(
			prisma,
			uploadCommand({
				actorId,
				idempotencyKey: "drop",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(incomplete).toMatchObject({
			reason: "bytes-incomplete",
			status: "rejected",
		});
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const restarted = await putStagingBytes(prisma, {
			bytes: PNG_BYTES,
			operationId: staged.operation.operationId,
		});
		expect(restarted.status).toBe("staged");
		const offsetPut = await putStagingBytes(prisma, {
			byteOffset: 4,
			bytes: PNG_BYTES,
			operationId: staged.operation.operationId,
		});
		expect(offsetPut).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.restartFromByteZero,
			status: "rejected",
		});
	});

	it("adds a new version on Upload new version and keeps prior pins on the original version", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "v1",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		await pinFileVersion(prisma, {
			kind: FILE_PIN_KIND.content,
			targetId: "evidence-1",
			versionId: created.file.currentVersion.id,
		});
		await pinFileVersion(prisma, {
			kind: FILE_PIN_KIND.location,
			targetId: "origin-1",
			versionId: created.file.currentVersion.id,
		});
		await pinFileVersion(prisma, {
			kind: FILE_PIN_KIND.publish,
			targetId: "snapshot-1",
			versionId: created.file.currentVersion.id,
		});
		await relateFileAttachment(prisma, {
			fileAttachmentId: created.file.id,
			kind: "related",
			targetId: "work-1",
		});
		const preview = await previewUploadNewVersion(prisma, {
			declaredMime: "image/png",
			fileAttachmentId: created.file.id,
			filename: "shot-v2.png",
		});
		expect(preview).toEqual({
			currentVersion: { filename: "shot.png", versionNumber: 1 },
			incoming: { declaredMime: "image/png", filename: "shot-v2.png" },
			target: { id: created.file.id, title: "shot.png" },
		});
		const next = await commitPng(prisma, {
			actorId,
			filename: "shot-v2.png",
			idempotencyKey: "v2",
			projectId: project.id,
			targetFileAttachmentId: created.file.id,
			workspaceId,
		});
		expect(next.status).toBe("committed");
		if (next.status !== "committed") {
			return;
		}
		expect(next.file.versions).toHaveLength(2);
		expect(next.file.currentVersion.filename).toBe("shot-v2.png");
		expect(next.file.versions[0]?.pins).toEqual([
			{ kind: FILE_PIN_KIND.content, targetId: "evidence-1" },
			{ kind: FILE_PIN_KIND.location, targetId: "origin-1" },
			{ kind: FILE_PIN_KIND.publish, targetId: "snapshot-1" },
		]);
		expect(next.file.currentVersion.pins).toEqual([]);
		expect(await listFileAttachmentRelations(prisma, next.file.id)).toEqual([
			{ kind: "related", targetId: "work-1" },
		]);
		expect(zipCanEnterExternalSurface(FILE_KIND.zip)).toBe(false);
		expect(zipCanEnterExternalSurface(FILE_KIND.image)).toBe(true);
	});

	it("returns a product content path and never a raw object URL", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "url",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.file.contentPath).toBe(
			contentPathFor(created.file.id, created.file.currentVersion.id)
		);
		expect(JSON.stringify(created.file)).not.toMatch(RAW_OBJECT_URL);
		const body = await readAccessibleFileBytes(prisma, {
			fileAttachmentId: created.file.id,
			versionId: created.file.currentVersion.id,
			workspaceId,
		});
		expect(body?.bytes).toEqual(PNG_BYTES);
		expect(created.file.currentVersion.kind).not.toBe("executed-zip");
		const other = await seedWorkspace(prisma);
		expect(
			await getFileAttachment(prisma, {
				id: created.file.id,
				workspaceId: other.workspaceId,
			})
		).toBeNull();
		expect(
			await readAccessibleFileBytes(prisma, {
				fileAttachmentId: created.file.id,
				versionId: created.file.currentVersion.id,
				workspaceId: other.workspaceId,
			})
		).toBeNull();
	});

	it("sweeps an orphan temporary object after TTL and refuses Cancel after Finalizing", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const started = Date.now();
		const staged = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				idempotencyKey: "ttl",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		await putStagingBytes(prisma, {
			bytes: PNG_BYTES,
			operationId: staged.operation.operationId,
		});
		const swept = await sweepExpiredFileStaging(prisma, {
			clock: { now: new Date(Date.now() + STAGING_TTL_MS + 1) },
		});
		expect(swept).toBe(1);
		expect(await prisma.fileObjectBlob.findMany()).toEqual([]);
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const live = await stageFileUpload(
			prisma,
			uploadCommand({
				actorId,
				idempotencyKey: "finalizing",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(live.status).toBe("staged");
		if (live.status !== "staged") {
			return;
		}
		await putStagingBytes(prisma, {
			bytes: PNG_BYTES,
			operationId: live.operation.operationId,
		});
		const committed = await finalizeFileUpload(
			prisma,
			uploadCommand({
				actorId,
				idempotencyKey: "finalizing",
				projectId: project.id,
				workspaceId,
			})
		);
		expect(committed.status).toBe("committed");
		const cancel = await cancelFileUpload(prisma, live.operation.operationId);
		expect(cancel).toEqual({
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: FILE_ATTACHMENT_COPY.finalizing,
			},
		});
		const elapsed = Date.now() - started;
		expect(elapsed).toBeLessThan(FILE_TYPE_INTEGRITY_BUDGET_MS.p99);
	});

	it("finishes 25 MB type and integrity classification inside the performance budget", async () => {
		const payload = new Uint8Array(25 * 1024 * 1024);
		payload.set(PNG_BYTES, 0);
		const started = Date.now();
		const sniffed = await sniffFileBytes(payload);
		expect(sniffed).toEqual({ ext: "png", mime: "image/png" });
		expect(Date.now() - started).toBeLessThan(
			FILE_TYPE_INTEGRITY_BUDGET_MS.p99
		);
		expect(HTML_BYTES.byteLength).toBeGreaterThan(0);
	});

	it("previews the type matrix in an isolated product path and never unpacks ZIP", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const csvRows = Array.from({ length: CSV_PREVIEW_MAX_ROWS + 10 }, (_, i) =>
			i === 0 ? "name,count" : `row-${i},${i}`
		).join("\n");
		const cases = [
			{
				bytes: PNG_BYTES,
				filename: "shot.png",
				kind: FILE_KIND.image,
				mime: "image/png",
				mode: PREVIEW_MODE.visual,
			},
			{
				bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n"),
				filename: "spec.pdf",
				kind: FILE_KIND.pdf,
				mime: "application/pdf",
				mode: PREVIEW_MODE.paged,
				sniff: { ext: "pdf", mime: "application/pdf" },
			},
			{
				bytes: new TextEncoder().encode(csvRows),
				filename: "dump.csv",
				kind: FILE_KIND.csv,
				mime: "text/csv",
				mode: PREVIEW_MODE.csvRows,
			},
			{
				bytes: new TextEncoder().encode("<script>alert(1)</script>\nlog line"),
				filename: "notes.txt",
				kind: FILE_KIND.text,
				mime: "text/plain",
				mode: PREVIEW_MODE.plainText,
			},
			{
				bytes: new TextEncoder().encode("ID3audio"),
				filename: "clip.mp3",
				kind: FILE_KIND.audio,
				mime: "audio/mpeg",
				mode: PREVIEW_MODE.playback,
				sniff: { ext: "mp3", mime: "audio/mpeg" },
			},
			{
				bytes: new TextEncoder().encode("ftypisomvideo"),
				filename: "clip.mp4",
				kind: FILE_KIND.video,
				mime: "video/mp4",
				mode: PREVIEW_MODE.playback,
				sniff: { ext: "mp4", mime: "video/mp4" },
			},
			{
				bytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]),
				filename: "bundle.zip",
				kind: FILE_KIND.zip,
				mime: "application/zip",
				mode: PREVIEW_MODE.downloadOnly,
				sniff: { ext: "zip", mime: "application/zip" },
			},
		] as const;
		const committed = await commitTypedCases(
			prisma,
			actorId,
			project.id,
			workspaceId,
			cases
		);
		for (const [index, outcome] of committed.entries()) {
			const file = cases[index];
			if (!file) {
				return;
			}
			expect(outcome.status).toBe("committed");
			if (outcome.status !== "committed") {
				return;
			}
			const { preview } = outcome.file.currentVersion;
			expect(preview.mode).toBe(file.mode);
			expect(preview.autoplay).toBe(false);
			expect(preview.unpack).toBe(false);
			expect(JSON.stringify(outcome.file)).not.toMatch(RAW_OBJECT_URL);
			if (file.kind === FILE_KIND.zip) {
				expect(preview.previewPath).toBeNull();
				expect(
					fileCanEnterExternalSurface({
						audience: EXTERNAL_SURFACE_AUDIENCE.public,
						kind: FILE_KIND.zip,
					})
				).toEqual({
					allowed: false,
					reason: FILE_ATTACHMENT_COPY.unscannedZip,
				});
				expect(
					fileCanEnterExternalSurface({
						audience: EXTERNAL_SURFACE_AUDIENCE.linkLimited,
						kind: FILE_KIND.zip,
					}).allowed
				).toBe(false);
			} else {
				expect(preview.previewPath).toBe(
					previewPathFor(outcome.file.id, outcome.file.currentVersion.id)
				);
			}
			if (file.kind === FILE_KIND.csv) {
				expect(preview.csvRows).toHaveLength(CSV_PREVIEW_MAX_ROWS);
			}
			if (file.kind === FILE_KIND.text) {
				expect(preview.textExcerpt).toContain("log line");
				expect(preview.textExcerpt).not.toMatch(IFRAME_MARK);
			}
			if (file.kind === FILE_KIND.audio || file.kind === FILE_KIND.video) {
				expect(preview.playback).toEqual({
					autoplay: false,
					fullscreen: true,
					loopOptional: true,
					speed: true,
				});
			}
		}
		const zipOutcome = committed.find(
			(outcome) =>
				outcome.status === "committed" && outcome.file.kind === FILE_KIND.zip
		);
		if (zipOutcome?.status === "committed") {
			expect(
				await readIsolatedPreviewBytes(prisma, {
					fileAttachmentId: zipOutcome.file.id,
					kind: "preview",
					versionId: zipOutcome.file.currentVersion.id,
					workspaceId,
				})
			).toBeNull();
		}
		const listed = await listFileAttachments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		const csvList = listed.find((item) => item.kind === FILE_KIND.csv);
		expect(csvList?.currentVersion.preview.csvRows).toBeNull();
		const imageList = listed.find((item) => item.kind === FILE_KIND.image);
		expect(imageList?.currentVersion.preview.galleryThumbnailPath).not.toBe(
			imageList?.contentPath
		);
	});

	it("derives Gallery thumbnails idempotently from the original fingerprint without EXIF or a second File Attachment", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const gpsPng = Uint8Array.from(
			Buffer.concat([
				Buffer.from(PNG_BYTES),
				Buffer.from("GPSLatitude iPhone Make"),
			])
		);
		const cleanThumb = new TextEncoder().encode("WEBP-THUMB-NO-EXIF");
		const engine: ImageDerivativeEngine = {
			produce: (bytes) => {
				expect(Buffer.from(bytes).includes(Buffer.from("GPSLatitude"))).toBe(
					true
				);
				return Promise.resolve({
					medium: cleanThumb,
					small: cleanThumb,
					status: "ok",
				});
			},
		};
		const first = await commitPng(
			prisma,
			{
				actorId,
				bytes: gpsPng,
				filename: "gps.png",
				idempotencyKey: "thumb-1",
				projectId: project.id,
				workspaceId,
			},
			{
				derivatives: engine,
				sniff: () => Promise.resolve({ ext: "png", mime: "image/png" }),
			}
		);
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			return;
		}
		const { preview } = first.file.currentVersion;
		expect(preview.status).toBe(PREVIEW_STATUS.ready);
		expect(preview.galleryThumbnailPath).toBe(
			thumbnailPathFor(
				first.file.id,
				first.file.currentVersion.id,
				THUMBNAIL_SIZE.small
			)
		);
		expect(preview.galleryThumbnailPath).not.toBe(first.file.contentPath);
		expect(preview.mediumThumbnailPath).not.toBe(first.file.contentPath);
		const listed = await listFileAttachments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		expect(listed[0]?.currentVersion.preview.galleryThumbnailPath).not.toBe(
			listed[0]?.contentPath
		);
		const original = await readAccessibleFileBytes(prisma, {
			fileAttachmentId: first.file.id,
			versionId: first.file.currentVersion.id,
			workspaceId,
		});
		expect(original?.bytes).toEqual(gpsPng);
		const small = await readIsolatedPreviewBytes(prisma, {
			fileAttachmentId: first.file.id,
			kind: THUMBNAIL_SIZE.small,
			versionId: first.file.currentVersion.id,
			workspaceId,
		});
		expect(small?.bytes).toEqual(cleanThumb);
		expect(
			Buffer.from(small?.bytes ?? []).includes(Buffer.from("GPSLatitude"))
		).toBe(false);
		expect(await prisma.fileImageDerivative.count()).toBe(2);
		expect(await prisma.fileAttachment.count()).toBe(1);
		const again = await commitPng(
			prisma,
			{
				actorId,
				bytes: gpsPng,
				filename: "gps-copy.png",
				idempotencyKey: "thumb-2",
				projectId: project.id,
				workspaceId,
			},
			{
				derivatives: engine,
				sniff: () => Promise.resolve({ ext: "png", mime: "image/png" }),
			}
		);
		expect(again.status).toBe("committed");
		expect(await prisma.fileImageDerivative.count()).toBe(2);
		await permanentlyDeleteFileAttachment(prisma, first.file.id);
		expect(await prisma.fileImageDerivative.count()).toBe(2);
		if (again.status === "committed") {
			await permanentlyDeleteFileAttachment(prisma, again.file.id);
		}
		expect(await prisma.fileImageDerivative.count()).toBe(0);
	});

	it("rebuilds pending image derivatives when the File Attachment is opened", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "pending-open",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		await prisma.fileImageDerivative.deleteMany({
			where: { contentHash: created.file.currentVersion.contentHash },
		});
		await prisma.fileAttachmentVersion.update({
			data: {
				previewAttempts: 0,
				previewCause: null,
				previewStatus: PREVIEW_STATUS.pending,
			},
			where: { id: created.file.currentVersion.id },
		});
		const opened = await getFileAttachment(prisma, {
			id: created.file.id,
			workspaceId,
		});
		expect(opened?.currentVersion.preview.status).toBe(PREVIEW_STATUS.ready);
		expect(opened?.currentVersion.preview.galleryThumbnailPath).toBe(
			thumbnailPathFor(
				created.file.id,
				created.file.currentVersion.id,
				THUMBNAIL_SIZE.small
			)
		);
		expect(opened?.currentVersion.preview.previewPath).toBe(
			previewPathFor(created.file.id, created.file.currentVersion.id)
		);
	});

	it("keeps an over-limit image downloadable with Unavailable preview and a bounded observable retry", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		let produces = 0;
		const engine: ImageDerivativeEngine = {
			produce: () => {
				produces += 1;
				return Promise.resolve({
					cause: "decode-limit" as const,
					status: "limit-exceeded" as const,
				});
			},
		};
		const created = await commitPng(
			prisma,
			{
				actorId,
				idempotencyKey: "too-many-frames",
				projectId: project.id,
				workspaceId,
			},
			{ derivatives: engine }
		);
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(produces).toBe(IMAGE_DERIVATIVE_LIMITS.retryLimit);
		const { preview } = created.file.currentVersion;
		expect(preview.status).toBe(PREVIEW_STATUS.unavailable);
		expect(preview.previewPath).toBeNull();
		expect(preview.galleryThumbnailPath).toBeNull();
		expect(preview.cause).toBe("decode-limit");
		expect(preview.written).toBe(false);
		expect(preview.retryLimit).toBe(IMAGE_DERIVATIVE_LIMITS.retryLimit);
		expect(preview.supportReference).toMatch(SUPPORT_REFERENCE);
		const original = await readAccessibleFileBytes(prisma, {
			fileAttachmentId: created.file.id,
			versionId: created.file.currentVersion.id,
			workspaceId,
		});
		expect(original?.bytes).toEqual(PNG_BYTES);
		expect(
			await readIsolatedPreviewBytes(prisma, {
				fileAttachmentId: created.file.id,
				kind: "preview",
				versionId: created.file.currentVersion.id,
				workspaceId,
			})
		).toBeNull();
	});

	it("promotes a Capture attachment into a File Attachment in the target scope", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const staging = createMemoryCaptureStagingSource();
		await staging.put("inbox-project", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "shot.png",
		});
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const promoted = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-project",
				origin: "human",
				payload: {
					inboxItemId: "inbox-project",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{ captureStaging: staging }
		);
		expect(promoted.status).toBe("committed");
		if (promoted.status !== "committed") {
			return;
		}
		expect(promoted.file.scope).toEqual({
			kind: "project",
			projectId: project.id,
		});
		expect(promoted.file.title).toBe("shot.png");
		expect(promoted.file.currentVersion.filename).toBe("shot.png");
		expect(await staging.read("inbox-project")).toBeNull();
		expect(
			(
				await listFileAttachments(prisma, {
					scope: { kind: "project", projectId: project.id },
					workspaceId,
				})
			).map((item) => item.id)
		).toEqual([promoted.file.id]);
		await staging.put("inbox-named", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "conductor.png",
		});
		const named = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-named",
				origin: "human",
				payload: {
					inboxItemId: "inbox-named",
					scope: { kind: "project", projectId: project.id },
					title: "Crash on save after login",
				},
				workspaceId,
			},
			{ captureStaging: staging }
		);
		expect(named.status).toBe("committed");
		if (named.status !== "committed") {
			return;
		}
		expect(named.file.title).toBe("Crash on save after login");
		expect(named.file.currentVersion.filename).toBe("conductor.png");
		await staging.put("inbox-wiki", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "wiki.png",
		});
		const wiki = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-wiki",
				origin: "human",
				payload: {
					inboxItemId: "inbox-wiki",
					scope: { kind: "personal-wiki" },
				},
				workspaceId,
			},
			{ captureStaging: staging }
		);
		expect(wiki.status).toBe("committed");
		if (wiki.status !== "committed") {
			return;
		}
		expect(wiki.file.scope).toEqual({ kind: "personal-wiki" });
		const replay = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-project",
				origin: "human",
				payload: {
					inboxItemId: "inbox-project",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{ captureStaging: staging }
		);
		expect(replay.status).toBe("replayed");
		if (replay.status !== "replayed") {
			return;
		}
		expect(replay.file.id).toBe(promoted.file.id);
	});

	it("leaves no visible File Attachment when capture promotion fails and explains a safe retry", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const staging = createMemoryCaptureStagingSource();
		await staging.put("inbox-html", {
			bytes: HTML_BYTES,
			contentType: "text/html",
			filename: "page.html",
		});
		const rejected = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-html",
				origin: "human",
				payload: {
					inboxItemId: "inbox-html",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{ captureStaging: staging }
		);
		expect(rejected.status).toBe("rejected");
		if (rejected.status !== "rejected") {
			return;
		}
		expect(rejected.reason).toBe(FILE_ATTACHMENT_COPY.typeRejected);
		expect(rejected.explanation.written).toBe(false);
		expect(rejected.explanation.retryBound).toBe("once");
		expect(rejected.explanation.reason).toBe(FILE_ATTACHMENT_COPY.typeRejected);
		expect(rejected.explanation.supportReference).toMatch(SUPPORT_REFERENCE);
		expect(JSON.stringify(rejected)).not.toMatch(SECRET_FREE_FAILURE);
		expect(await staging.read("inbox-html")).toEqual({
			bytes: HTML_BYTES,
			contentType: "text/html",
			filename: "page.html",
		});
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const limits = {
			maxOriginalBytes: PNG_BYTES.byteLength,
			maxVersions: 1,
		};
		await staging.put("inbox-quota", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "first.png",
		});
		const first = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-quota-1",
				origin: "human",
				payload: {
					inboxItemId: "inbox-quota",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{ captureStaging: staging, quota: limits }
		);
		expect(first.status).toBe("committed");
		await staging.put("inbox-quota-2", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "second.png",
		});
		const blocked = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-quota-2",
				origin: "human",
				payload: {
					inboxItemId: "inbox-quota-2",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{ captureStaging: staging, quota: limits }
		);
		expect(blocked).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.quotaExceeded,
			status: "rejected",
		});
		expect(await staging.read("inbox-quota-2")).not.toBeNull();
		const failedStore = createMemoryCaptureStagingSource();
		await failedStore.put("inbox-fail", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "fail.png",
		});
		const failed = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-fail-store",
				origin: "human",
				payload: {
					inboxItemId: "inbox-fail",
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{
				captureStaging: failedStore,
				store: createFailingPromoteStore(createPrismaFileObjectStore()),
			}
		);
		expect(failed.status).toBe("rejected");
		expect(await failedStore.read("inbox-fail")).not.toBeNull();
		expect(await prisma.fileAttachment.findMany()).toHaveLength(1);
	});

	it("deletes Capture staging without minting a File Attachment", async () => {
		const { project, workspaceId } = await openProject(prisma);
		const staging = createMemoryCaptureStagingSource();
		await staging.put("inbox-delete", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "shot.png",
		});
		const discarded = await discardCaptureStaging(
			prisma,
			{ inboxItemId: "inbox-delete", workspaceId },
			{ captureStaging: staging }
		);
		expect(discarded).toEqual({ status: "deleted" });
		expect(await staging.read("inbox-delete")).toBeNull();
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		expect(await prisma.fileAttachment.findMany()).toEqual([]);
	});

	it("promotes an encrypted Capture staging object through the Prisma adapter", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const rootKey = Buffer.alloc(32, 7);
		const sealed = envelopeSeal(PNG_BYTES, rootKey);
		const item = await prisma.captureInboxItem.create({
			data: {
				body: "Crash shot",
				capturedAt: new Date(),
				fieldsText: "{}",
				id: crypto.randomUUID(),
				ownerId: actorId,
				projectId: project.id,
				workspaceId,
			},
		});
		await prisma.captureStagingObject.create({
			data: {
				byteLength: PNG_BYTES.byteLength,
				ciphertext: Buffer.from(sealed.ciphertext),
				contentType: "image/png",
				filename: "shot.png",
				id: crypto.randomUUID(),
				inboxItemId: item.id,
				keyVersion: sealed.keyVersion,
				workspaceId,
				wrappedDek: Buffer.from(sealed.wrappedDek),
			},
		});
		const promoted = await promoteCaptureAttachment(
			prisma,
			{
				actorId,
				idempotencyKey: "promote-encrypted",
				origin: "human",
				payload: {
					inboxItemId: item.id,
					scope: { kind: "project", projectId: project.id },
				},
				workspaceId,
			},
			{
				captureStaging: createPrismaCaptureStagingSource(prisma, rootKey),
			}
		);
		expect(promoted.status).toBe("committed");
		if (promoted.status !== "committed") {
			return;
		}
		expect(promoted.file.scope).toEqual({
			kind: "project",
			projectId: project.id,
		});
		expect(
			await prisma.captureStagingObject.findUnique({
				where: { inboxItemId: item.id },
			})
		).toBeNull();
		expect(
			(
				await listFileAttachments(prisma, {
					scope: { kind: "project", projectId: project.id },
					workspaceId,
				})
			).map((row) => row.id)
		).toEqual([promoted.file.id]);
	});

	it("keeps marking on a separate undoable layer pinned to the exact version", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "mark-v1",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		const { contentHash: hash, id: versionId } = created.file.currentVersion;
		const { objectKey } = await prisma.fileAttachmentVersion.findUniqueOrThrow({
			where: { id: versionId },
		});
		const marked = await appendMark(prisma, {
			geometry: { points: [0.1, 0.1, 0.4, 0.4] },
			tool: MARKING_TOOLS.pen,
			versionId,
		});
		expect(marked.status).toBe("committed");
		if (marked.status !== "committed") {
			return;
		}
		expect(marked.layer.marks.map((mark) => mark.tool)).toEqual([
			MARKING_TOOLS.pen,
		]);
		await appendMark(prisma, {
			geometry: { height: 0.2, width: 0.3, x: 0.2, y: 0.2 },
			tool: MARKING_TOOLS.rectangle,
			versionId,
		});
		await appendMark(prisma, {
			geometry: { x1: 0.1, x2: 0.9, y1: 0.8, y2: 0.2 },
			tool: MARKING_TOOLS.arrow,
			versionId,
		});
		await appendMark(prisma, {
			geometry: { points: [0.2, 0.5, 0.6, 0.5] },
			page: 2,
			tool: MARKING_TOOLS.highlighter,
			versionId,
		});
		expect(
			await appendMark(prisma, {
				geometry: { body: "note" },
				tool: "comment",
				versionId,
			})
		).toMatchObject({
			reason: FILE_ATTACHMENT_COPY.typeRejected,
			status: "rejected",
		});
		const layer = await getMarkingLayer(prisma, versionId);
		expect(layer.status).toBe("committed");
		if (layer.status !== "committed") {
			return;
		}
		expect(layer.layer.marks).toHaveLength(4);
		expect(layer.layer.marks[3]?.page).toBe(2);
		expect(layer.layer.contentHash).toBe(hash);
		expect(layer.layer).not.toHaveProperty("objectKey");
		expect(
			(
				await prisma.fileAttachmentVersion.findUniqueOrThrow({
					where: { id: versionId },
				})
			).objectKey
		).toBe(objectKey);
		expect(
			(
				await readAccessibleFileBytes(prisma, {
					fileAttachmentId: created.file.id,
					versionId,
					workspaceId,
				})
			)?.bytes
		).toEqual(PNG_BYTES);
		expect(await listFileAttachmentRelations(prisma, created.file.id)).toEqual(
			[]
		);
		expect(await prisma.fileAttachment.count()).toBe(1);
		expect(
			await prisma.fileAttachmentVersion.count({
				where: { fileAttachmentId: created.file.id },
			})
		).toBe(1);
		const undone = await undoMark(prisma, versionId);
		expect(undone.status).toBe("committed");
		if (undone.status !== "committed") {
			return;
		}
		expect(undone.layer.marks).toHaveLength(3);
		const next = await commitPng(prisma, {
			actorId,
			filename: "shot-v2.png",
			idempotencyKey: "mark-v2",
			projectId: project.id,
			targetFileAttachmentId: created.file.id,
			workspaceId,
		});
		expect(next.status).toBe("committed");
		if (next.status !== "committed") {
			return;
		}
		const prior = await getMarkingLayer(prisma, versionId);
		const current = await getMarkingLayer(prisma, next.file.currentVersion.id);
		expect(prior.status === "committed" && prior.layer.marks).toHaveLength(3);
		expect(current.status === "committed" && current.layer.marks).toEqual([]);
	});

	it("lists source visual and marking as separate share items", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "share-items",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		const listed = await listSharePublishItems(
			prisma,
			created.file.currentVersion.id
		);
		expect(listed).toEqual({
			items: [
				{
					approved: false,
					kind: SHARE_PUBLISH_ITEM_KIND.sourceVisual,
					label: FILE_ATTACHMENT_COPY.sourceVisual,
				},
				{
					approved: false,
					kind: SHARE_PUBLISH_ITEM_KIND.markingLayer,
					label: FILE_ATTACHMENT_COPY.markingLayer,
				},
			],
			status: "ok",
		});
		const approved = await approveSharePublishItem(prisma, {
			kind: SHARE_PUBLISH_ITEM_KIND.sourceVisual,
			versionId: created.file.currentVersion.id,
		});
		expect(approved.status).toBe("ok");
		if (approved.status !== "ok") {
			return;
		}
		expect(
			approved.items.find(
				(item) => item.kind === SHARE_PUBLISH_ITEM_KIND.sourceVisual
			)?.approved
		).toBe(true);
		expect(
			approved.items.find(
				(item) => item.kind === SHARE_PUBLISH_ITEM_KIND.markingLayer
			)?.approved
		).toBe(false);
	});

	it("binds a point or region as Origin Location to Work after preview", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await commitPng(prisma, {
			actorId,
			idempotencyKey: "origin-file",
			projectId: project.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		const versionId = created.file.currentVersion.id;
		expect(
			previewLocationWorkBind({
				fileKind: FILE_KIND.image,
				geometry: { kind: ORIGIN_LOCATION_KIND.point, x: 0.25, y: 0.4 },
				scope: created.file.scope,
				surface: LOCATION_SURFACE.wireframe,
				versionId,
			})
		).toEqual({
			reason: FILE_ATTACHMENT_COPY.wireframeOriginNotThisFeature,
			status: "rejected",
		});
		expect(
			await confirmLocationWorkBind(prisma, {
				actorId,
				geometry: { kind: ORIGIN_LOCATION_KIND.point, x: 0.25, y: 0.4 },
				idempotencyKey: "no-preview",
				previewAcknowledged: false,
				surface: LOCATION_SURFACE.fileAttachment,
				title: "Ghost observation",
				versionId,
				workspaceId,
			})
		).toEqual({
			reason: FILE_ATTACHMENT_COPY.previewRequired,
			status: "rejected",
		});
		expect(await listWork(prisma, project.id)).toEqual([]);
		const preview = previewLocationWorkBind({
			fileKind: FILE_KIND.image,
			geometry: { kind: ORIGIN_LOCATION_KIND.point, x: 0.25, y: 0.4 },
			scope: created.file.scope,
			surface: LOCATION_SURFACE.fileAttachment,
			title: "Hotspot bug",
			versionId,
		});
		expect(preview).toMatchObject({
			observationIsWork: false,
			status: "ok",
			work: { id: null, title: "Hotspot bug" },
		});
		const bound = await confirmLocationWorkBind(prisma, {
			actorId,
			geometry: { kind: ORIGIN_LOCATION_KIND.point, x: 0.25, y: 0.4 },
			idempotencyKey: "bind-new",
			previewAcknowledged: true,
			surface: LOCATION_SURFACE.fileAttachment,
			title: "Hotspot bug",
			versionId,
			workspaceId,
		});
		expect(bound.status).toBe("committed");
		if (bound.status !== "committed") {
			return;
		}
		expect(bound.observationIsWork).toBe(false);
		expect(bound.file.scope).toEqual({
			kind: "project",
			projectId: project.id,
		});
		expect(bound.file.currentVersion.pins).toEqual([
			{ kind: FILE_PIN_KIND.location, targetId: bound.work.id },
		]);
		const relations = await listRelations(prisma, {
			record: { id: bound.work.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toHaveLength(1);
		expect(relations[0]).toMatchObject({
			originLocation: {
				componentId: bound.locationId,
				missing: false,
				sourceVersion: versionId,
			},
			type: RELATIONS_COPY.origin,
		});
		expect(relations[0]?.from.kind).toBe("File Attachment");
		const existing = await createWork(prisma, {
			actorId,
			idempotencyKey: "existing-work",
			origin: "human",
			payload: { projectId: project.id, title: "Already open" },
		});
		expect(existing.status).toBe("committed");
		if (existing.status !== "committed") {
			return;
		}
		const regionBound = await confirmLocationWorkBind(prisma, {
			actorId,
			existingWorkId: existing.work.id,
			geometry: {
				height: 0.2,
				kind: ORIGIN_LOCATION_KIND.region,
				width: 0.3,
				x: 0.1,
				y: 0.1,
			},
			idempotencyKey: "bind-existing",
			previewAcknowledged: true,
			surface: LOCATION_SURFACE.fileAttachment,
			versionId,
			workspaceId,
		});
		expect(regionBound.status).toBe("committed");
		if (regionBound.status !== "committed") {
			return;
		}
		expect(regionBound.work.id).toBe(existing.work.id);
		const next = await commitPng(prisma, {
			actorId,
			filename: "later.png",
			idempotencyKey: "origin-v2",
			projectId: project.id,
			targetFileAttachmentId: created.file.id,
			workspaceId,
		});
		expect(next.status).toBe("committed");
		if (next.status !== "committed") {
			return;
		}
		expect(next.file.currentVersion.pins).toEqual([]);
		expect(next.file.versions[0]?.pins).toEqual([
			{ kind: FILE_PIN_KIND.location, targetId: bound.work.id },
			{ kind: FILE_PIN_KIND.location, targetId: existing.work.id },
		]);
		expect(
			await prisma.fileAttachmentOriginLocation.count({
				where: { versionId: next.file.currentVersion.id },
			})
		).toBe(0);
	});

	it("rejects marking undo on non-visual files and wiki Origin Location bind", async () => {
		const wikiOwner = await seedWorkspace(prisma);
		const wiki = await commitPng(prisma, {
			actorId: wikiOwner.actorId,
			idempotencyKey: "wiki-origin",
			workspaceId: wikiOwner.workspaceId,
		});
		expect(wiki.status).toBe("committed");
		if (wiki.status !== "committed") {
			return;
		}
		expect(
			await confirmLocationWorkBind(prisma, {
				actorId: wikiOwner.actorId,
				geometry: { kind: ORIGIN_LOCATION_KIND.point, x: 0.1, y: 0.1 },
				idempotencyKey: "wiki-bind",
				previewAcknowledged: true,
				surface: LOCATION_SURFACE.fileAttachment,
				title: "Wiki hotspot",
				versionId: wiki.file.currentVersion.id,
				workspaceId: wikiOwner.workspaceId,
			})
		).toEqual({
			reason: FILE_ATTACHMENT_COPY.workRequiresProject,
			status: "rejected",
		});
		const { actorId, project, workspaceId } = await openProject(prisma);
		const note = await commitTyped(prisma, {
			actorId,
			bytes: new TextEncoder().encode("log line"),
			filename: "note.txt",
			idempotencyKey: "txt-undo",
			mime: "text/plain",
			projectId: project.id,
			workspaceId,
		});
		expect(note.status).toBe("committed");
		if (note.status !== "committed") {
			return;
		}
		expect(await undoMark(prisma, note.file.currentVersion.id)).toEqual({
			reason: FILE_ATTACHMENT_COPY.typeRejected,
			status: "rejected",
		});
	});
});
