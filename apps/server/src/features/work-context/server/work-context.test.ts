/**
 * Work Context Card seam — five prepared layouts × four Starter
 * Configurations, progressive `Add Context`, and no create or status
 * gate. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş bağlamı: type × starter matrix).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../../project-shell/server/project-shell";
import { STARTER_CONFIGURATIONS } from "../../project-shell/server/project-shell-model";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	bindPrimarySpec,
	changeWorkStatus,
	createWork,
	permanentlyDeleteWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_TYPES } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	copyWorkContextAsMarkdown,
	loadWorkContextCard,
	loadWorkContextCopy,
	presentWorkContextCard,
	revealPreparedSection,
} from "./work-context";
import { WORK_CONTEXT_COPY } from "./work-context-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const PREPARED_BY_TYPE = {
	Bug: [
		"Observed/Expected Behavior",
		"Affected Releases",
		"Evidence",
		"GitHub & Tests",
	],
	Feature: [
		"Problem/Opportunity",
		"Expected Outcome",
		"Evidence & Decisions",
		"Risks & Open Questions",
		"Included Work",
		"GitHub & Tests",
		"Target Release",
	],
	Improvement: [
		"Current Situation",
		"Expected Outcome",
		"Evidence",
		"GitHub & Tests",
	],
	Research: [
		"Research Question",
		"Sources & Evidence",
		"Decisions",
		"Related Work",
	],
	Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

const DASHBOARD_PATTERN = /dashboard|readiness score|wsjf|free query/i;

describe("Work Context Card", () => {
	it("uses the same prepared layout for each Work type in every Starter Configuration", () => {
		const cards = WORK_TYPES.flatMap((workType) =>
			STARTER_CONFIGURATIONS.map((starterConfiguration) => ({
				card: presentWorkContextCard({
					starterConfiguration,
					workType,
				}),
				starterConfiguration,
				workType,
			}))
		);
		expect(cards).toHaveLength(20);
		for (const { card, workType } of cards) {
			expect(card.preparedSections).toEqual(PREPARED_BY_TYPE[workType]);
			expect(card.initiallyVisibleFields).toEqual([
				"Title",
				"Type",
				"Status",
				"Planning",
			]);
			expect(card.visiblePreparedSections).toEqual([]);
			expect(card.addContext).toEqual({
				label: "Add Context",
				remainingSections: PREPARED_BY_TYPE[workType],
			});
			expect(card.gates).toEqual({
				create: false,
				statusTransition: false,
			});
		}
		for (const workType of WORK_TYPES) {
			const layouts = STARTER_CONFIGURATIONS.map(
				(starterConfiguration) =>
					presentWorkContextCard({ starterConfiguration, workType })
						.preparedSections
			);
			expect(new Set(layouts.map((sections) => sections.join("|"))).size).toBe(
				1
			);
		}
	});

	it("opens a hidden prepared section with Add Context and never treats emptiness as a gate", () => {
		const closed = presentWorkContextCard({
			starterConfiguration: "Solo SaaS",
			workType: "Feature",
		});
		const revealed = revealPreparedSection(
			closed,
			WORK_CONTEXT_COPY.problemOpportunity
		);
		expect(revealed.visiblePreparedSections).toEqual(["Problem/Opportunity"]);
		expect(revealed.addContext.remainingSections[0]).toBe("Expected Outcome");
		expect(revealed.gates).toEqual({
			create: false,
			statusTransition: false,
		});
		expect(WORK_CONTEXT_COPY.addContext).toBe("Add Context");
		expect(JSON.stringify(WORK_CONTEXT_COPY)).not.toMatch(DASHBOARD_PATTERN);
	});

	it("shows live own fields and related sources without minting a Context record", () => {
		const card = presentWorkContextCard({
			description: "Empty cart fails checkout",
			expectedOutcome: "Pay without a crash",
			originResearch: liveSource(
				"Work",
				"spike-1",
				"Discovery spike",
				"Closed"
			),
			primaryFeature: liveSource("Work", "feat-1", "Checkout", "In Progress"),
			primarySpec: liveSource(
				"Document",
				"spec-1",
				"Checkout spec",
				"Document"
			),
			projectGoal: liveSource(
				"Project Goal",
				"goal-1",
				"Launch checkout",
				"Project Goal"
			),
			relatedSources: [
				{
					kind: "Decision",
					other: liveSource("Decision", "dec-1", "Use hosted pay", "Accepted"),
					relationType: "Related",
				},
				{
					kind: "Risk",
					other: liveSource("Risk", "risk-1", "PCI scope", "Open"),
					relationType: "Related",
				},
				{
					kind: "GitHub PR",
					other: liveSource("GitHub PR", "pr-1", "PR 88", "Open"),
					relationType: "Required for completion",
				},
			],
			revealedSections: [
				"Problem/Opportunity",
				"Expected Outcome",
				"Evidence & Decisions",
				"Risks & Open Questions",
				"GitHub & Tests",
			],
			starterConfiguration: "Solo SaaS",
			workId: "work-1",
			workStatus: "In Progress",
			workType: "Feature",
		});
		expect(card.writes).toEqual({
			bodyCopy: false,
			contextRecord: false,
			relation: false,
		});
		expect(card.effects).toEqual({
			close: false,
			completenessScore: false,
			health: false,
			priority: false,
			processGate: false,
			releaseScope: false,
			status: false,
		});
		expect(sectionNamed(card, "Problem/Opportunity")?.items[0]).toMatchObject({
			openSourceRecord: true,
			opensWorkSurface: false,
			recordStatus: "In Progress",
			sourceId: "work-1",
			visibleName: "Empty cart fails checkout",
		});
		expect(sectionNamed(card, "Expected Outcome")?.items[0]?.visibleName).toBe(
			"Pay without a crash"
		);
		expect(sectionNamed(card, "Evidence & Decisions")?.items[0]).toMatchObject({
			kind: "Decision",
			opensWorkSurface: false,
			sourceId: "dec-1",
			visibleName: "Use hosted pay",
		});
		expect(sectionNamed(card, "Risks & Open Questions")?.items[0]?.kind).toBe(
			"Risk"
		);
		expect(sectionNamed(card, "GitHub & Tests")?.items[0]?.visibleName).toBe(
			"PR 88"
		);
		expect(
			presentWorkContextCard({
				relatedSources: [
					{
						kind: "Risk",
						other: liveSource("Risk", "risk-2", "PCI scope", "Open"),
						relationType: "Related",
					},
				],
				revealedSections: ["Evidence"],
				starterConfiguration: "Blank Project",
				workType: "Bug",
			}).visibleSections[0]?.items[0]?.kind
		).toBe("Risk");
		expect(card.whyChain.label).toBe("Why am I doing this work?");
		expect(card.whyChain.steps.map((step) => step.visibleName)).toEqual([
			"Launch checkout",
			"Discovery spike",
			"Checkout",
			"Checkout spec",
			"Use hosted pay",
			"PR 88",
		]);
		expect(card.whyChain.steps.every((step) => !step.opensWorkSurface)).toBe(
			true
		);
	});

	it("copies live context as Markdown without a snapshot record", () => {
		const copy = copyWorkContextAsMarkdown({
			activeBlockers: [
				{
					kind: "Work",
					sourceId: "PAY-2",
					visibleName: "Auth token refresh",
				},
			],
			checklist: [
				{ completed: true, title: "Write the failing test" },
				{ completed: false, title: "Ship the fix" },
			],
			description: "Empty cart fails checkout",
			githubAndExternal: [
				{
					href: "https://github.com/example/pay/pull/88",
					kind: "GitHub PR",
					sourceId: "pr-1",
					visibleName: "PR 88",
				},
			],
			key: "PAY-1",
			primarySpec: {
				kind: "Document",
				sourceId: "spec-1",
				visibleName: "Checkout spec",
			},
			producedAt: "2026-08-29T20:06:00.000Z",
			relatedUncertainty: [
				{
					kind: "Decision",
					sourceId: "dec-1",
					visibleName: "Use hosted pay",
				},
				{
					kind: "Risk",
					sourceId: "risk-1",
					visibleName: "PCI scope",
				},
				{
					kind: "Open Question",
					sourceId: "q-1",
					visibleName: "Who owns retries?",
				},
			],
			status: "In Progress",
			title: "Checkout",
			type: "Feature",
			whyChain: [
				{
					role: "Project Goal",
					sourceId: "goal-1",
					visibleName: "Launch checkout",
				},
				{
					role: "Primary spec",
					sourceId: "spec-1",
					visibleName: "Checkout spec",
				},
			],
		});
		expect(copy.writes).toEqual({
			contextRecord: false,
			relation: false,
			shareObject: false,
			snapshot: false,
		});
		expect(copy.widensAccess).toBe(false);
		expect(copy.markdown).toBe(
			[
				"# PAY-1 Checkout",
				"",
				"- Key: PAY-1",
				"- Title: Checkout",
				"- Type: Feature",
				"- Status: In Progress",
				"- Description: Empty cart fails checkout",
				"",
				"## Why am I doing this work?",
				"- Project Goal: Launch checkout (`goal-1`)",
				"- Primary spec: Checkout spec (`spec-1`)",
				"",
				"## Checklist",
				"- [x] Write the failing test",
				"- [ ] Ship the fix",
				"",
				"## Primary spec",
				"- Checkout spec (`spec-1`)",
				"",
				"## Related Decision, Risk, and Open Question",
				"- Decision: Use hosted pay (`dec-1`)",
				"- Risk: PCI scope (`risk-1`)",
				"- Open Question: Who owns retries? (`q-1`)",
				"",
				"## Active blockers",
				"- Work: Auth token refresh (`PAY-2`)",
				"",
				"## GitHub and external links",
				"- GitHub PR: PR 88 (`pr-1`) https://github.com/example/pay/pull/88",
				"",
				"Produced at: 2026-08-29T20:06:00.000Z",
				"",
				"Primary source is in the app",
				"",
			].join("\n")
		);
		expect(WORK_CONTEXT_COPY.copyContextAsMarkdown).toBe(
			"Copy Context as Markdown"
		);
		expect(WORK_CONTEXT_COPY.primarySourceIsInTheApp).toBe(
			"Primary source is in the app"
		);
	});

	it("omits secrets, inaccessible fields, and private attachment bytes from Markdown copy", () => {
		const secret = "secret body that must not leak";
		const attachmentBytes = "PK\u0003\u0004private-bytes";
		const copy = copyWorkContextAsMarkdown({
			activeBlockers: [
				{
					kind: "Work",
					reason: "No access",
				},
			],
			attachmentBytes,
			checklist: [],
			description: "Visible description",
			githubAndExternal: [
				{
					kind: "File Attachment",
					reason: "No access",
				},
			],
			inaccessibleFields: { apiToken: secret },
			key: "PAY-9",
			producedAt: "2026-08-29T20:06:00.000Z",
			relatedUncertainty: [
				{
					kind: "Decision",
					reason: "No access",
				},
			],
			secrets: { [secret]: true },
			status: "Blocked",
			title: "Retry",
			type: "Bug",
			whyChain: [
				{
					reason: "No access",
					role: "Origin",
				},
			],
		});
		expect(copy.markdown).toContain("Origin: No access");
		expect(copy.markdown).toContain("Decision: No access");
		expect(copy.markdown).toContain("Work: No access");
		expect(copy.markdown).not.toContain(secret);
		expect(copy.markdown).not.toContain(attachmentBytes);
		expect(copy.markdown).not.toContain("apiToken");
		expect(copy.widensAccess).toBe(false);
	});

	it("explains a broken why-chain step without leaking source content", () => {
		const secret = "secret body that must not leak";
		const card = presentWorkContextCard({
			originResearch: {
				kind: "Work",
				openSourceRecord: false,
				opensWorkSurface: false,
				reason: "No access",
				status: "broken",
			},
			revealedSections: ["Problem/Opportunity"],
			starterConfiguration: "Blank Project",
			workType: "Feature",
		});
		expect(card.whyChain.steps).toEqual([
			{
				openSourceRecord: false,
				opensWorkSurface: false,
				reason: "No access",
				role: "Origin",
			},
		]);
		expect(JSON.stringify(card)).not.toContain(secret);
		expect(JSON.stringify(card.whyChain)).not.toContain("Discovery");
	});

	it("uses a neutral empty state and add or link action without treating emptiness as a gate", () => {
		const card = presentWorkContextCard({
			revealedSections: ["Problem/Opportunity", "Evidence & Decisions"],
			starterConfiguration: "Mobile Application",
			workType: "Feature",
		});
		expect(sectionNamed(card, "Problem/Opportunity")).toMatchObject({
			action: { kind: "add", label: "Add" },
			empty: true,
			emptyState: "Nothing here yet.",
			items: [],
		});
		expect(sectionNamed(card, "Evidence & Decisions")).toMatchObject({
			action: { kind: "link", label: "Link" },
			empty: true,
			emptyState: "Nothing here yet.",
		});
		expect(card.whyChain.empty).toBe(true);
		expect(card.whyChain.emptyState).toBe("Nothing here yet.");
		expect(card.gates).toEqual({ create: false, statusTransition: false });
		expect(card.effects.completenessScore).toBe(false);
		expect(card.effects.processGate).toBe(false);
	});
});

function liveSource(
	kind: string,
	sourceId: string,
	visibleName: string,
	recordStatus: string
) {
	return {
		kind,
		openSourceRecord: true as const,
		opensWorkSurface: false as const,
		recordStatus,
		sourceId,
		status: "live" as const,
		visibleName,
	};
}

function sectionNamed(
	card: ReturnType<typeof presentWorkContextCard>,
	name: string
) {
	return card.visibleSections.find((section) => section.name === name);
}

describe("Work Context Card counterparts", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
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
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("creates and moves status with every prepared section empty", async () => {
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
		const createdProject = await createProject(prisma, {
			actorId: user.id,
			idempotencyKey: "create-mobile",
			origin: "human",
			payload: {
				name: "Mobile",
				starterConfiguration: "Mobile Application",
			},
			workspaceId: workspace.id,
		});
		if (createdProject.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const card = presentWorkContextCard({
			starterConfiguration: createdProject.project.starterConfiguration,
			workType: "Bug",
		});
		expect(card.visiblePreparedSections).toEqual([]);
		expect(card.gates.create).toBe(false);
		expect(card.gates.statusTransition).toBe(false);
		const created = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-bug",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Crash on launch",
				type: "Bug",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const progressed = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: created.work.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: "In Progress",
			workId: created.work.id,
		});
		expect(progressed).toMatchObject({
			status: "committed",
			work: { status: "In Progress" },
		});
	});

	it("loads live origin, Primary spec, and a broken end from sources", async () => {
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
		const createdProject = await createProject(prisma, {
			actorId: user.id,
			idempotencyKey: "create-saas",
			origin: "human",
			payload: {
				name: "Payments",
				starterConfiguration: "Solo SaaS",
			},
			workspaceId: workspace.id,
		});
		if (createdProject.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const feature = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-feature",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Checkout",
				type: "Feature",
			},
		});
		if (feature.status !== "committed") {
			throw new Error("expected Feature");
		}
		const research = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-research",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Discovery spike",
				type: "Research",
			},
		});
		if (research.status !== "committed") {
			throw new Error("expected Research");
		}
		await prisma.work.update({
			data: { description: "Empty cart fails checkout" },
			where: { id: feature.work.id },
		});
		const spec = await bindPrimarySpec(prisma, {
			actorId: user.id,
			baseRevision: feature.work.revision,
			idempotencyKey: "bind-spec",
			origin: "human",
			primarySpec: { id: "spec-checkout", title: "Checkout spec" },
			workId: feature.work.id,
		});
		expect(spec.status).toBe("committed");
		const origin = await createRelation(prisma, {
			actorId: user.id,
			from: { id: research.work.id, kind: "Work" },
			idempotencyKey: "origin-research",
			origin: "human",
			previewAcknowledged: true,
			to: { id: feature.work.id, kind: "Work" },
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspace.id,
		});
		expect(origin.status).toBe("committed");
		const gone = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-gone",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Hidden title",
				type: "Task",
			},
		});
		if (gone.status !== "committed") {
			throw new Error("expected gone Work");
		}
		await prisma.work.update({
			data: { description: "secret body that must not leak" },
			where: { id: gone.work.id },
		});
		const related = await createRelation(prisma, {
			actorId: user.id,
			from: { id: feature.work.id, kind: "Work" },
			idempotencyKey: "related-gone",
			origin: "human",
			previewAcknowledged: true,
			to: { id: gone.work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspace.id,
		});
		expect(related.status).toBe("committed");
		await permanentlyDeleteWork(prisma, gone.work.id);
		const card = await loadWorkContextCard(prisma, {
			revealedSections: ["Problem/Opportunity"],
			viewerWorkspaceId: workspace.id,
			workId: feature.work.id,
		});
		expect(card?.writes.contextRecord).toBe(false);
		expect(card?.whyChain.steps.map((step) => step.visibleName)).toEqual([
			"Discovery spike",
			"Checkout spec",
		]);
		expect(
			sectionNamed(
				card ??
					presentWorkContextCard({
						starterConfiguration: "Solo SaaS",
						workType: "Feature",
					}),
				"Problem/Opportunity"
			)?.items[0]?.visibleName
		).toBe("Empty cart fails checkout");
		const serialized = JSON.stringify(card);
		expect(serialized).not.toContain("secret body that must not leak");
		expect(serialized).not.toContain("Hidden title");
		expect(card?.effects.status).toBe(false);
		const receiptsBefore = await prisma.mutationReceipt.count();
		const copy = await loadWorkContextCopy(prisma, {
			producedAt: "2026-08-29T20:06:00.000Z",
			viewerWorkspaceId: workspace.id,
			workId: feature.work.id,
		});
		expect(copy?.writes.snapshot).toBe(false);
		expect(copy?.markdown).toContain(`# ${feature.work.key} Checkout`);
		expect(copy?.markdown).toContain("Empty cart fails checkout");
		expect(copy?.markdown).toContain("Checkout spec");
		expect(copy?.markdown).toContain("Primary source is in the app");
		expect(copy?.markdown).not.toContain("secret body that must not leak");
		expect(copy?.markdown).not.toContain("Hidden title");
		expect(await prisma.mutationReceipt.count()).toBe(receiptsBefore);
	}, 30_000);
});
