import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { Pool } from "@neondatabase/serverless";

import { neon } from "../../../scripts/workspace-neon";
import { assertBaseHistory, type MigrationRecord } from "./base-history";

const migrationPaths = {
  primary: "packages/db/src/migrations",
  security: "packages/db/src/migrations/security-events",
} as const;

function mainFile(path: string) {
  try {
    return execFileSync("git", ["show", `origin/main:${path}`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // biome-ignore lint/style/useErrorCause: Git errors can contain repository paths or credentials.
    throw new Error("origin/main migration history is unavailable");
  }
}

export async function verifyDevelopmentBase(
  kind: "primary" | "security",
  projectId: string,
  branchId: string,
) {
  const path = migrationPaths[kind];
  const journal = JSON.parse(
    mainFile(`${path}/meta/_journal.json`).toString(),
  ) as {
    entries: { tag: string; when: number }[];
  };
  const expected: MigrationRecord[] = journal.entries.map((entry) => ({
    created_at: entry.when,
    hash: createHash("sha256")
      .update(mainFile(`${path}/${entry.tag}.sql`))
      .digest("hex"),
  }));
  const connection = await neon([
    "connection-string",
    branchId,
    "--project-id",
    projectId,
  ]);
  const pool = new Pool({ connectionString: connection });
  try {
    const result = await pool.query<MigrationRecord>(
      "SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
    );
    assertBaseHistory(result.rows, expected);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Development base migrations differ from origin/main"
    ) {
      throw error;
    }
    // biome-ignore lint/style/useErrorCause: Database errors can contain connection details.
    throw new Error("Development base migration history is unavailable");
  } finally {
    await pool.end();
  }
}
