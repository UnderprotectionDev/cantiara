/**
 * Project Shell seam — create with Project Name + Starter Configuration,
 * short-code suggest/reserve, uniqueness in the Workspace, lock after
 * first Work (Work create is a test double that only exists), and
 * GitHub not required. Synthetic/real-project fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje) profile and short-code slice.
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createProject,
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

function brandingKeys(value: object): string[] {
	return Object.keys(value).filter((key) => BRANDING_KEY_PATTERN.test(key));
}

async function seedWorkspace(
	prisma: PrismaClient,
	email = "founder@example.com"
) {
	const user = await prisma.user.create({
		data: {
			email,
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
		const outcomes = await Promise.all(
			STARTER_CONFIGURATIONS.map((starterConfiguration, index) =>
				createProject(
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
			)
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

	it("uses English Project Name and Short code chrome", () => {
		expect(PROJECT_SHELL_COPY.projectName).toBe("Project Name");
		expect(PROJECT_SHELL_COPY.shortCode).toBe("Short code");
		expect(PROJECT_SHELL_COPY.starterConfiguration).toBe(
			"Starter Configuration"
		);
		expect(PROJECT_SHELL_COPY.createProject).toBe("Create Project");
		expect(JSON.stringify(PROJECT_SHELL_COPY)).not.toMatch(
			COPY_BRANDING_PATTERN
		);
	});
});
