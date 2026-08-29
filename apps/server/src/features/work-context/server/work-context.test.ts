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
	archiveWork,
	bindPrimarySpec,
	changeWorkStatus,
	createWork,
	permanentlyDeleteWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_TYPES } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	loadWorkContextCard,
	openPriorityFoundationsCount,
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
const SCORE_KEY_PATTERN = /"score"\s*:/;

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

	it("gathers Priority Foundations without a score, rank, or WSJF", () => {
		const card = presentWorkContextCard({
			criterionValues: [{ name: "Reach", sourceId: "metric-1", value: "High" }],
			dates: [{ label: "Target date", value: "2026-09-01" }],
			effort: "S",
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
			],
			starterConfiguration: "Solo SaaS",
			workId: "work-1",
			workType: "Feature",
		});
		expect(card.priorityFoundations.label).toBe("Priority Foundations");
		expect(card.priorityFoundations.claims).toEqual({
			automaticPriorityInput: false,
			automaticRank: false,
			countsAreDemand: false,
			countsArePopularity: false,
			countsAreVotes: false,
			isBacklogOrder: false,
			isPrioritizationSession: false,
			numericScore: false,
			wsjf: false,
		});
		expect(card.priorityFoundations.openedSet).toBeNull();
		expect(card.priorityFoundations.items.map((item) => item.kind)).toEqual([
			"Project Goal",
			"Target date",
			"Decision",
			"Effort",
			"Priority metrics",
		]);
		expect(JSON.stringify(card.priorityFoundations.items)).not.toMatch(
			SCORE_KEY_PATTERN
		);
		expect(card.priorityFoundations).not.toHaveProperty("score");
	});

	it("opens a clickable type count onto the exact filtered set", () => {
		const card = presentWorkContextCard({
			originResearch: liveSource(
				"Work",
				"research-1",
				"Discovery spike",
				"Closed"
			),
			relatedSources: [
				{
					kind: "Decision",
					other: liveSource("Decision", "dec-1", "Use hosted pay", "Accepted"),
					relationType: "Related",
				},
				{
					kind: "Decision",
					other: liveSource("Decision", "dec-2", "Keep Stripe", "Accepted"),
					relationType: "Related",
				},
				{
					kind: "Risk",
					other: liveSource("Risk", "risk-1", "PCI scope", "Open"),
					relationType: "Related",
				},
				{
					kind: "Source",
					other: liveSource("Source", "src-1", "Interview notes", "Source"),
					relationType: "Evidence",
				},
				{
					kind: "Question",
					other: liveSource("Question", "q-1", "Who owns refunds?", "Open"),
					relationType: "Related",
				},
			],
			starterConfiguration: "Solo SaaS",
			workType: "Feature",
		});
		expect(card.priorityFoundations.counts).toEqual([
			{
				id: "source",
				kind: "Source",
				label: "Source",
				value: 1,
			},
			{
				id: "research",
				kind: "Research",
				label: "Research",
				value: 1,
			},
			{
				id: "decision",
				kind: "Decision",
				label: "Decision",
				value: 2,
			},
			{
				id: "risk",
				kind: "Risk",
				label: "Risk",
				value: 1,
			},
			{
				id: "open-question",
				kind: "Open Question",
				label: "Open Question",
				value: 1,
			},
		]);
		const opened = openPriorityFoundationsCount(card, "decision");
		expect(opened.priorityFoundations.openedSet).toEqual([
			{
				archiveVisible: false,
				kind: "Decision",
				sourceId: "dec-1",
				visibleName: "Use hosted pay",
			},
			{
				archiveVisible: false,
				kind: "Decision",
				sourceId: "dec-2",
				visibleName: "Keep Stripe",
			},
		]);
	});

	it("keeps Feedback, unique Contact, and unique Company counts separate", () => {
		const card = presentWorkContextCard({
			relatedSources: [
				feedback("fb-1", "Slow checkout", "contact-1", "Ada", "co-1", "Acme"),
				feedback("fb-2", "Crash on pay", "contact-1", "Ada", "co-1", "Acme"),
				feedback("fb-3", "Wants guest pay", "contact-1", "Ada", "co-1", "Acme"),
				feedback("fb-4", "Unclear error", "contact-1", "Ada", "co-1", "Acme"),
				feedback("fb-5", "Retry loop", "contact-1", "Ada", "co-1", "Acme"),
			],
			starterConfiguration: "Blank Project",
			workType: "Bug",
		});
		expect(
			card.priorityFoundations.counts.filter((count) =>
				["feedback", "unique-contact", "unique-company"].includes(count.id)
			)
		).toEqual([
			{
				id: "feedback",
				kind: "Feedback",
				label: "Feedback",
				value: 5,
			},
			{
				id: "unique-contact",
				kind: "Contact",
				label: "Unique Contact",
				value: 1,
			},
			{
				id: "unique-company",
				kind: "Company",
				label: "Unique Company",
				value: 1,
			},
		]);
		expect(
			openPriorityFoundationsCount(card, "feedback").priorityFoundations
				.openedSet
		).toHaveLength(5);
		expect(
			openPriorityFoundationsCount(card, "unique-contact").priorityFoundations
				.openedSet
		).toEqual([
			{
				archiveVisible: false,
				kind: "Contact",
				sourceId: "contact-1",
				visibleName: "Ada",
			},
		]);
	});

	it("includes Archive in counts with Archive visible and excludes Trash and permanent delete", () => {
		const card = presentWorkContextCard({
			relatedSources: [
				{
					kind: "Decision",
					other: liveSource(
						"Decision",
						"dec-live",
						"Ship hosted pay",
						"Accepted"
					),
					relationType: "Related",
				},
				{
					kind: "Decision",
					other: {
						kind: "Decision",
						openSourceRecord: true,
						opensWorkSurface: false,
						reason: "Archived",
						sourceId: "dec-archived",
						status: "broken",
						visibleName: "Old pay choice",
					},
					relationType: "Related",
				},
				{
					kind: "Decision",
					other: {
						kind: "Decision",
						openSourceRecord: true,
						opensWorkSurface: false,
						reason: "In Trash",
						sourceId: "dec-trash",
						status: "broken",
						visibleName: "Trashed pay choice",
					},
					relationType: "Related",
				},
				{
					kind: "Decision",
					other: {
						kind: "Decision",
						openSourceRecord: false,
						opensWorkSurface: false,
						reason: "Permanently deleted",
						sourceId: "dec-gone",
						status: "broken",
					},
					relationType: "Related",
				},
			],
			starterConfiguration: "Solo SaaS",
			workType: "Feature",
		});
		expect(
			card.priorityFoundations.counts.find((count) => count.id === "decision")
		).toMatchObject({ value: 2 });
		const opened = openPriorityFoundationsCount(card, "decision");
		expect(opened.priorityFoundations.openedSet).toEqual([
			{
				archiveVisible: false,
				kind: "Decision",
				sourceId: "dec-live",
				visibleName: "Ship hosted pay",
			},
			{
				archiveVisible: true,
				kind: "Decision",
				sourceId: "dec-archived",
				visibleName: "Old pay choice",
			},
		]);
		expect(JSON.stringify(opened.priorityFoundations.openedSet)).not.toContain(
			"Trashed pay choice"
		);
		expect(JSON.stringify(opened.priorityFoundations.openedSet)).not.toContain(
			"dec-gone"
		);
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

function feedback(
	sourceId: string,
	visibleName: string,
	contactId: string,
	contactName: string,
	companyId: string,
	companyName: string
) {
	return {
		companyId,
		companyName,
		contactId,
		contactName,
		kind: "Feedback",
		other: liveSource("Feedback", sourceId, visibleName, "Feedback"),
		relationType: "Evidence",
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
	}, 30_000);

	it("loads Priority Foundations counts from live sources and keeps Archive out of Trash", async () => {
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
			idempotencyKey: "create-foundations",
			origin: "human",
			payload: {
				name: "Foundations",
				starterConfiguration: "Solo SaaS",
			},
			workspaceId: workspace.id,
		});
		if (createdProject.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const feature = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "create-feature-foundations",
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
			idempotencyKey: "create-research-foundations",
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
		const origin = await createRelation(prisma, {
			actorId: user.id,
			from: { id: research.work.id, kind: "Work" },
			idempotencyKey: "origin-foundations",
			origin: "human",
			previewAcknowledged: true,
			to: { id: feature.work.id, kind: "Work" },
			type: RELATIONS_COPY.origin,
			viewerWorkspaceId: workspace.id,
		});
		expect(origin.status).toBe("committed");
		const trash = await createRelation(
			prisma,
			{
				actorId: user.id,
				from: { id: feature.work.id, kind: "Work" },
				idempotencyKey: "related-trash",
				origin: "human",
				previewAcknowledged: true,
				to: { id: "missing-trash", kind: "Work" },
				type: RELATIONS_COPY.related,
				viewerWorkspaceId: workspace.id,
			},
			{
				"Work:missing-trash": {
					reason: RELATIONS_COPY.inTrash,
					title: "Trashed spike",
				},
			}
		);
		expect(trash.status).toBe("committed");
		const archived = await archiveWork(prisma, {
			actorId: user.id,
			baseRevision: research.work.revision,
			idempotencyKey: "archive-research",
			origin: "human",
			workId: research.work.id,
		});
		expect(archived.status).toBe("committed");
		const card = await loadWorkContextCard(prisma, {
			viewerWorkspaceId: workspace.id,
			workId: feature.work.id,
		});
		expect(card?.priorityFoundations.claims.numericScore).toBe(false);
		expect(card?.priorityFoundations.claims.isPrioritizationSession).toBe(
			false
		);
		expect(
			card?.priorityFoundations.counts.find((count) => count.id === "research")
		).toMatchObject({ value: 1 });
		const opened = openPriorityFoundationsCount(
			card ??
				presentWorkContextCard({
					starterConfiguration: "Solo SaaS",
					workType: "Feature",
				}),
			"research"
		);
		expect(opened.priorityFoundations.openedSet).toEqual([
			{
				archiveVisible: true,
				kind: "Research",
				sourceId: research.work.id,
				visibleName: "Discovery spike",
			},
		]);
		expect(JSON.stringify(opened.priorityFoundations.openedSet)).not.toContain(
			"Trashed spike"
		);
	}, 30_000);
});
