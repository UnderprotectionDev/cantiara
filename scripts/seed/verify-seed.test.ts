import { describe, expect, it } from "bun:test";

import { disconnectSeedPrismaClient, getSeedPrismaClient } from "./prisma";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

describe("dev seed verification", () => {
	it("loads expected demo projects and work in the database", async () => {
		process.env.DATABASE_URL = DATABASE_URL;
		const prisma = getSeedPrismaClient();

		const workspace = await prisma.workspace.findFirst({
			orderBy: { createdAt: "asc" },
		});
		if (!workspace) {
			throw new Error("expected a workspace after seed");
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
			throw new Error("expected Cantiara project");
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

		await disconnectSeedPrismaClient();
	});
});
