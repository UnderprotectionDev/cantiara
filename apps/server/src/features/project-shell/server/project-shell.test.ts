/**
 * Project Shell seam — create with Project Name + Starter Configuration,
 * short-code suggest/reserve, uniqueness in the Workspace, lock after
 * first Work (Work create is a test double that only exists), GitHub
 * not required, four-configuration apply-once matrix, no sample
 * content, dismissible first-open explanation, and skeleton catalog
 * selection metadata without living Document or Wall records. Synthetic
 * fixture for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje selection half; Başlangıç iskeletleri golden living
 * structures wait on 31 and 51).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createProject,
	dismissFirstOpenExplanation,
	getProject,
	listProjects,
	permanentlyDeleteProject,
	recordWorkExists,
	suggestShortCode,
	updateShortCode,
} from "./project-shell";
import {
	PROJECT_LIFECYCLE,
	PROJECT_SHELL_COPY,
	STARTER_CONFIGURATIONS,
} from "./project-shell-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const ACTOR_ID = "founder-1";
const BRANDING_KEY_PATTERN = /color|css|font|theme|github/i;
const COPY_BRANDING_PATTERN = /color|CSS|font/i;
const LIVING_RECORD_KEY_PATTERN =
	/closure|document|marketplace|sample|template|wall/i;
const CLOSED_SKELETON_CATALOG = [
	{
		emptyHeadings: [
			"Primary Navigation",
			"Secondary Navigation",
			"Utility",
			"External",
		],
		name: "Sitemap",
		surface: "Project Wall",
	},
	{
		emptyHeadings: [
			"Awareness",
			"Consideration",
			"Onboarding",
			"Core Use",
			"Retention",
		],
		name: "Customer Journey",
		surface: "Project Wall",
	},
	{
		emptyHeadings: [
			"Context",
			"Goals",
			"Behaviors",
			"Pain Points",
			"Constraints",
			"Evidence",
			"Open Questions",
		],
		name: "Persona",
		surface: "Document",
	},
	{
		emptyHeadings: [
			"Period",
			"What worked?",
			"What did not?",
			"What did we learn?",
			"Decisions",
			"Next changes",
			"Related records",
		],
		name: "Retrospective",
		surface: "Document",
	},
	{
		emptyHeadings: [
			"Release",
			"Audience",
			"Scope",
			"Readiness",
			"Communication",
			"Launch steps",
			"Risks",
			"Observation plan",
			"Related records",
		],
		name: "Launch Plan",
		surface: "Document",
	},
] as const;

function livingRecordKeys(value: object): string[] {
	return Object.keys(value).filter((key) =>
		LIVING_RECORD_KEY_PATTERN.test(key)
	);
}

function brandingKeys(value: object): string[] {
	return Object.keys(value).filter((key) => BRANDING_KEY_PATTERN.test(key));
}

async function seedWorkspace(prisma: PrismaClient, email?: string) {
	const user = await prisma.user.create({
		data: {
			email: email ?? `founder-${crypto.randomUUID()}@example.com`,
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

function createCommand(
	input: {
		idempotencyKey?: string;
		logoFileName?: string | null;
		name?: string;
		problem?: string;
		purpose?: string;
		scope?: string;
		shortCode?: string;
		starterConfiguration?: string;
		targetDate?: string | null;
		workspaceId: string;
	},
	actorId = ACTOR_ID
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			logoFileName: input.logoFileName,
			name: input.name,
			problem: input.problem,
			purpose: input.purpose,
			scope: input.scope,
			shortCode: input.shortCode,
			starterConfiguration: input.starterConfiguration,
			targetDate: input.targetDate,
		},
		workspaceId: input.workspaceId,
	};
}

describe("Project Shell", () => {
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

	it("opens an Active Project from Project Name and Blank Project with PAY from Payments", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const outcome = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "create-payments",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		expect(outcome).toMatchObject({
			project: {
				lifecycleStatus: PROJECT_LIFECYCLE.active,
				logoFileName: null,
				name: "Payments",
				problem: null,
				purpose: null,
				scope: null,
				shortCode: "PAY",
				shortCodeLocked: false,
				starterConfiguration: "Blank Project",
				targetDate: null,
			},
			status: "committed",
		});
		if (outcome.status !== "committed") {
			throw new Error("expected committed Project");
		}
		expect(brandingKeys(outcome.project)).toEqual([]);
		expect(await getProject(prisma, outcome.project.id)).toEqual(
			outcome.project
		);
		expect(await listProjects(prisma, workspaceId)).toEqual([outcome.project]);
	});

	it("requires Project Name and a closed Starter Configuration catalog", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "missing-name",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "missing-project-name",
			status: "rejected",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "missing-config",
						name: "Payments",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "missing-starter-configuration",
			status: "rejected",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "unknown-config",
						name: "Payments",
						starterConfiguration: "Example Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-starter-configuration",
			status: "rejected",
		});
		expect(STARTER_CONFIGURATIONS).toEqual([
			"Blank Project",
			"Solo SaaS",
			"Open Source Library",
			"Mobile Application",
		]);
		expect(await listProjects(prisma, workspaceId)).toEqual([]);
	});

	it("accepts every closed Starter Configuration without GitHub setup", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const outcomes = await STARTER_CONFIGURATIONS.reduce(
			async (pending, starterConfiguration, index) => {
				const previous = await pending;
				previous.push(
					await createProject(
						prisma,
						createCommand(
							{
								idempotencyKey: `create-${index}`,
								name: `App ${index}`,
								starterConfiguration,
								workspaceId,
							},
							actorId
						)
					)
				);
				return previous;
			},
			Promise.resolve([] as Awaited<ReturnType<typeof createProject>>[])
		);
		for (const [index, outcome] of outcomes.entries()) {
			expect(outcome.status).toBe("committed");
			if (outcome.status !== "committed") {
				throw new Error("expected committed Project");
			}
			expect(outcome.project.starterConfiguration).toBe(
				STARTER_CONFIGURATIONS[index]
			);
			expect(outcome.project.lifecycleStatus).toBe(PROJECT_LIFECYCLE.active);
			expect(brandingKeys(outcome.project)).toEqual([]);
		}
		expect(await listProjects(prisma, workspaceId)).toHaveLength(4);
	});

	it("keeps purpose, problem, scope, target date, and logo optional", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const outcome = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "thin-profile",
					logoFileName: "mark.png",
					name: "Atlas",
					problem: "Intake is scattered",
					purpose: "Ship the workspace",
					scope: "Founder only",
					starterConfiguration: "Solo SaaS",
					targetDate: "2026-09-01",
					workspaceId,
				},
				actorId
			)
		);
		expect(outcome).toMatchObject({
			project: {
				lifecycleStatus: PROJECT_LIFECYCLE.active,
				logoFileName: "mark.png",
				name: "Atlas",
				problem: "Intake is scattered",
				purpose: "Ship the workspace",
				scope: "Founder only",
				shortCode: "ATL",
				starterConfiguration: "Solo SaaS",
				targetDate: "2026-09-01",
			},
			status: "committed",
		});
	});

	it("suggests a Workspace-unique Short code and refuses reuse", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const first = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "first-pay",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		expect(first).toMatchObject({
			project: { shortCode: "PAY" },
			status: "committed",
		});
		expect(await suggestShortCode(prisma, workspaceId, "Payments")).toBe(
			"PAY2"
		);
		const second = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "second-pay",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		expect(second).toMatchObject({
			project: { shortCode: "PAY2" },
			status: "committed",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "reuse-pay",
						name: "Other",
						shortCode: "PAY",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "short-code-taken",
			status: "rejected",
		});
	});

	it("lets the founder change the Short code until the first Work exists", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "create-bill",
					name: "Billing",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const renamed = await updateShortCode(prisma, {
			actorId,
			baseRevision: created.project.revision,
			idempotencyKey: "rename-bill",
			origin: "human",
			projectId: created.project.id,
			shortCode: "BILL",
		});
		expect(renamed).toMatchObject({
			project: {
				id: created.project.id,
				shortCode: "BILL",
				shortCodeLocked: false,
			},
			status: "committed",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "cannot-reuse-old",
						name: "Payments",
						shortCode: "BIL",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "short-code-taken",
			status: "rejected",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "cannot-reuse-billing-prefix",
						name: "Other",
						shortCode: "BILL",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "short-code-taken",
			status: "rejected",
		});
		if (renamed.status !== "committed") {
			throw new Error("expected committed Short code");
		}
		expect(
			await updateShortCode(prisma, {
				actorId,
				baseRevision: renamed.project.revision,
				idempotencyKey: "restore-bil",
				origin: "human",
				projectId: created.project.id,
				shortCode: "BIL",
			})
		).toMatchObject({
			project: {
				id: created.project.id,
				shortCode: "BIL",
				shortCodeLocked: false,
			},
			status: "committed",
		});
	});

	it("locks the Short code after the first Work exists", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "lock-me",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const locked = await recordWorkExists(prisma, created.project.id);
		expect(locked?.shortCodeLocked).toBe(true);
		expect(locked?.shortCode).toBe("PAY");
		expect(
			await updateShortCode(prisma, {
				actorId,
				baseRevision: locked?.revision ?? created.project.revision,
				idempotencyKey: "too-late",
				origin: "human",
				projectId: created.project.id,
				shortCode: "BILL",
			})
		).toEqual({
			reason: "short-code-locked",
			status: "rejected",
		});
		expect(await getProject(prisma, created.project.id)).toMatchObject({
			shortCode: "PAY",
			shortCodeLocked: true,
		});
	});

	it("does not reissue a Short code after permanent delete", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "doomed",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		await permanentlyDeleteProject(prisma, created.project.id);
		expect(await getProject(prisma, created.project.id)).toBeNull();
		expect(await listProjects(prisma, workspaceId)).toEqual([]);
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "after-delete",
						name: "Payments",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toMatchObject({
			project: { shortCode: "PAY2" },
			status: "committed",
		});
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "explicit-pay",
						name: "Other",
						shortCode: "PAY",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "short-code-taken",
			status: "rejected",
		});
	});

	it("lets another Workspace use the same Short code", async () => {
		const first = await seedWorkspace(prisma, "one@example.com");
		const second = await seedWorkspace(prisma, "two@example.com");
		const a = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "ws-a",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId: first.workspaceId,
				},
				first.actorId
			)
		);
		const b = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "ws-b",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId: second.workspaceId,
				},
				second.actorId
			)
		);
		expect(a).toMatchObject({
			project: { shortCode: "PAY" },
			status: "committed",
		});
		expect(b).toMatchObject({
			project: { shortCode: "PAY" },
			status: "committed",
		});
	});

	it("replays the same human create and conflicts on a different payload", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const first = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "same-key",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		const replayed = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "same-key",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		expect(first.status).toBe("committed");
		expect(replayed.status).toBe("replayed");
		if (first.status === "committed" && replayed.status === "replayed") {
			expect(replayed.project).toEqual(first.project);
		}
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						idempotencyKey: "same-key",
						name: "Billing",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			conflict: MUTATION_COPY.conflict,
			status: "conflict",
		});
		expect(await listProjects(prisma, workspaceId)).toHaveLength(1);
	});

	it("rejects a human create missing the client idempotency key", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		expect(
			await createProject(
				prisma,
				createCommand(
					{
						name: "Payments",
						starterConfiguration: "Blank Project",
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "missing-idempotency-key",
			status: "rejected",
		});
	});

	it("applies the PRD starter configuration table once without sample content", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const expected = {
			"Blank Project": {
				enabledAreas: ["Work", "Documents"],
				pinnedAreas: [] as string[],
				stages: [] as string[],
				workViews: ["Backlog", "Board"],
			},
			"Mobile Application": {
				enabledAreas: [
					"Work",
					"Documents",
					"Discovery",
					"Decisions",
					"Design",
					"Technical Diagrams",
					"Tests",
					"Releases",
					"Production",
					"GitHub",
				],
				pinnedAreas: ["Discovery", "Design", "Tests", "Releases", "Production"],
				stages: [
					"Discovery",
					"Design",
					"Build",
					"Validate",
					"Release",
					"Operate",
				],
				workViews: ["Backlog", "Board", "Roadmap"],
			},
			"Open Source Library": {
				enabledAreas: [
					"Work",
					"Documents",
					"Decisions",
					"Technical Diagrams",
					"Tests",
					"Releases",
					"GitHub",
				],
				pinnedAreas: ["GitHub", "Tests", "Releases"],
				stages: ["Scope", "Build", "Validate", "Release", "Maintain"],
				workViews: ["Backlog", "Board", "Roadmap"],
			},
			"Solo SaaS": {
				enabledAreas: [
					"Work",
					"Documents",
					"Discovery",
					"Decisions",
					"Design",
					"Technical Diagrams",
					"Tests",
					"Releases",
					"Production",
					"GitHub",
				],
				pinnedAreas: ["Discovery", "Decisions", "Design", "Tests", "Releases"],
				stages: [
					"Discovery",
					"Design",
					"Build",
					"Validate",
					"Release",
					"Operate",
				],
				workViews: ["Backlog", "Board", "Roadmap"],
			},
		} as const;
		const created = await Promise.all(
			STARTER_CONFIGURATIONS.map(async (starterConfiguration) => {
				const outcome = await createProject(
					prisma,
					createCommand(
						{
							idempotencyKey: `matrix-${starterConfiguration}`,
							name: starterConfiguration,
							starterConfiguration,
							workspaceId,
						},
						actorId
					)
				);
				expect(outcome.status).toBe("committed");
				if (outcome.status !== "committed") {
					throw new Error("expected committed Project");
				}
				const row = expected[starterConfiguration];
				expect(outcome.project.stages).toEqual(row.stages);
				expect(outcome.project.enabledAreas).toEqual(row.enabledAreas);
				expect(outcome.project.pinnedAreas).toEqual(row.pinnedAreas);
				expect(outcome.project.workViews).toEqual(row.workViews);
				expect(outcome.project.workStatuses).toEqual([
					"Not Started",
					"In Progress",
					"Blocked",
					"Closed",
				]);
				expect(outcome.project.alwaysOnSurfaces).toEqual([
					"Overview",
					"Work",
					"Documents",
					"All Tools",
				]);
				expect(outcome.project.workContextCardLayouts).toEqual([]);
				expect(outcome.project.firstOpenExplanationVisible).toBe(true);
				const allTools = Object.fromEntries(
					outcome.project.allToolsAreas.map((area) => [area.name, area])
				);
				for (const name of row.enabledAreas) {
					expect(allTools[name]).toMatchObject({
						enabled: true,
						name,
					});
				}
				for (const name of [
					"Work",
					"Documents",
					"Discovery",
					"Decisions",
					"Design",
					"Technical Diagrams",
					"Tests",
					"Releases",
					"Production",
					"GitHub",
				] as const) {
					expect(allTools[name]).toBeDefined();
					expect(allTools[name]?.enabled).toBe(
						row.enabledAreas.some((area) => area === name)
					);
					expect(allTools[name]?.pinned).toBe(
						row.pinnedAreas.some((area) => area === name)
					);
				}
				expect(await getProject(prisma, outcome.project.id)).toEqual(
					outcome.project
				);
				return outcome.project;
			})
		);
		expect(created.map((project) => project.workContextCardLayouts)).toEqual([
			[],
			[],
			[],
			[],
		]);
		const [blank] = created;
		expect(blank?.stages).toEqual([]);
		expect(
			blank?.allToolsAreas
				.filter((area) => !area.enabled)
				.map((area) => area.name)
		).toEqual([
			"Discovery",
			"Decisions",
			"Design",
			"Technical Diagrams",
			"Tests",
			"Releases",
			"Production",
			"GitHub",
		]);
	});

	it("selects the closed skeleton catalog as metadata without living Document or Wall records", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await Promise.all(
			STARTER_CONFIGURATIONS.map(async (starterConfiguration) => {
				const outcome = await createProject(
					prisma,
					createCommand(
						{
							idempotencyKey: `skeleton-${starterConfiguration}`,
							name: starterConfiguration,
							starterConfiguration,
							workspaceId,
						},
						actorId
					)
				);
				expect(outcome.status).toBe("committed");
				if (outcome.status !== "committed") {
					throw new Error("expected committed Project");
				}
				return outcome.project;
			})
		);
		const [blank, saas, library, mobile] = created;
		expect(blank?.selectedSkeletons).toEqual([]);
		expect(saas?.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(library?.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(mobile?.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(
			created.flatMap((project) => livingRecordKeys(project ?? {}))
		).toEqual([]);
		for (const project of created) {
			expect(project).not.toHaveProperty("closureSummaryDraft");
			expect(project).not.toHaveProperty("documents");
			expect(project).not.toHaveProperty("templateMarketplace");
			expect(project).not.toHaveProperty("walls");
		}
		expect(
			await Promise.all(
				created.map((project) => getProject(prisma, project?.id ?? ""))
			)
		).toEqual(created);
	});

	it("does not re-apply a Starter Configuration after create", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const blank = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "once-blank",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (blank.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const saas = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "once-saas",
					name: "Billing",
					starterConfiguration: "Solo SaaS",
					workspaceId,
				},
				actorId
			)
		);
		if (saas.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const afterOtherCreate = await getProject(prisma, blank.project.id);
		expect(afterOtherCreate?.stages).toEqual([]);
		expect(afterOtherCreate?.enabledAreas).toEqual(["Work", "Documents"]);
		expect(afterOtherCreate?.pinnedAreas).toEqual([]);
		expect(afterOtherCreate?.selectedSkeletons).toEqual([]);
		expect(afterOtherCreate?.workViews).toEqual(["Backlog", "Board"]);
		expect(afterOtherCreate?.starterConfiguration).toBe("Blank Project");
		const renamed = await updateShortCode(prisma, {
			actorId,
			baseRevision: blank.project.revision,
			idempotencyKey: "rename-does-not-reapply",
			origin: "human",
			projectId: blank.project.id,
			shortCode: "BILL",
		});
		if (renamed.status !== "committed") {
			throw new Error("expected committed Short code");
		}
		expect(renamed.project.stages).toEqual([]);
		expect(renamed.project.enabledAreas).toEqual(["Work", "Documents"]);
		expect(renamed.project.selectedSkeletons).toEqual([]);
		expect(renamed.project.starterConfiguration).toBe("Blank Project");
		expect(renamed.project.workViews).toEqual(["Backlog", "Board"]);
		expect(saas.project.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(saas.project.stages).toEqual([
			"Discovery",
			"Design",
			"Build",
			"Validate",
			"Release",
			"Operate",
		]);
	});

	it("lets the founder dismiss the first-open explanation without a tour", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "explain-blank",
					name: "Payments",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		expect(created.project.firstOpenExplanationVisible).toBe(true);
		expect(created.project.firstOpenExplanation).toContain("Blank Project");
		expect(created.project.firstOpenExplanation).toContain("All Tools");
		expect(created.project.shortCodeLocked).toBe(false);
		const dismissed = await dismissFirstOpenExplanation(prisma, {
			actorId,
			baseRevision: created.project.revision,
			idempotencyKey: "dismiss-explain",
			origin: "human",
			projectId: created.project.id,
		});
		expect(dismissed).toMatchObject({
			project: {
				enabledAreas: ["Work", "Documents"],
				firstOpenExplanationVisible: false,
				id: created.project.id,
				stages: [],
				starterConfiguration: "Blank Project",
			},
			status: "committed",
		});
		if (dismissed.status !== "committed") {
			throw new Error("expected dismissed explanation");
		}
		expect(dismissed.project.firstOpenExplanation).toBeNull();
		expect(dismissed.project.workContextCardLayouts).toEqual([]);
		const replayed = await dismissFirstOpenExplanation(prisma, {
			actorId,
			baseRevision: created.project.revision,
			idempotencyKey: "dismiss-explain",
			origin: "human",
			projectId: created.project.id,
		});
		expect(replayed.status).toBe("replayed");
		expect(await getProject(prisma, created.project.id)).toMatchObject({
			firstOpenExplanation: null,
			firstOpenExplanationVisible: false,
			stages: [],
		});
	});

	it("applies the stored Starter Configuration once when structure rows are missing", async () => {
		const { workspaceId } = await seedWorkspace(prisma);
		const projectId = crypto.randomUUID();
		await prisma.project.create({
			data: {
				hasWork: false,
				id: projectId,
				lifecycleStatus: PROJECT_LIFECYCLE.active,
				name: "Legacy",
				revision: 1,
				shortCode: "LEG",
				starterConfiguration: "Solo SaaS",
				workspaceId,
			},
		});
		const loaded = await getProject(prisma, projectId);
		expect(loaded).toMatchObject({
			enabledAreas: [
				"Work",
				"Documents",
				"Discovery",
				"Decisions",
				"Design",
				"Technical Diagrams",
				"Tests",
				"Releases",
				"Production",
				"GitHub",
			],
			pinnedAreas: ["Discovery", "Decisions", "Design", "Tests", "Releases"],
			selectedSkeletons: CLOSED_SKELETON_CATALOG,
			stages: [
				"Discovery",
				"Design",
				"Build",
				"Validate",
				"Release",
				"Operate",
			],
			starterConfiguration: "Solo SaaS",
			workStatuses: ["Not Started", "In Progress", "Blocked", "Closed"],
			workViews: ["Backlog", "Board", "Roadmap"],
		});
		expect(await getProject(prisma, projectId)).toEqual(loaded);
	});

	it("uses English Project Name and Short code chrome", () => {
		expect(PROJECT_SHELL_COPY.projectName).toBe("Project Name");
		expect(PROJECT_SHELL_COPY.shortCode).toBe("Short code");
		expect(PROJECT_SHELL_COPY.starterConfiguration).toBe(
			"Starter Configuration"
		);
		expect(PROJECT_SHELL_COPY.createProject).toBe("Create Project");
		expect(PROJECT_SHELL_COPY.shortCodeLocked).toBe(
			"Short code is locked after the first Work."
		);
		expect(PROJECT_SHELL_COPY.overview).toBe("Overview");
		expect(PROJECT_SHELL_COPY.allTools).toBe("All Tools");
		expect(PROJECT_SHELL_COPY.dismiss).toBe("Dismiss");
		expect(PROJECT_SHELL_COPY.firstOpenExplanations["Blank Project"]).toContain(
			"All Tools"
		);
		expect(PROJECT_SHELL_COPY.firstOpenExplanations["Solo SaaS"]).toContain(
			"All Tools"
		);
		expect(
			PROJECT_SHELL_COPY.firstOpenExplanations["Open Source Library"]
		).toContain("All Tools");
		expect(
			PROJECT_SHELL_COPY.firstOpenExplanations["Mobile Application"]
		).toContain("All Tools");
		expect(JSON.stringify(PROJECT_SHELL_COPY)).not.toMatch(
			COPY_BRANDING_PATTERN
		);
	});
});
