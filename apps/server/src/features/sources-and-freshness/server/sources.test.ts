/**
 * Sources and Freshness seam — Project-scoped Source master
 * record with URL, title, access time, captured content, and
 * dated versions. A new capture does not delete an old version.
 * Optional provider / external type / external id come from
 * URL shape or explicit entry. No credentials, sync, Work, or
 * automatic Evidence. Feed UI is out of this ticket.
 * docs/specs/44-sources-and-freshness/spec.md and GitHub #310.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt tazeliği).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { listWork } from "../../work-lifecycle/server/work-lifecycle";

import {
	createSource,
	getSource,
	listSources,
	saveSourceVersion,
} from "./sources";
import {
	SOURCE_EXTERNAL_RECORD_TYPE,
	SOURCE_PROVIDER,
	SOURCES_COPY,
} from "./sources-model";

const DATABASE_URL = localTestDatabaseUrl();

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
const FEED_COPY = /\bfeed\b/i;
const CREDENTIAL_COPY = /credential|access token|api key|session cookie/i;

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
	await prisma.typedRelation.deleteMany();
	await prisma.source.deleteMany();
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

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-payments-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

describe("Sources and Freshness", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("keeps a Project Source with address, title, access time, and captured content", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-stripe",
			origin: "human",
			payload: {
				accessedAt: "2026-03-02T09:15:00.000Z",
				capturedContent: "Checkout Session creates a payment page.",
				excerpt: "Checkout Session",
				projectId,
				title: "Stripe Checkout",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.source.recordKind).toBe("Source");
		expect(created.source.projectId).toBe(projectId);
		expect(created.source.title).toBe("Stripe Checkout");
		expect(created.source.url).toBe(
			"https://docs.stripe.com/payments/checkout"
		);
		expect(created.source.accessedAt).toBe("2026-03-02T09:15:00.000Z");
		expect(created.source.capturedContent).toBe(
			"Checkout Session creates a payment page."
		);
		expect(created.source.excerpt).toBe("Checkout Session");
		expect(created.source.approvedVersionNumber).toBe(1);
		expect(created.source.versions).toHaveLength(1);
		expect(created.source.versions[0]?.versionNumber).toBe(1);
		expect(created.source.provider).toBeNull();
		expect(ISO_INSTANT.test(created.source.accessedAt)).toBe(true);

		const listed = await listSources(prisma, projectId);
		expect(listed.map((item) => item.title)).toEqual(["Stripe Checkout"]);
		const loaded = await getSource(prisma, created.source.id);
		expect(loaded?.id).toBe(created.source.id);
	});

	it("writes GitHub origin from URL shape without credentials or turning the URL into Work", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-github-issue",
			origin: "human",
			payload: {
				capturedContent: "Login must use GitHub OAuth.",
				projectId,
				title: "GitHub login issue",
				url: "https://github.com/acme/payments/issues/42",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.source.provider).toBe(SOURCE_PROVIDER.github);
		expect(created.source.externalRecordType).toBe(
			SOURCE_EXTERNAL_RECORD_TYPE.issue
		);
		expect(created.source.externalId).toBe("acme/payments#42");
		expect(JSON.stringify(created.source)).not.toMatch(CREDENTIAL_COPY);
		const works = await listWork(prisma, projectId);
		expect(works).toEqual([]);
	});

	it("keeps unrecognized URLs as a normal address and honors explicit origin entry", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const unrecognized = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-plain-url",
			origin: "human",
			payload: {
				capturedContent: "Partner pricing notes.",
				projectId,
				title: "Partner site",
				url: "https://partner.example/pricing",
			},
		});
		expect(unrecognized.status).toBe("committed");
		if (unrecognized.status !== "committed") {
			throw new Error("expected create");
		}
		expect(unrecognized.source.provider).toBeNull();
		expect(unrecognized.source.externalRecordType).toBeNull();
		expect(unrecognized.source.externalId).toBeNull();

		const explicit = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-explicit-origin",
			origin: "human",
			payload: {
				capturedContent: "Manual origin.",
				externalId: "doc-9",
				externalRecordType: "Article",
				projectId,
				provider: "Notion",
				title: "Research note",
				url: "https://partner.example/notes/9",
			},
		});
		expect(explicit.status).toBe("committed");
		if (explicit.status !== "committed") {
			throw new Error("expected create");
		}
		expect(explicit.source.provider).toBe("Notion");
		expect(explicit.source.externalRecordType).toBe("Article");
		expect(explicit.source.externalId).toBe("doc-9");
	});

	it("does not delete an old version when a new capture is saved", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const created = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-two-versions",
			origin: "human",
			payload: {
				accessedAt: "2026-01-10T08:00:00.000Z",
				capturedContent: "First capture of checkout copy.",
				projectId,
				title: "Checkout docs",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		const next = await saveSourceVersion(prisma, {
			actorId,
			baseRevision: created.source.revision,
			idempotencyKey: "source-two-versions-v2",
			origin: "human",
			payload: {
				accessedAt: "2026-04-01T12:00:00.000Z",
				capturedContent: "Second capture after the pricing rewrite.",
				sourceId: created.source.id,
				title: "Checkout docs",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		expect(next.status).toBe("committed");
		if (next.status !== "committed") {
			throw new Error("expected version");
		}
		expect(next.source.approvedVersionNumber).toBe(2);
		expect(next.source.capturedContent).toBe(
			"Second capture after the pricing rewrite."
		);
		expect(
			next.source.versions.map((version) => version.versionNumber)
		).toEqual([1, 2]);
		expect(next.source.versions[0]?.capturedContent).toBe(
			"First capture of checkout copy."
		);
		expect(next.source.versions[0]?.accessedAt).toBe(
			"2026-01-10T08:00:00.000Z"
		);
		expect(next.source.versions[1]?.accessedAt).toBe(
			"2026-04-01T12:00:00.000Z"
		);
		const loaded = await getSource(prisma, created.source.id);
		expect(loaded?.versions).toHaveLength(2);
	});

	it("does not create Evidence because a Source exists", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-no-evidence",
			origin: "human",
			payload: {
				capturedContent: "Interview excerpt.",
				projectId,
				title: "Research interview",
				url: "https://example.com/interview",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		const relations = await listRelations(prisma, {
			record: { id: created.source.id, kind: "Source" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toEqual([]);
		expect(
			relations.some((relation) => relation.type === RELATIONS_COPY.evidence)
		).toBe(false);

		const next = await saveSourceVersion(prisma, {
			actorId,
			baseRevision: created.source.revision,
			idempotencyKey: "source-no-evidence-v2",
			origin: "human",
			payload: {
				capturedContent: "Later excerpt.",
				sourceId: created.source.id,
				title: "Research interview",
				url: "https://example.com/interview",
			},
		});
		expect(next.status).toBe("committed");
		if (next.status !== "committed") {
			throw new Error("expected version");
		}
		const afterVersion = await listRelations(prisma, {
			record: { id: created.source.id, kind: "Source" },
			viewerWorkspaceId: workspaceId,
		});
		expect(afterVersion).toEqual([]);
	});

	it("uses English Source labels and does not open a Feed", () => {
		expect(SOURCES_COPY.source).toBe("Source");
		expect(SOURCES_COPY.createSource).toBe("Create Source");
		expect(SOURCES_COPY.saveAsNewSourceVersion).toBe(
			"Save as new Source version"
		);
		expect(SOURCES_COPY.address).toBe("Address");
		expect(SOURCES_COPY.accessedAt).toBe("Accessed at");
		expect(SOURCES_COPY.capturedContent).toBe("Captured content");
		expect(JSON.stringify(SOURCES_COPY)).not.toMatch(FEED_COPY);
		expect(JSON.stringify(SOURCES_COPY)).not.toMatch(CREDENTIAL_COPY);
	});
});
