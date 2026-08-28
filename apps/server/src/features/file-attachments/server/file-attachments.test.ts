/**
 * File Attachments seam — accept/reject, quota, atomic finalize,
 * version pins, and retry idempotency. Synthetic `Dosya sınırları`
 * fixture for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Dosya güvenliği).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { envelopeSeal } from "../../capture-triage/server/capture-staging-crypto";
import { createProject } from "../../project-shell/server/project-shell";
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
import {
	CAPTURE_STAGING_SURFACES,
	contentPathFor,
	FILE_ATTACHMENT_COPY,
	FILE_ATTACHMENT_QUOTA,
	FILE_KIND,
	FILE_LIFECYCLE,
	FILE_PIN_KIND,
	FILE_TYPE_INTEGRITY_BUDGET_MS,
	STAGING_TTL_MS,
} from "./file-attachments-model";
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
		await prisma.fileAttachmentStaging.deleteMany();
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

	it("promotes a Capture attachment into a File Attachment in the target scope", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const staging = createMemoryCaptureStagingSource();
		await staging.put("inbox-project", {
			bytes: PNG_BYTES,
			contentType: "image/png",
			filename: "shot.png",
		});
		expect(CAPTURE_STAGING_SURFACES).toEqual({
			export: false,
			publish: false,
			search: false,
			share: false,
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
		expect(await staging.read("inbox-project")).toBeNull();
		expect(
			(
				await listFileAttachments(prisma, {
					scope: { kind: "project", projectId: project.id },
					workspaceId,
				})
			).map((item) => item.id)
		).toEqual([promoted.file.id]);
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
});
