/**
 * Project Shell seam — create with Project Name + Starter Configuration,
 * short-code suggest/reserve, uniqueness in the Workspace, lock after
 * first Work (Work create is a test double that only exists), GitHub
 * not required, four-configuration apply-once matrix, no sample
 * content, dismissible first-open explanation, and skeleton catalog
 * selection metadata without living Document or Wall records, and copy
 * of current structure into a contentless new Project without records,
 * history, or a re-applied Starter Configuration. Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje selection half; Başlangıç iskeletleri golden living
 * structures wait on 31 and 51).
 */
import { getPrismaClient, PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	configureProject,
	copyProjectStructure,
	createProject,
	dismissFirstOpenExplanation,
	getProject,
	listProjects,
	permanentlyDeleteProject,
	previewCopyProjectStructure,
	recordWorkExists,
	suggestShortCode,
	updateShortCode,
} from "./project-shell";
import {
	CONFIGURATION_MODE_EDITORS,
	configurationModeView,
	PROJECT_AREAS,
	PROJECT_LIFECYCLE,
	PROJECT_SHELL_COPY,
	PROTECTED_WORK_STATUSES,
	pinnedNavigationAreas,
	STAGE_STATES,
	STARTER_CONFIGURATIONS,
	type StructureChange,
	stageRemovalPreview,
	stageRemovalPreviewCopy,
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

const DEFAULT_WORK_STATUSES = [
	{ label: "Not Started", semantic: "Not Started" },
	{ label: "In Progress", semantic: "In Progress" },
	{ label: "Blocked", semantic: "Blocked" },
	{ label: "Closed", semantic: "Closed" },
] as const;

const LOOKUP_FORMULA_PATTERN = /lookup|formula/i;
const OVERVIEW_MODULE_PATTERN =
	/attentionRequired|dashboard|healthScore|overviewModule/i;
const TEST_PRODUCT_PATTERN =
	/plannedTest|testHandoff|testSession|testGap|testAssessment/i;
const WORKSPACE_FIELD_ID_PATTERN = /workspaceFieldId/i;

function stageNames(project: { stages: Array<{ name: string }> }) {
	return project.stages.map((stage) => stage.name);
}

function stageStates(project: { stages: Array<{ state: string }> }) {
	return project.stages.map((stage) => stage.state);
}

function workStatusSemantics(project: {
	workStatuses: Array<{ semantic: string }>;
}) {
	return project.workStatuses.map((status) => status.semantic);
}

function configureCommand(
	input: {
		baseRevision: number;
		change: StructureChange;
		idempotencyKey: string;
		projectId: string;
	},
	actorId: string
) {
	return {
		actorId,
		baseRevision: input.baseRevision,
		change: input.change,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		projectId: input.projectId,
	};
}

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

function copyCommand(
	input: {
		idempotencyKey?: string;
		name?: string;
		shortCode?: string;
		sourceProjectId: string;
		workspaceId: string;
	},
	actorId = ACTOR_ID
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			name: input.name,
			shortCode: input.shortCode,
			sourceProjectId: input.sourceProjectId,
		},
		workspaceId: input.workspaceId,
	};
}

