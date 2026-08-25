/**
 * Account Access seam — Prisma migrations must create Better Auth tables
 * before Workspace can reference them. Hosted Neon only applies these files;
 * local `db push` is not the product schema path.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_FOLDER = /^\d+_/;

function prismaMigrationSql(): string {
	const dir = join(import.meta.dirname, "../../db/prisma/migrations");
	return readdirSync(dir)
		.filter((name) => MIGRATION_FOLDER.test(name))
		.sort()
		.map((folder) => readFileSync(join(dir, folder, "migration.sql"), "utf8"))
		.join("\n");
}

describe("Prisma migrations for Account Access", () => {
	it("creates Better Auth tables before Workspace depends on user", () => {
		const sql = prismaMigrationSql();
		const userTable = sql.indexOf('CREATE TABLE "user"');
		const workspaceFk = sql.indexOf('REFERENCES "user"("id")');
		expect(userTable).toBeGreaterThanOrEqual(0);
		expect(workspaceFk).toBeGreaterThan(userTable);
		expect(sql).toContain('CREATE TABLE "session"');
		expect(sql).toContain('CREATE TABLE "account"');
		expect(sql).toContain('CREATE TABLE "verification"');
	});
});
