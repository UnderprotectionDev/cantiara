/**
 * Relations seam — closed typed catalog, direction and
 * allowed ends, Related/Origin without lifecycle write,
 * Köken konumu for owned-component origin, and kırık
 * referans sunumu without body or unauthorized title leak.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki: relation half).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../../project-shell/server/project-shell";
import {
	archiveWork,
	createWork,
	getWork,
	permanentlyDeleteWork,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	brokenEndSideEffects,
	countsTowardComputed,
	createRelation,
	createUsageLink,
	deleteRelation,
	exportableContent,
	indexableContent,
	inspectRelations,
	listRelations,
	listUsageLinksForHosts,
	previewRelation,
	relationsCatalog,
	undoRelation,
	unlinkUsageLink,
} from "./relations";
import { RELATIONS_COPY } from "./relations-catalog";
import { USAGE_KIND } from "./relations-model";

const DATABASE_URL = localTestDatabaseUrl();

const SECRET_BODY = "secret body that must not leak";

const USAGE_METADATA = /evidenceRole|copiedBody|Related/;

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

async function resetSharedTables(prisma: PrismaClient) {
	await prisma.usageLink.deleteMany();
	await prisma.usageHostEmbed.deleteMany();
	await prisma.typedRelation.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function openProject(prisma: PrismaClient, name = "Payments") {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${name.toLowerCase()}`,
		origin: "human",
		payload: {
			name,
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	input: { idempotencyKey: string; projectId: string; title: string }
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error(`expected committed Work, got ${created.status}`);
	}
	return created.work;
}

function workRef(id: string) {
	return { id, kind: "Work" as const };
}

describe("Relations", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("rejects a type that is not in the closed catalog", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "intake",
			projectId: project.id,
			title: "Intake",
		});
		const wallet = await committedWork(prisma, actorId, {
			idempotencyKey: "wallet",
			projectId: project.id,
			title: "Wallet",
		});
		expect(relationsCatalog().copy.related).toBe("Related");
		expect(relationsCatalog().copy.origin).toBe("Origin");
		expect(relationsCatalog().copy.derived).toBe("Derived");
		expect(relationsCatalog().copy.usedIn).toBe("Used in");
		expect(relationsCatalog().copy.openSourceRecord).toBe("Open source record");
		expect(
			await createRelation(prisma, {
				actorId,
				from: workRef(intake.id),
				idempotencyKey: "free-type",
				origin: "human",
				previewAcknowledged: true,
				to: workRef(wallet.id),
				type: "Friendship",
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "unknown-relation-type", status: "rejected" });
	});

	it("stores Related with two ends and direction after preview", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "intake",
			projectId: project.id,
			title: "Intake",
		});
		const wallet = await committedWork(prisma, actorId, {
			idempotencyKey: "wallet",
			projectId: project.id,
			title: "Wallet",
		});
		expect(
			await createRelation(prisma, {
				actorId,
				from: workRef(intake.id),
				idempotencyKey: "related-no-preview",
				origin: "human",
				to: workRef(wallet.id),
				type: RELATIONS_COPY.related,
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "preview-required", status: "rejected" });
		const preview = await previewRelation(prisma, {
			from: workRef(intake.id),
			to: workRef(wallet.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(preview).toMatchObject({
			preview: {
				copy: { related: "Related" },
				from: { title: "Intake" },
				to: { title: "Wallet" },
				type: "Related",
			},
			status: "ok",
		});
		const created = await createRelation(prisma, {
			actorId,
			from: workRef(intake.id),
			idempotencyKey: "related-intake-wallet",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(wallet.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(created).toMatchObject({
			relation: {
				from: { id: intake.id, kind: "Work", title: "Intake" },
				to: { id: wallet.id, kind: "Work", title: "Wallet" },
				type: "Related",
				typeLabelFrom: "Related",
				typeLabelTo: "Related",
			},
			status: "committed",
		});
		expect(
			await listRelations(prisma, {
				record: workRef(intake.id),
				viewerWorkspaceId: workspaceId,
			})
		).toMatchObject([
			{
				from: { id: intake.id },
				to: { id: wallet.id },
				type: "Related",
			},
		]);
	});

	it("does not let Related stand in for Origin and does not write status", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "source",
			projectId: project.id,
			title: "Source note",
		});
		const produced = await committedWork(prisma, actorId, {
			idempotencyKey: "produced",
			projectId: project.id,
			title: "Produced Work",
		});
		await createRelation(prisma, {
			actorId,
			from: workRef(source.id),
			idempotencyKey: "related-not-origin",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(produced.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		const listed = await listRelations(prisma, {
			record: workRef(produced.id),
			viewerWorkspaceId: workspaceId,
		});
		expect(listed.map((row) => row.typeLabelTo)).toEqual(["Related"]);
		expect(listed.map((row) => row.type)).not.toContain("Origin");
		const origin = await createRelation(prisma, {
			actorId,
			from: workRef(source.id),
			idempotencyKey: "origin-link",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(produced.id),
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspaceId,
		});
		expect(origin).toMatchObject({
			relation: {
				type: "Origin",
				typeLabelFrom: "Derived",
				typeLabelTo: "Origin",
			},
			status: "committed",
		});
		expect((await getWork(prisma, source.id))?.status).toBe("Not Started");
		expect((await getWork(prisma, produced.id))?.status).toBe("Not Started");
	});

	it("refuses Origin from an owned component as an independent end and keeps Köken konumu", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const owner = await committedWork(prisma, actorId, {
			idempotencyKey: "owner",
			projectId: project.id,
			title: "Checklist owner",
		});
		const produced = await committedWork(prisma, actorId, {
			idempotencyKey: "from-item",
			projectId: project.id,
			title: "From checklist item",
		});
		expect(
			await createRelation(prisma, {
				actorId,
				from: { id: "item-1", kind: "Session Test" },
				idempotencyKey: "component-end",
				origin: "human",
				previewAcknowledged: true,
				to: workRef(produced.id),
				type: RELATIONS_COPY.origin,
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "owned-component-not-an-end", status: "rejected" });
		const created = await createRelation(prisma, {
			actorId,
			from: workRef(owner.id),
			idempotencyKey: "origin-location",
			origin: "human",
			originLocation: {
				componentId: "item-1",
				ownerId: owner.id,
				ownerKind: "Work",
				sourceVersion: "v1",
			},
			previewAcknowledged: true,
			to: workRef(produced.id),
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspaceId,
		});
		expect(created).toMatchObject({
			relation: {
				originLocation: {
					componentId: "item-1",
					missing: false,
					sourceVersion: "v1",
				},
				type: "Origin",
			},
			status: "committed",
		});
		expect(
			await createRelation(prisma, {
				actorId,
				from: workRef(owner.id),
				idempotencyKey: "silent-retarget",
				origin: "human",
				originLocation: {
					componentId: "item-2",
					ownerId: owner.id,
					ownerKind: "Work",
					sourceVersion: "v2",
				},
				previewAcknowledged: true,
				to: workRef(produced.id),
				type: RELATIONS_COPY.origin,
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "silent-retarget", status: "rejected" });
	});

	it("presents broken ends without body and hides Open source record when unauthorized", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const living = await committedWork(prisma, actorId, {
			idempotencyKey: "living",
			projectId: project.id,
			title: "Living Work",
		});
		const other = await committedWork(prisma, actorId, {
			idempotencyKey: "other",
			projectId: project.id,
			title: "Hidden title",
		});
		await prisma.work.update({
			data: { description: SECRET_BODY },
			where: { id: other.id },
		});
		const created = await createRelation(prisma, {
			actorId,
			from: workRef(living.id),
			idempotencyKey: "related-hidden",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(other.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected related");
		}
		await archiveWork(prisma, {
			actorId,
			baseRevision: other.revision,
			idempotencyKey: "archive-other",
			origin: "human",
			workId: other.id,
		});
		const archived = await listRelations(prisma, {
			record: workRef(living.id),
			viewerWorkspaceId: workspaceId,
		});
		expect(archived[0]?.to).toMatchObject({
			openSourceRecord: true,
			reason: "Archived",
			status: "broken",
			title: "Hidden title",
		});
		expect(JSON.stringify(archived)).not.toContain(SECRET_BODY);
		await permanentlyDeleteWork(prisma, other.id);
		const gone = await listRelations(prisma, {
			record: workRef(living.id),
			viewerWorkspaceId: workspaceId,
		});
		expect(gone[0]?.to).toMatchObject({
			openSourceRecord: false,
			reason: "Permanently deleted",
			status: "broken",
		});
		expect(gone[0]?.to.status === "broken" && gone[0].to.title).toBeUndefined();
		expect(JSON.stringify(gone)).not.toContain("Hidden title");
		expect(JSON.stringify(gone)).not.toContain(SECRET_BODY);
		expect(indexableContent(gone[0]?.to ?? archived[0]?.to)).toEqual([]);
		expect(exportableContent(gone[0]?.to ?? archived[0]?.to)).toEqual([]);
		expect(countsTowardComputed(gone[0]?.to ?? archived[0]?.to)).toBe(false);
		expect(brokenEndSideEffects(gone[0]?.to ?? archived[0]?.to)).toEqual({
			attention: false,
			followUpWork: false,
		});
		const overlayed = await listRelations(prisma, {
			endOverrides: {
				[`${"Work"}:missing-trash`]: {
					reason: RELATIONS_COPY.inTrash,
					title: "Trashed",
				},
				[`${"Work"}:missing-redact`]: {
					reason: RELATIONS_COPY.redactedForSecurity,
					title: "Redacted name",
				},
				[`${"Work"}:missing-access`]: {
					reason: RELATIONS_COPY.noAccess,
					title: "Other workspace",
				},
			},
			record: workRef(living.id),
			viewerWorkspaceId: workspaceId,
		});
		expect(overlayed[0]?.to.reason).toBe("Permanently deleted");
		const trash = await createRelation(
			prisma,
			{
				actorId,
				from: workRef(living.id),
				idempotencyKey: "to-trash",
				origin: "human",
				previewAcknowledged: true,
				to: { id: "missing-trash", kind: "Work" },
				type: RELATIONS_COPY.related,
				viewerWorkspaceId: workspaceId,
			},
			{
				"Work:missing-trash": {
					reason: RELATIONS_COPY.inTrash,
					title: "Trashed",
				},
			}
		);
		expect(trash).toMatchObject({
			relation: {
				to: {
					openSourceRecord: true,
					reason: "In Trash",
					title: "Trashed",
				},
			},
			status: "committed",
		});
		const redacted = await createRelation(
			prisma,
			{
				actorId,
				from: workRef(living.id),
				idempotencyKey: "to-redact",
				origin: "human",
				previewAcknowledged: true,
				to: { id: "missing-redact", kind: "Work" },
				type: RELATIONS_COPY.related,
				viewerWorkspaceId: workspaceId,
			},
			{
				"Work:missing-redact": {
					reason: RELATIONS_COPY.redactedForSecurity,
					title: "Redacted name",
				},
			}
		);
		expect(redacted).toMatchObject({
			relation: {
				to: {
					openSourceRecord: false,
					reason: "Redacted for security",
				},
			},
			status: "committed",
		});
		if (redacted.status === "committed") {
			expect(
				redacted.relation.to.status === "broken" && redacted.relation.to.title
			).toBeUndefined();
			expect(JSON.stringify(redacted.relation.to)).not.toContain(
				"Redacted name"
			);
		}
		const noAccess = await createRelation(
			prisma,
			{
				actorId,
				from: workRef(living.id),
				idempotencyKey: "to-no-access",
				origin: "human",
				previewAcknowledged: true,
				to: { id: "missing-access", kind: "Work" },
				type: RELATIONS_COPY.related,
				viewerWorkspaceId: workspaceId,
			},
			{
				"Work:missing-access": {
					reason: RELATIONS_COPY.noAccess,
					title: "Other workspace",
				},
			}
		);
		expect(noAccess).toMatchObject({
			relation: {
				to: {
					openSourceRecord: false,
					reason: "No access",
				},
			},
			status: "committed",
		});
		if (noAccess.status === "committed") {
			expect(JSON.stringify(noAccess.relation.to)).not.toContain(
				"Other workspace"
			);
		}
	});

	it("does not auto-close the other end when a relation is added or removed", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const left = await committedWork(prisma, actorId, {
			idempotencyKey: "left",
			projectId: project.id,
			title: "Left",
		});
		const right = await committedWork(prisma, actorId, {
			idempotencyKey: "right",
			projectId: project.id,
			title: "Right",
		});
		const created = await createRelation(prisma, {
			actorId,
			from: workRef(left.id),
			idempotencyKey: "link",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(right.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected related");
		}
		expect((await getWork(prisma, left.id))?.status).toBe("Not Started");
		expect((await getWork(prisma, right.id))?.status).toBe("Not Started");
		const undone = await undoRelation(prisma, {
			actorId,
			idempotencyKey: "undo-link",
			origin: "human",
			relationId: created.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(undone.status).toBe("committed");
		expect(
			await listRelations(prisma, {
				record: workRef(left.id),
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		expect((await getWork(prisma, left.id))?.status).toBe("Not Started");
		expect((await getWork(prisma, right.id))?.status).toBe("Not Started");
		const recreated = await createRelation(prisma, {
			actorId,
			from: workRef(left.id),
			idempotencyKey: "link-again",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(right.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		if (recreated.status !== "committed") {
			throw new Error("expected related");
		}
		await deleteRelation(prisma, {
			actorId,
			idempotencyKey: "delete-link",
			origin: "human",
			relationId: recreated.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		expect(
			await listRelations(prisma, {
				record: workRef(left.id),
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
	});

	it("hides another Workspace name on a no-access end", async () => {
		const first = await openProject(prisma, "Alpha");
		const second = await openProject(prisma, "Beta");
		const alpha = await committedWork(prisma, first.actorId, {
			idempotencyKey: "alpha-work",
			projectId: first.project.id,
			title: "Alpha secret",
		});
		const beta = await committedWork(prisma, second.actorId, {
			idempotencyKey: "beta-work",
			projectId: second.project.id,
			title: "Beta secret",
		});
		const created = await createRelation(prisma, {
			actorId: first.actorId,
			from: workRef(alpha.id),
			idempotencyKey: "cross-workspace",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(beta.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: first.workspaceId,
		});
		expect(created).toMatchObject({
			relation: {
				to: { openSourceRecord: false, reason: "No access", status: "broken" },
			},
			status: "committed",
		});
		if (created.status === "committed") {
			expect(JSON.stringify(created.relation.to)).not.toContain("Beta secret");
		}
	});
});

describe("Relations usage links", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("stores usage without entering Related or changing status", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const host = await committedWork(prisma, actorId, {
			idempotencyKey: "create-host",
			projectId: project.id,
			title: "Checkout spec",
		});
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "create-source",
			projectId: project.id,
			title: "Intake",
		});
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-intake",
			kind: USAGE_KIND.inlineRecordReference,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed usage");
		}
		expect(created.usageLink.kindLabel).toBe("Inline reference");
		expect(created.usageLink.kindLabel).not.toBe(RELATIONS_COPY.related);
		expect(created.host.status).toBe("Not Started");
		expect(created.source.status).toBe("Not Started");
		expect(created.source.revision).toBe(source.revision);
		expect(created.embed.sourceRecordId).toBe(source.id);
		expect(JSON.stringify(created.usageLink)).not.toMatch(USAGE_METADATA);
		const graph = await inspectRelations(prisma, host.id, workspaceId);
		expect(graph.relationCount).toBe(0);
		expect(graph.typedRelations).toEqual([]);
		expect(graph.usageLinks).toEqual([created.usageLink]);
		const liveSource = await getWork(prisma, source.id);
		expect(liveSource?.title).toBe("Intake");
		expect(liveSource?.status).toBe("Not Started");
	});

	it("rejects unknown usage kinds and Evidence Role", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const host = await committedWork(prisma, actorId, {
			idempotencyKey: "create-host",
			projectId: project.id,
			title: "Host",
		});
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "create-source",
			projectId: project.id,
			title: "Source",
		});
		const unknown = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "unknown-kind",
			kind: RELATIONS_COPY.related,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(unknown).toEqual({
			reason: "unknown-usage-kind",
			status: "rejected",
		});
		const withRole = await createUsageLink(prisma, {
			actorId,
			evidenceRole: "Supports",
			hostRecordId: host.id,
			idempotencyKey: "with-role",
			kind: USAGE_KIND.liveContentBlock,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(withRole).toEqual({
			reason: "evidence-role-not-allowed",
			status: "rejected",
		});
		const graph = await inspectRelations(prisma, host.id, workspaceId);
		expect(graph.usageLinks).toEqual([]);
		expect(graph.relationCount).toBe(0);
	});

	it("unlinks the embed and keeps the source record", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const host = await committedWork(prisma, actorId, {
			idempotencyKey: "create-host",
			projectId: project.id,
			title: "Flow",
		});
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "create-source",
			projectId: project.id,
			title: "Pay screen",
		});
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-screen",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed usage");
		}
		const second = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed-again",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(second.status).toBe("committed");
		const unlinked = await unlinkUsageLink(prisma, {
			actorId,
			idempotencyKey: "unlink-screen",
			origin: "human",
			usageLinkId: created.usageLink.id,
		});
		expect(unlinked.status).toBe("committed");
		if (unlinked.status !== "committed") {
			throw new Error("expected committed unlink");
		}
		expect(unlinked.source.id).toBe(source.id);
		expect(unlinked.source.status).toBe("Not Started");
		const graph = await inspectRelations(prisma, host.id, workspaceId);
		expect(graph.usageLinks).toHaveLength(1);
		expect(graph.usageLinks[0]?.id).toBe(
			second.status === "committed" ? second.usageLink.id : ""
		);
		const liveSource = await getWork(prisma, source.id);
		expect(liveSource).toMatchObject({
			id: source.id,
			status: "Not Started",
			title: "Pay screen",
		});
		const unlinkedAgain = await inspectRelations(
			prisma,
			source.id,
			workspaceId
		);
		expect(
			unlinkedAgain.usageLinks.some((link) => link.id === created.usageLink.id)
		).toBe(false);
	});

	it("keeps Related beside usage without mixing counts", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const host = await committedWork(prisma, actorId, {
			idempotencyKey: "create-host",
			projectId: project.id,
			title: "Feature host",
		});
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "create-source",
			projectId: project.id,
			title: "Related work",
		});
		const related = await relateWork(prisma, {
			actorId,
			baseRevision: host.revision,
			fromWorkId: host.id,
			idempotencyKey: "relate",
			origin: "human",
			toWorkId: source.id,
		});
		expect(related.status).toBe("committed");
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "usage",
			kind: USAGE_KIND.pinnedFileOrWireframeBind,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		const graph = await inspectRelations(prisma, host.id, workspaceId);
		expect(graph.relationCount).toBe(1);
		expect(graph.typedRelations[0]?.type).toBe("Related");
		expect(graph.usageLinks).toHaveLength(1);
		expect(graph.usageLinks[0]?.kindLabel).toBe("Pinned bind");
	});

	it("tracks a flow Screen usage without a Work host", async () => {
		const { actorId, workspaceId } = await openProject(prisma);
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: "flow-node-pay",
			idempotencyKey: "flow-screen",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: "screen-pay",
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed usage");
		}
		expect(created.usageLink.kindLabel).toBe("Screen reference");
		expect(created.usageLink.kindLabel).not.toBe(RELATIONS_COPY.related);
		const graph = await inspectRelations(prisma, "screen-pay", workspaceId);
		expect(graph.relationCount).toBe(0);
		expect(graph.usageLinks).toHaveLength(1);
		const unlinked = await unlinkUsageLink(prisma, {
			actorId,
			idempotencyKey: "unlink-flow",
			origin: "human",
			usageLinkId: created.usageLink.id,
		});
		expect(unlinked.status).toBe("committed");
		const after = await inspectRelations(prisma, "screen-pay", workspaceId);
		expect(after.usageLinks).toEqual([]);
	});

	it("inspect of a missing Work record is empty and hides another Workspace", async () => {
		const first = await openProject(prisma);
		const created = await createUsageLink(prisma, {
			actorId: first.actorId,
			hostRecordId: "flow-node-pay",
			idempotencyKey: "owned-screen",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: "screen-pay",
			workspaceId: first.workspaceId,
		});
		expect(created.status).toBe("committed");
		const other = await seedWorkspace(prisma);
		const missing = await inspectRelations(
			prisma,
			crypto.randomUUID(),
			first.workspaceId
		);
		expect(missing.usageLinks).toEqual([]);
		expect(missing.relationCount).toBe(0);
		const leaked = await inspectRelations(
			prisma,
			"screen-pay",
			other.workspaceId
		);
		expect(leaked.usageLinks).toEqual([]);
		const owned = await inspectRelations(
			prisma,
			"screen-pay",
			first.workspaceId
		);
		expect(owned.usageLinks).toHaveLength(1);
		const hosted = await listUsageLinksForHosts(prisma, first.workspaceId, [
			"flow-node-pay",
			"missing-host",
		]);
		expect(hosted["flow-node-pay"]).toHaveLength(1);
		expect(hosted["missing-host"]).toEqual([]);
		const otherHosted = await listUsageLinksForHosts(
			prisma,
			other.workspaceId,
			["flow-node-pay"]
		);
		expect(otherHosted["flow-node-pay"]).toEqual([]);
	});
});

describe("Relations Used in backlinks", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("lists relation backlinks and usage by source kind without mixing counts", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const source = await committedWork(prisma, actorId, {
			idempotencyKey: "source",
			projectId: project.id,
			title: "Pay screen",
		});
		const related = await committedWork(prisma, actorId, {
			idempotencyKey: "related",
			projectId: project.id,
			title: "Wallet",
		});
		const host = await committedWork(prisma, actorId, {
			idempotencyKey: "host",
			projectId: project.id,
			title: "Checkout spec",
		});
		const origin = await committedWork(prisma, actorId, {
			idempotencyKey: "origin",
			projectId: project.id,
			title: "Intake note",
		});
		await createRelation(prisma, {
			actorId,
			from: workRef(source.id),
			idempotencyKey: "related-edge",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(related.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		await createRelation(prisma, {
			actorId,
			from: workRef(origin.id),
			idempotencyKey: "origin-edge",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(source.id),
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspaceId,
		});
		const created = await createUsageLink(prisma, {
			actorId,
			hostRecordId: host.id,
			idempotencyKey: "embed",
			kind: USAGE_KIND.inlineRecordReference,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId,
		});
		expect(created.status).toBe("committed");
		const graph = await inspectRelations(prisma, source.id, workspaceId);
		expect(graph.usedIn.copy.usedIn).toBe("Used in");
		expect(graph.usedIn.copy.openSourceRecord).toBe("Open source record");
		expect(graph.usedIn.relationCount).toBe(2);
		expect(graph.usedIn.relationBacklinks.map((group) => group.label)).toEqual([
			"Related",
			"Origin",
		]);
		expect(
			graph.usedIn.relationBacklinks.flatMap((group) =>
				group.rows.map((row) => row.title)
			)
		).toEqual(["Wallet", "Intake note"]);
		expect(graph.usedIn.usageGroups.map((group) => group.label)).toEqual([
			"Inline reference",
		]);
		expect(graph.usedIn.usageGroups[0]?.rows[0]).toMatchObject({
			groupLabel: "Inline reference",
			key: host.key,
			openSourceRecord: true,
			sourceRecordId: host.id,
			title: "Checkout spec",
		});
		expect(JSON.stringify(graph.usedIn.usageGroups)).not.toMatch(
			USAGE_METADATA
		);
		const hostGraph = await inspectRelations(prisma, host.id, workspaceId);
		expect(hostGraph.usedIn.usageGroups).toEqual([]);
		expect(hostGraph.usageLinks).toHaveLength(1);
		const again = await inspectRelations(prisma, source.id, workspaceId);
		expect(again.usedIn).toEqual(graph.usedIn);
	});

	it("omits inaccessible names, types, and counts from Used in", async () => {
		const first = await openProject(prisma);
		const source = await committedWork(prisma, first.actorId, {
			idempotencyKey: "source",
			projectId: first.project.id,
			title: "Secret screen",
		});
		const related = await committedWork(prisma, first.actorId, {
			idempotencyKey: "related",
			projectId: first.project.id,
			title: "Secret wallet",
		});
		await createRelation(prisma, {
			actorId: first.actorId,
			from: workRef(source.id),
			idempotencyKey: "related-edge",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(related.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: first.workspaceId,
		});
		await createUsageLink(prisma, {
			actorId: first.actorId,
			hostRecordId: "flow-node-pay",
			idempotencyKey: "flow",
			kind: USAGE_KIND.flowNodeScreenReference,
			origin: "human",
			sourceRecordId: source.id,
			workspaceId: first.workspaceId,
		});
		const other = await seedWorkspace(prisma);
		const leaked = await inspectRelations(prisma, source.id, other.workspaceId);
		expect(leaked.usedIn.relationCount).toBe(0);
		expect(leaked.usedIn.relationBacklinks).toEqual([]);
		expect(leaked.usedIn.usageGroups).toEqual([]);
		expect(JSON.stringify(leaked.usedIn)).not.toContain("Secret screen");
		expect(JSON.stringify(leaked.usedIn)).not.toContain("Secret wallet");
		expect(JSON.stringify(leaked.usedIn)).not.toContain(source.key);
		const owned = await inspectRelations(prisma, source.id, first.workspaceId);
		expect(owned.usedIn.relationCount).toBe(1);
		expect(owned.usedIn.usageGroups).toHaveLength(1);
		expect(owned.usedIn.usageGroups[0]?.rows[0]?.openSourceRecord).toBe(false);
		expect(owned.usedIn.usageGroups[0]?.rows[0]?.sourceRecordId).toBe(
			"flow-node-pay"
		);
		await permanentlyDeleteWork(prisma, related.id);
		const afterDelete = await inspectRelations(
			prisma,
			source.id,
			first.workspaceId
		);
		expect(afterDelete.usedIn.relationCount).toBe(0);
		expect(JSON.stringify(afterDelete.usedIn)).not.toContain("Secret wallet");
	});

	it("keeps Open source record for Archived backlinks and does not write from inspect", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const living = await committedWork(prisma, actorId, {
			idempotencyKey: "living",
			projectId: project.id,
			title: "Living",
		});
		const other = await committedWork(prisma, actorId, {
			idempotencyKey: "other",
			projectId: project.id,
			title: "Hidden title",
		});
		await createRelation(prisma, {
			actorId,
			from: workRef(living.id),
			idempotencyKey: "related-hidden",
			origin: "human",
			previewAcknowledged: true,
			to: workRef(other.id),
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		await archiveWork(prisma, {
			actorId,
			baseRevision: other.revision,
			idempotencyKey: "archive-other",
			origin: "human",
			workId: other.id,
		});
		const before = await inspectRelations(prisma, living.id, workspaceId);
		const graph = await inspectRelations(prisma, living.id, workspaceId);
		expect(graph.usedIn.relationBacklinks[0]?.rows[0]).toMatchObject({
			groupLabel: "Related",
			openSourceRecord: true,
			reason: "Archived",
			sourceRecordId: other.id,
			title: "Hidden title",
		});
		expect(graph.usedIn).toEqual(before.usedIn);
	});
});