async function customizeBlankStructure(
	prisma: PrismaClient,
	source: {
		id: string;
		revision: number;
	},
	actorId: string
) {
	const added = await configureProject(
		prisma,
		configureCommand(
			{
				baseRevision: source.revision,
				change: { action: "add-stage", name: "Discovery" },
				idempotencyKey: "copy-add-discovery",
				projectId: source.id,
			},
			actorId
		)
	);
	if (added.status !== "committed") {
		throw new Error("expected added stage");
	}
	const activated = await configureProject(
		prisma,
		configureCommand(
			{
				baseRevision: added.project.revision,
				change: {
					action: "set-stage-state",
					stageId: added.project.stages[0]?.id ?? "",
					state: "Active",
				},
				idempotencyKey: "copy-activate-discovery",
				projectId: source.id,
			},
			actorId
		)
	);
	if (activated.status !== "committed") {
		throw new Error("expected Active stage");
	}
	const enabled = await configureProject(
		prisma,
		configureCommand(
			{
				baseRevision: activated.project.revision,
				change: {
					action: "set-area-enabled",
					area: "Tests",
					enabled: true,
				},
				idempotencyKey: "copy-enable-tests",
				projectId: source.id,
			},
			actorId
		)
	);
	if (enabled.status !== "committed") {
		throw new Error("expected enabled Tests");
	}
	const pinned = await configureProject(
		prisma,
		configureCommand(
			{
				baseRevision: enabled.project.revision,
				change: { action: "pin-to-navigation", area: "Tests" },
				idempotencyKey: "copy-pin-tests",
				projectId: source.id,
			},
			actorId
		)
	);
	if (pinned.status !== "committed") {
		throw new Error("expected pinned Tests");
	}
	const renamed = await configureProject(
		prisma,
		configureCommand(
			{
				baseRevision: pinned.project.revision,
				change: {
					action: "rename-work-status",
					label: "Todo",
					semantic: "Not Started",
				},
				idempotencyKey: "copy-rename-status",
				projectId: source.id,
			},
			actorId
		)
	);
	if (renamed.status !== "committed") {
		throw new Error("expected renamed Work status");
	}
	return renamed.project;
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
				expect(stageNames(outcome.project)).toEqual(row.stages);
				expect(stageStates(outcome.project)).toEqual(
					row.stages.map(() => "Not Planned")
				);
				expect(outcome.project.enabledAreas).toEqual(row.enabledAreas);
				expect(outcome.project.pinnedAreas).toEqual(row.pinnedAreas);
				expect(outcome.project.workViews).toEqual(row.workViews);
				expect(outcome.project.workStatuses).toEqual(DEFAULT_WORK_STATUSES);
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
		expect(stageNames(saas.project)).toEqual([
			"Discovery",
			"Design",
			"Build",
			"Validate",
			"Release",
			"Operate",
		]);
		expect(stageStates(saas.project)).toEqual([
			"Not Planned",
			"Not Planned",
			"Not Planned",
			"Not Planned",
			"Not Planned",
			"Not Planned",
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
			starterConfiguration: "Solo SaaS",
			workStatuses: DEFAULT_WORK_STATUSES,
			workViews: ["Backlog", "Board", "Roadmap"],
		});
		expect(stageNames(loaded ?? { stages: [] })).toEqual([
			"Discovery",
			"Design",
			"Build",
			"Validate",
			"Release",
			"Operate",
		]);
		expect(await getProject(prisma, projectId)).toEqual(loaded);
	});

	it("toggles Configuration Mode on and off without mutating the Project", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "configuration-mode-blank",
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
		const before = await getProject(prisma, created.project.id);
		expect(before).toEqual(created.project);
		const closed = configurationModeView({
			open: false,
			savedViews: created.project.workViews,
		});
		expect(closed).toEqual({
			active: false,
			customFieldEditorOpen: false,
			dailyActions: ["Create", "Edit", "Status", "Planning"],
			hosts: [],
			label: "Configuration Mode",
			savedViews: ["Backlog", "Board"],
			workContextCardLayoutEditorOpen: false,
		});
		const opened = configurationModeView({
			open: true,
			savedViews: created.project.workViews,
		});
		expect(opened).toEqual({
			active: true,
			customFieldEditorOpen: false,
			dailyActions: ["Create", "Edit", "Status", "Planning"],
			hosts: [
				"Stages",
				"Work statuses",
				"Project areas",
				"Custom field",
				"Priority metrics",
				"Saved views",
				"Work Context Card layout",
			],
			label: "Configuration Mode",
			savedViews: ["Backlog", "Board"],
			workContextCardLayoutEditorOpen: false,
		});
		expect(opened.hosts).not.toContain("Planning");
		const closedAgain = configurationModeView({
			editor: CONFIGURATION_MODE_EDITORS.customField,
			open: false,
			savedViews: created.project.workViews,
		});
		expect(closedAgain).toEqual({
			active: false,
			customFieldEditorOpen: false,
			dailyActions: ["Create", "Edit", "Status", "Planning"],
			hosts: [],
			label: "Configuration Mode",
			savedViews: ["Backlog", "Board"],
			workContextCardLayoutEditorOpen: false,
		});
		const after = await getProject(prisma, created.project.id);
		expect(after).toEqual(before);
		expect(after?.revision).toBe(created.project.revision);
		expect(after?.lifecycleStatus).toBe(PROJECT_LIFECYCLE.active);
		expect(after?.enabledAreas).toEqual(["Work", "Documents"]);
		expect(after?.workViews).toEqual(["Backlog", "Board"]);
		expect(after?.workStatuses).toEqual(DEFAULT_WORK_STATUSES);
	});

	it("opens Custom field and Work Context Card layout editors without owning schema or layout", () => {
		const customField = configurationModeView({
			editor: CONFIGURATION_MODE_EDITORS.customField,
			open: true,
			savedViews: ["Backlog", "Board"],
		});
		expect(customField).toEqual({
			active: true,
			customFieldEditorOpen: true,
			dailyActions: ["Create", "Edit", "Status", "Planning"],
			hosts: [
				"Stages",
				"Work statuses",
				"Project areas",
				"Custom field",
				"Priority metrics",
				"Saved views",
				"Work Context Card layout",
			],
			label: "Configuration Mode",
			savedViews: ["Backlog", "Board"],
			workContextCardLayoutEditorOpen: false,
		});
		const layout = configurationModeView({
			editor: CONFIGURATION_MODE_EDITORS.workContextCardLayout,
			open: true,
			savedViews: ["Backlog", "Board"],
		});
		expect(layout).toEqual({
			active: true,
			customFieldEditorOpen: false,
			dailyActions: ["Create", "Edit", "Status", "Planning"],
			hosts: [
				"Stages",
				"Work statuses",
				"Project areas",
				"Custom field",
				"Priority metrics",
				"Saved views",
				"Work Context Card layout",
			],
			label: "Configuration Mode",
			savedViews: ["Backlog", "Board"],
			workContextCardLayoutEditorOpen: true,
		});
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
		expect(PROJECT_SHELL_COPY.configurationMode).toBe("Configuration Mode");
		expect(PROJECT_SHELL_COPY.savedViews).toBe("Saved views");
		expect(PROJECT_SHELL_COPY.planning).toBe("Planning");
		expect(PROJECT_SHELL_COPY.customField).toBe("Custom field");
		expect(PROJECT_SHELL_COPY.workContextCardLayout).toBe(
			"Work Context Card layout"
		);
		expect(PROJECT_SHELL_COPY.pinToNavigation).toBe("Pin to navigation");
		expect(PROJECT_SHELL_COPY.restoreDefaultNavigation).toBe(
			"Restore default navigation"
		);
		expect(PROJECT_SHELL_COPY.copyProjectStructure).toBe(
			"Copy project structure"
		);
		expect(PROJECT_SHELL_COPY.notPlanned).toBe("Not Planned");
		expect(PROJECT_SHELL_COPY.ready).toBe("Ready");
		expect(PROJECT_SHELL_COPY.hide).toBe("Hide");
		expect(PROJECT_SHELL_COPY.enable).toBe("Enable");
		expect(PROJECT_SHELL_COPY.addStage).toBe("Add stage");
		expect(PROJECT_SHELL_COPY.removeStage).toBe("Remove stage");
		expect(PROJECT_SHELL_COPY.save).toBe("Save");
		expect(STAGE_STATES).toEqual([
			"Not Planned",
			"Ready",
			"Active",
			"Completed",
			"Abandoned",
		]);
		expect(PROJECT_AREAS).toEqual([
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
		]);
		expect(PROTECTED_WORK_STATUSES).toEqual([
			"Not Started",
			"In Progress",
			"Blocked",
			"Closed",
		]);
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
		expect(JSON.stringify(PROJECT_SHELL_COPY)).not.toMatch(
			LOOKUP_FORMULA_PATTERN
		);
	});

	it("lets several stages be Active at once without writing Work status", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "stages-saas",
					name: "Atlas",
					starterConfiguration: "Solo SaaS",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		expect(STAGE_STATES).toEqual([
			"Not Planned",
			"Ready",
			"Active",
			"Completed",
			"Abandoned",
		]);
		const [discovery, design] = created.project.stages;
		if (!(discovery && design)) {
			throw new Error("expected prepared stages");
		}
		const first = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: {
						action: "set-stage-state",
						stageId: discovery.id,
						state: "Active",
					},
					idempotencyKey: "activate-discovery",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (first.status !== "committed") {
			throw new Error("expected Active Discovery");
		}
		const second = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: first.project.revision,
					change: {
						action: "set-stage-state",
						stageId: design.id,
						state: "Active",
					},
					idempotencyKey: "activate-design",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (second.status !== "committed") {
			throw new Error("expected Active Design");
		}
		expect(second.project.stages[0]).toMatchObject({
			name: "Discovery",
			state: "Active",
		});
		expect(second.project.stages[1]).toMatchObject({
			name: "Design",
			state: "Active",
		});
		expect(second.project.workStatuses).toEqual(DEFAULT_WORK_STATUSES);
		expect(
			await configureProject(
				prisma,
				configureCommand(
					{
						baseRevision: second.project.revision,
						change: {
							action: "set-stage-state",
							stageId: discovery.id,
							state: "Queued",
						},
						idempotencyKey: "unknown-state",
						projectId: created.project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-stage-state",
			status: "rejected",
		});
	});

	it("adds, renames, reorders, and removes stages without deleting main records", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "blank-stages",
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
		const added = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: { action: "add-stage", name: "Discovery" },
					idempotencyKey: "add-discovery",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (added.status !== "committed") {
			throw new Error("expected added stage");
		}
		expect(added.project.stages).toEqual([
			{
				id: added.project.stages[0]?.id,
				name: "Discovery",
				state: "Not Planned",
			},
		]);
		const second = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: added.project.revision,
					change: { action: "add-stage", name: "Build" },
					idempotencyKey: "add-build",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (second.status !== "committed") {
			throw new Error("expected second stage");
		}
		const renamed = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: second.project.revision,
					change: {
						action: "rename-stage",
						name: "Scope",
						stageId: second.project.stages[0]?.id ?? "",
					},
					idempotencyKey: "rename-discovery",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (renamed.status !== "committed") {
			throw new Error("expected renamed stage");
		}
		expect(stageNames(renamed.project)).toEqual(["Scope", "Build"]);
		const reordered = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: renamed.project.revision,
					change: {
						action: "reorder-stages",
						stageIds: [
							renamed.project.stages[1]?.id ?? "",
							renamed.project.stages[0]?.id ?? "",
						],
					},
					idempotencyKey: "reorder-stages",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (reordered.status !== "committed") {
			throw new Error("expected reordered stages");
		}
		expect(stageNames(reordered.project)).toEqual(["Build", "Scope"]);
		const preview = stageRemovalPreview(
			reordered.project.stages[0]?.name ?? ""
		);
		expect(preview).toEqual({
			filters: ["Build"],
			mainRecordsDeleted: false,
			presentation: ["Build"],
			workStatusWritten: false,
		});
		expect(stageRemovalPreviewCopy("Build")).toBe(
			"Build will leave presentation and filters. Main records are not deleted."
		);
		const removed = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: reordered.project.revision,
					change: {
						action: "remove-stage",
						stageId: reordered.project.stages[0]?.id ?? "",
					},
					idempotencyKey: "remove-build",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (removed.status !== "committed") {
			throw new Error("expected removed stage");
		}
		expect(stageNames(removed.project)).toEqual(["Scope"]);
		expect(removed.project.id).toBe(created.project.id);
		expect(removed.project.workStatuses).toEqual(DEFAULT_WORK_STATUSES);
		expect(removed.project.enabledAreas).toEqual(["Work", "Documents"]);
		expect(removed.project.lifecycleStatus).toBe(PROJECT_LIFECYCLE.active);
		expect(await getProject(prisma, created.project.id)).toEqual(
			removed.project
		);
	});

	it("hides and enables closed catalog areas without deleting records or closing always-on surfaces", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "hide-saas",
					name: "Atlas",
					starterConfiguration: "Solo SaaS",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const historyBefore = {
			selectedSkeletons: created.project.selectedSkeletons,
			stages: created.project.stages,
			workStatuses: created.project.workStatuses,
		};
		const hidden = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: {
						action: "set-area-enabled",
						area: "Discovery",
						enabled: false,
					},
					idempotencyKey: "hide-discovery",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (hidden.status !== "committed") {
			throw new Error("expected hidden Discovery");
		}
		expect(hidden.project.enabledAreas).not.toContain("Discovery");
		expect(hidden.project.pinnedAreas).toContain("Discovery");
		expect(
			pinnedNavigationAreas(
				hidden.project.pinnedAreas,
				hidden.project.enabledAreas
			)
		).not.toContain("Discovery");
		expect(hidden.project.alwaysOnSurfaces).toEqual([
			"Overview",
			"Work",
			"Documents",
			"All Tools",
		]);
		expect(hidden.project.stages).toEqual(historyBefore.stages);
		expect(hidden.project.workStatuses).toEqual(historyBefore.workStatuses);
		expect(hidden.project.selectedSkeletons).toEqual(
			historyBefore.selectedSkeletons
		);
		expect(
			hidden.project.allToolsAreas.find((area) => area.name === "Discovery")
		).toMatchObject({ enabled: false, name: "Discovery", pinned: true });
		const shown = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: hidden.project.revision,
					change: {
						action: "set-area-enabled",
						area: "Discovery",
						enabled: true,
					},
					idempotencyKey: "show-discovery",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (shown.status !== "committed") {
			throw new Error("expected shown Discovery");
		}
		expect(shown.project.enabledAreas).toContain("Discovery");
		expect(shown.project.stages).toEqual(historyBefore.stages);
		expect(
			await configureProject(
				prisma,
				configureCommand(
					{
						baseRevision: shown.project.revision,
						change: {
							action: "set-area-enabled",
							area: "Overview",
							enabled: false,
						},
						idempotencyKey: "hide-overview",
						projectId: created.project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "not-a-project-area",
			status: "rejected",
		});
		expect(
			await configureProject(
				prisma,
				configureCommand(
					{
						baseRevision: shown.project.revision,
						change: {
							action: "set-area-enabled",
							area: "All Tools",
							enabled: false,
						},
						idempotencyKey: "hide-all-tools",
						projectId: created.project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "not-a-project-area",
			status: "rejected",
		});
		expect(await getProject(prisma, created.project.id)).toMatchObject({
			alwaysOnSurfaces: ["Overview", "Work", "Documents", "All Tools"],
			enabledAreas: expect.arrayContaining(["Discovery"]),
		});
	});

	it("pins and restores default navigation without changing enablement", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "pin-blank",
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
		const hidden = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: {
						action: "set-area-enabled",
						area: "Tests",
						enabled: false,
					},
					idempotencyKey: "keep-tests-hidden",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (hidden.status !== "committed") {
			throw new Error("expected Tests still hidden");
		}
		expect(hidden.project.enabledAreas).toEqual(["Work", "Documents"]);
		const pinned = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: hidden.project.revision,
					change: { action: "pin-to-navigation", area: "Tests" },
					idempotencyKey: "pin-tests",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (pinned.status !== "committed") {
			throw new Error("expected pinned Tests");
		}
		expect(pinned.project.pinnedAreas).toEqual(["Tests"]);
		expect(pinned.project.enabledAreas).toEqual(["Work", "Documents"]);
		expect(
			pinned.project.allToolsAreas.find((area) => area.name === "Tests")
		).toMatchObject({ enabled: false, pinned: true });
		const restored = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: pinned.project.revision,
					change: { action: "restore-default-navigation" },
					idempotencyKey: "restore-nav",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (restored.status !== "committed") {
			throw new Error("expected restored navigation");
		}
		expect(restored.project.pinnedAreas).toEqual([]);
		expect(restored.project.enabledAreas).toEqual(["Work", "Documents"]);
		expect(
			await configureProject(
				prisma,
				configureCommand(
					{
						baseRevision: restored.project.revision,
						change: { action: "pin-to-navigation", area: "Overview" },
						idempotencyKey: "pin-overview",
						projectId: created.project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "not-a-project-area",
			status: "rejected",
		});
	});

	it("renames Work status labels without adding values or rewriting semantics", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "status-blank",
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
		const renamed = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: {
						action: "rename-work-status",
						label: "Todo",
						semantic: "Not Started",
					},
					idempotencyKey: "rename-not-started",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (renamed.status !== "committed") {
			throw new Error("expected renamed Work status");
		}
		expect(renamed.project.workStatuses).toEqual([
			{ label: "Todo", semantic: "Not Started" },
			{ label: "In Progress", semantic: "In Progress" },
			{ label: "Blocked", semantic: "Blocked" },
			{ label: "Closed", semantic: "Closed" },
		]);
		expect(workStatusSemantics(renamed.project)).toEqual([
			"Not Started",
			"In Progress",
			"Blocked",
			"Closed",
		]);
		expect(renamed.project.stages).toEqual([]);
		expect(
			await configureProject(
				prisma,
				configureCommand(
					{
						baseRevision: renamed.project.revision,
						change: {
							action: "rename-work-status",
							label: "Done",
							semantic: "Done",
						},
						idempotencyKey: "unknown-semantic",
						projectId: created.project.id,
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-work-status",
			status: "rejected",
		});
		expect(
			await configureProject(prisma, {
				actorId,
				baseRevision: renamed.project.revision,
				change: {
					action: "add-work-status",
					name: "Review",
				},
				idempotencyKey: "add-status",
				origin: "human",
				projectId: created.project.id,
			})
		).toEqual({
			reason: "unknown-structure-action",
			status: "rejected",
		});
		expect(await getProject(prisma, created.project.id)).toEqual(
			renamed.project
		);
	});

	it("enables Tests without creating a test product or Lookup Formula fields", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "enable-tests",
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
		const enabled = await configureProject(
			prisma,
			configureCommand(
				{
					baseRevision: created.project.revision,
					change: {
						action: "set-area-enabled",
						area: "Tests",
						enabled: true,
					},
					idempotencyKey: "enable-tests-area",
					projectId: created.project.id,
				},
				actorId
			)
		);
		if (enabled.status !== "committed") {
			throw new Error("expected enabled Tests");
		}
		expect(enabled.project.enabledAreas).toEqual([
			"Work",
			"Documents",
			"Tests",
		]);
		expect(JSON.stringify(enabled.project)).not.toMatch(TEST_PRODUCT_PATTERN);
		expect(JSON.stringify(enabled.project)).not.toMatch(LOOKUP_FORMULA_PATTERN);
		expect(JSON.stringify(enabled.project)).not.toMatch(
			OVERVIEW_MODULE_PATTERN
		);
		expect(enabled.project).not.toHaveProperty("plannedTestCases");
		expect(enabled.project).not.toHaveProperty("lookupFields");
		expect(enabled.project).not.toHaveProperty("formulaFields");
		expect(enabled.project).not.toHaveProperty("overviewModules");
		expect(
			configurationModeView({ open: true, savedViews: ["Backlog"] }).hosts
		).not.toContain("Lookup");
		expect(
			configurationModeView({ open: true, savedViews: ["Backlog"] }).hosts
		).not.toContain("Formula");
	});

	it("previews Copy project structure without starter configuration, records, or a Workspace field identity", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "preview-source",
					name: "Payments",
					purpose: "Ship the workspace",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const source = await customizeBlankStructure(
			prisma,
			created.project,
			actorId
		);
		const preview = await previewCopyProjectStructure(prisma, source.id);
		expect(preview).toEqual({
			customFieldDefinitions: [],
			emptyWallSkeletonDefinitions: [],
			enabledAreas: ["Work", "Documents", "Tests"],
			excluded: {
				automationRules: true,
				cards: true,
				history: true,
				plannedTestCases: true,
				records: true,
				relations: true,
				workTemplates: true,
			},
			pinnedAreas: ["Tests"],
			priorityMetricDefinitions: [],
			selectedSkeletons: [],
			stages: [{ name: "Discovery", state: "Active" }],
			starterConfigurationOffered: false,
			workContextCardLayouts: [],
			workStatuses: [
				{ label: "Todo", semantic: "Not Started" },
				{ label: "In Progress", semantic: "In Progress" },
				{ label: "Blocked", semantic: "Blocked" },
				{ label: "Closed", semantic: "Closed" },
			],
			workViews: ["Backlog", "Board"],
		});
		expect(preview).not.toHaveProperty("name");
		expect(preview).not.toHaveProperty("starterConfiguration");
		expect(preview).not.toHaveProperty("purpose");
		expect(JSON.stringify(preview)).not.toMatch(WORKSPACE_FIELD_ID_PATTERN);
		expect(preview).not.toHaveProperty("plannedTestCases");
		expect(preview?.excluded.plannedTestCases).toBe(true);
		expect(preview).not.toHaveProperty("walls");
		expect(preview).not.toHaveProperty("documents");
		expect(preview).not.toHaveProperty("workTemplates");
	});

	it("copies customized structure into a contentless Project and leaves the source unchanged", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "copy-source",
					name: "Payments",
					purpose: "Ship the workspace",
					starterConfiguration: "Blank Project",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const source = await customizeBlankStructure(
			prisma,
			created.project,
			actorId
		);
		const before = await getProject(prisma, source.id);
		const copied = await copyProjectStructure(
			prisma,
			copyCommand(
				{
					idempotencyKey: "copy-north",
					name: "North",
					sourceProjectId: source.id,
					workspaceId,
				},
				actorId
			)
		);
		expect(copied).toMatchObject({
			project: {
				customFieldDefinitions: [],
				enabledAreas: ["Work", "Documents", "Tests"],
				firstOpenExplanationVisible: false,
				lifecycleStatus: PROJECT_LIFECYCLE.active,
				logoFileName: null,
				name: "North",
				pinnedAreas: ["Tests"],
				priorityMetricDefinitions: [],
				problem: null,
				purpose: null,
				scope: null,
				selectedSkeletons: [],
				shortCode: "NOR",
				shortCodeLocked: false,
				starterConfiguration: "Blank Project",
				targetDate: null,
				workContextCardLayouts: [],
				workStatuses: [
					{ label: "Todo", semantic: "Not Started" },
					{ label: "In Progress", semantic: "In Progress" },
					{ label: "Blocked", semantic: "Blocked" },
					{ label: "Closed", semantic: "Closed" },
				],
				workViews: ["Backlog", "Board"],
			},
			status: "committed",
		});
		if (copied.status !== "committed") {
			throw new Error("expected copied Project");
		}
		expect(copied.project.id).not.toBe(source.id);
		expect(stageNames(copied.project)).toEqual(["Discovery"]);
		expect(stageStates(copied.project)).toEqual(["Active"]);
		expect(copied.project.stages.map((stage) => stage.id)).not.toEqual(
			source.stages.map((stage) => stage.id)
		);
		expect(copied.project).not.toHaveProperty("workspaceFieldId");
		expect(copied.project).not.toHaveProperty("plannedTestCases");
		expect(copied.project).not.toHaveProperty("workTemplates");
		expect(copied.project).not.toHaveProperty("automationRules");
		expect(copied.project).not.toHaveProperty("walls");
		expect(copied.project).not.toHaveProperty("documents");
		expect(copied.project).not.toHaveProperty("history");
		expect(copied.project).not.toHaveProperty("relations");
		expect(livingRecordKeys(copied.project)).toEqual([]);
		expect(JSON.stringify(copied.project)).not.toMatch(TEST_PRODUCT_PATTERN);
		expect(await getProject(prisma, source.id)).toEqual(before);
		expect(before?.revision).toBe(source.revision);
		expect(await listProjects(prisma, workspaceId)).toEqual([
			before,
			copied.project,
		]);
		const replayed = await copyProjectStructure(
			prisma,
			copyCommand(
				{
					idempotencyKey: "copy-north",
					name: "North",
					sourceProjectId: source.id,
					workspaceId,
				},
				actorId
			)
		);
		expect(replayed).toEqual({
			project: copied.project,
			status: "replayed",
		});
	});

	it("copies empty wall skeleton definitions without living Walls, templates, or a contentful fork", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "copy-saas-source",
					name: "Atlas",
					starterConfiguration: "Solo SaaS",
					workspaceId,
				},
				actorId
			)
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const preview = await previewCopyProjectStructure(
			prisma,
			created.project.id
		);
		expect(preview?.emptyWallSkeletonDefinitions).toEqual(
			CLOSED_SKELETON_CATALOG.filter(
				(skeleton) => skeleton.surface === "Project Wall"
			)
		);
		expect(preview?.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(preview?.starterConfigurationOffered).toBe(false);
		expect(preview?.excluded).toEqual({
			automationRules: true,
			cards: true,
			history: true,
			plannedTestCases: true,
			records: true,
			relations: true,
			workTemplates: true,
		});
		const copied = await copyProjectStructure(
			prisma,
			copyCommand(
				{
					idempotencyKey: "copy-saas",
					name: "Beacon",
					sourceProjectId: created.project.id,
					workspaceId,
				},
				actorId
			)
		);
		if (copied.status !== "committed") {
			throw new Error("expected copied Project");
		}
		expect(stageNames(copied.project)).toEqual(stageNames(created.project));
		expect(copied.project.enabledAreas).toEqual(created.project.enabledAreas);
		expect(copied.project.pinnedAreas).toEqual(created.project.pinnedAreas);
		expect(copied.project.workViews).toEqual(created.project.workViews);
		expect(copied.project.selectedSkeletons).toEqual(CLOSED_SKELETON_CATALOG);
		expect(copied.project.name).toBe("Beacon");
		expect(copied.project.name).not.toBe(created.project.name);
		expect(copied.project).not.toHaveProperty("walls");
		expect(copied.project).not.toHaveProperty("documents");
		expect(copied.project).not.toHaveProperty("templateMarketplace");
		expect(copied.project).not.toHaveProperty("duplicateProject");
		expect(livingRecordKeys(copied.project)).toEqual([]);
		expect(await getProject(prisma, created.project.id)).toEqual(
			created.project
		);
	});

	it("requires a founder-entered Project Name and a Workspace-unique Short code", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(
			prisma,
			createCommand(
				{
					idempotencyKey: "copy-validate-source",
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
		expect(
			await copyProjectStructure(
				prisma,
				copyCommand(
					{
						idempotencyKey: "copy-missing-name",
						sourceProjectId: created.project.id,
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
			await copyProjectStructure(
				prisma,
				copyCommand(
					{
						idempotencyKey: "copy-taken-code",
						name: "North",
						shortCode: "PAY",
						sourceProjectId: created.project.id,
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
			await copyProjectStructure(
				prisma,
				copyCommand(
					{
						idempotencyKey: "copy-invalid-code",
						name: "North",
						shortCode: "N",
						sourceProjectId: created.project.id,
						workspaceId,
					},
					actorId
				)
			)
		).toEqual({
			reason: "short-code-invalid",
			status: "rejected",
		});
		expect(await listProjects(prisma, workspaceId)).toEqual([created.project]);
	});

	it("drops a Prisma client that cannot record skeleton catalog selection", () => {
		const productPrisma = getPrismaClient();
		expect(typeof productPrisma.projectSkeletonSelection.findMany).toBe(
			"function"
		);
	});

	it("loads Work and WorkLifecycleEvent delegates from the generated client on disk", () => {
		const productPrisma = getPrismaClient();
		expect(typeof productPrisma.work.create).toBe("function");
		expect(typeof productPrisma.workLifecycleEvent.findMany).toBe("function");
	});
});
