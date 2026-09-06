import { describe, expect, it } from "bun:test";

import "./env.ts";
import { localTestDatabaseUrl } from "../../packages/db/src/local-test-database-url.ts";
import { clearWorkspace } from "./clear-workspace";
import {
	seedProject,
	seedProjectScreen,
	seedProjectUserFlow,
	seedProjectWall,
	seedStarterSkeletonWalls,
} from "./helpers/domain";
import { disconnectSeedPrismaClient, getSeedPrismaClient } from "./prisma";

const DATABASE_URL = localTestDatabaseUrl();

describe("dev seed verification", () => {
	it("loads expected demo projects and work in the database", async () => {
		process.env.DATABASE_URL = DATABASE_URL;
		const prisma = getSeedPrismaClient();

		const workspace = await prisma.workspace.findFirst({
			orderBy: { createdAt: "asc" },
		});
		if (!workspace) {
			return;
		}

		const projects = await prisma.project.findMany({
			orderBy: { name: "asc" },
			where: { workspaceId: workspace.id },
		});
		expect(projects.map((project) => project.shortCode).sort()).toEqual([
			"CNT",
			"MOB",
			"ODS",
			"SCR",
		]);

		const cantiara = projects.find((project) => project.shortCode === "CNT");
		if (!cantiara) {
			return;
		}

		const cantiaraWork = await prisma.work.findMany({
			where: { projectId: cantiara.id },
		});
		expect(cantiaraWork.length).toBeGreaterThanOrEqual(9);

		const keys = cantiaraWork.map((work) => work.key);
		expect(keys.some((key) => key.startsWith("CNT-"))).toBe(true);
		expect(
			cantiaraWork.some(
				(work) => work.type === "Feature" && work.status === "In Progress"
			)
		).toBe(true);
		expect(
			cantiaraWork.some(
				(work) => work.type === "Bug" && work.status === "Blocked"
			)
		).toBe(true);
		expect(cantiaraWork.some((work) => work.status === "Closed")).toBe(true);

		const totalWork = await prisma.work.count({
			where: { projectId: { in: projects.map((project) => project.id) } },
		});

		const [documents, tags, blockers, milestones] = await Promise.all([
			prisma.document.count({ where: { workspaceId: workspace.id } }),
			prisma.tag.count({ where: { workspaceId: workspace.id } }),
			prisma.typedRelation.count({
				where: { blockerState: "Active", type: "Blocks" },
			}),
			prisma.milestone.count({ where: { projectId: cantiara.id } }),
		]);

		expect(totalWork).toBe(20);
		expect(documents).toBe(3);
		expect(tags).toBe(2);
		expect(blockers).toBeGreaterThanOrEqual(1);
		expect(milestones).toBe(1);

		const [screens, walls, flows] = await Promise.all([
			prisma.screen.count({ where: { projectId: cantiara.id } }),
			prisma.design.count({
				where: { projectId: cantiara.id, type: "Project Wall" },
			}),
			prisma.userFlow.count({ where: { projectId: cantiara.id } }),
		]);
		expect(screens).toBeGreaterThanOrEqual(1);
		expect(walls).toBeGreaterThanOrEqual(1);
		expect(flows).toBeGreaterThanOrEqual(1);

		await disconnectSeedPrismaClient();
	});

	it("seeds Screen, Project Wall, and User Flow on Cantiara", async () => {
		process.env.DATABASE_URL = DATABASE_URL;
		const prisma = getSeedPrismaClient();
		const user = await prisma.user.create({
			data: {
				email: `seed-design-${crypto.randomUUID()}@example.com`,
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Seed Founder",
			},
		});
		const workspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Seed Workspace",
				ownerId: user.id,
			},
		});
		const prefix = `seed-design-${crypto.randomUUID()}`;
		try {
			const ctx = {
				actorId: user.id,
				dryRun: false,
				prisma,
				workspaceId: workspace.id,
			};
			const project = await seedProject(ctx, {
				name: "Cantiara",
				prefix,
				shortCode: "SDD",
				starterConfiguration: "Solo SaaS",
			});
			await seedStarterSkeletonWalls(ctx, {
				prefix: `${prefix}-walls`,
				projectId: project.id,
			});
			await seedProjectWall(ctx, {
				name: "Checkout narrative",
				prefix: `${prefix}-checkout-wall`,
				projectId: project.id,
			});
			await seedProjectScreen(ctx, {
				prefix: `${prefix}-checkout-screen`,
				projectId: project.id,
				title: "Checkout",
			});
			await seedProjectUserFlow(ctx, {
				prefix: `${prefix}-guest-flow`,
				projectId: project.id,
				title: "Guest checkout",
			});
			const [screens, walls, flows] = await Promise.all([
				prisma.screen.count({ where: { projectId: project.id } }),
				prisma.design.count({
					where: { projectId: project.id, type: "Project Wall" },
				}),
				prisma.userFlow.count({ where: { projectId: project.id } }),
			]);
			expect(screens).toBeGreaterThanOrEqual(1);
			expect(walls).toBeGreaterThanOrEqual(1);
			expect(flows).toBeGreaterThanOrEqual(1);
			expect(
				await prisma.screen.findFirst({
					where: { projectId: project.id, title: "Checkout" },
				})
			).not.toBeNull();
			expect(
				await prisma.design.findFirst({
					where: {
						name: "Checkout narrative",
						projectId: project.id,
						type: "Project Wall",
					},
				})
			).not.toBeNull();
			expect(
				await prisma.userFlow.findFirst({
					where: { projectId: project.id, title: "Guest checkout" },
				})
			).not.toBeNull();
		} finally {
			await clearWorkspace(prisma, workspace.id, user.id);
			await prisma.workspace.delete({ where: { id: workspace.id } });
			await prisma.user.delete({ where: { id: user.id } });
			await disconnectSeedPrismaClient();
		}
	});
});
