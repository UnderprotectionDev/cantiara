import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { getBranch, neon } from "../../../scripts/workspace-neon";

interface ProjectConfig {
  productionBranchId: string;
  projectId: string;
}

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

interface Snapshot {
  tables: Record<string, { columns: Record<string, unknown> }>;
}

const config = JSON.parse(
  readFileSync(
    join(import.meta.dir, "..", "..", "..", ".conductor", "neon.json"),
    "utf8",
  ),
) as { primary: ProjectConfig; security: ProjectConfig };
const workspaceId = process.env.CONDUCTOR_WORKSPACE_ID ?? "";
if (!workspaceId) {
  throw new Error("Conductor workspace identity is required");
}
try {
  execFileSync("git", ["fetch", "--quiet", "origin", "main"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  // biome-ignore lint/style/useErrorCause: Git errors can contain local credential details.
  throw new Error("Could not refresh origin/main for migration verification");
}

function gitShow(path: string) {
  try {
    return execFileSync("git", ["show", `origin/main:${path}`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // biome-ignore lint/style/useErrorCause: Git errors can contain repository paths or credentials.
    throw new Error("origin/main migration history is unavailable");
  }
}

function assertMainPrefix(folder: string, repoPath: string) {
  const candidate = JSON.parse(
    readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
  ) as Journal;
  const main = JSON.parse(
    gitShow(`${repoPath}/meta/_journal.json`).toString(),
  ) as Journal;
  if (candidate.entries.length < main.entries.length) {
    throw new Error("Candidate journal omits origin/main migrations");
  }
  for (const [index, entry] of main.entries.entries()) {
    const current = candidate.entries[index];
    if (JSON.stringify(current) !== JSON.stringify(entry)) {
      throw new Error(
        `Candidate journal diverges from origin/main at ${entry.tag}`,
      );
    }
    const path = `${repoPath}/${entry.tag}.sql`;
    const originalHash = createHash("sha256")
      .update(gitShow(path))
      .digest("hex");
    const candidateHash = createHash("sha256")
      .update(readFileSync(join(folder, `${entry.tag}.sql`)))
      .digest("hex");
    if (originalHash !== candidateHash) {
      throw new Error(
        `Applied migration SQL differs from origin/main: ${entry.tag}`,
      );
    }
  }
  return candidate;
}

async function verifyProject(
  kind: "primary" | "security",
  project: ProjectConfig,
  folder: string,
  repoPath: string,
) {
  const journal = assertMainPrefix(folder, repoPath);
  const name = `pr-check-${workspaceId.slice(0, 8)}-${Date.now()}`;
  const created = JSON.parse(
    await neon([
      "branches",
      "create",
      "--project-id",
      project.projectId,
      "--parent",
      project.productionBranchId,
      "--schema-only",
      "--name",
      name,
      "--output",
      "json",
    ]),
  ) as { branch?: { id: string }; id?: string };
  const branchId = created.branch?.id ?? created.id;
  if (!branchId) {
    throw new Error("Neon did not return a verification branch identity");
  }
  const record = {
    projectId: project.projectId,
    parentId: "",
    branchId,
    name,
    endpointId: "",
  };
  try {
    const branch = await getBranch(record);
    if (
      !branch ||
      branch.id !== branchId ||
      branch.project_id !== project.projectId ||
      branch.name !== name ||
      branch.primary ||
      branch.protected
    ) {
      throw new Error("Verification branch identity mismatch");
    }
    const connection = await neon([
      "connection-string",
      branchId,
      "--project-id",
      project.projectId,
    ]);
    const db = drizzle({ client: new Pool({ connectionString: connection }) });
    try {
      await db.$client.query("DROP SCHEMA IF EXISTS pgboss CASCADE");
      await db.$client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
      await db.$client.query("DROP SCHEMA public CASCADE");
      await db.$client.query("CREATE SCHEMA public");
      await migrate(db, { migrationsFolder: folder });
      const records = await db.$client.query(
        "SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
      );
      const expected = journal.entries.map((entry) => ({
        time: String(entry.when),
        hash: createHash("sha256")
          .update(readFileSync(join(folder, `${entry.tag}.sql`)))
          .digest("hex"),
      }));
      if (
        records.rows.length !== expected.length ||
        records.rows.some(
          (row, index) =>
            String(row.created_at) !== expected[index]?.time ||
            row.hash !== expected[index]?.hash,
        )
      ) {
        throw new Error(`${kind} migration records or SQL hashes differ`);
      }

      const last = journal.entries.at(-1);
      if (!last) {
        throw new Error("Migration journal is empty");
      }
      const snapshot = JSON.parse(
        readFileSync(
          join(
            folder,
            "meta",
            `${String(last.idx).padStart(4, "0")}_snapshot.json`,
          ),
          "utf8",
        ),
      ) as Snapshot;
      const columns = await db.$client.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'",
      );
      const actual = new Set(
        columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
      );
      for (const table of Object.values(snapshot.tables)) {
        for (const column of Object.keys(table.columns)) {
          const tableName = Object.keys(snapshot.tables)
            .find((key) => snapshot.tables[key] === table)
            ?.split(".")
            .at(-1);
          if (!actual.has(`${tableName}.${column}`)) {
            throw new Error(
              `${kind} expected schema column missing: ${tableName}.${column}`,
            );
          }
        }
      }
      console.log(
        `${kind}: ${records.rows.length} migration hashes and ${actual.size} columns verified`,
      );
    } finally {
      await db.$client.end();
    }
  } finally {
    const branch = await getBranch(record);
    if (
      branch &&
      branch.id === branchId &&
      branch.name === name &&
      branch.project_id === project.projectId &&
      !branch.primary &&
      !branch.protected
    ) {
      await neon([
        "branches",
        "delete",
        branchId,
        "--project-id",
        project.projectId,
      ]);
    }
  }
}

await verifyProject(
  "primary",
  config.primary,
  join(import.meta.dir, "..", "src", "migrations"),
  "packages/db/src/migrations",
);
await verifyProject(
  "security",
  config.security,
  join(import.meta.dir, "..", "src", "migrations", "security-events"),
  "packages/db/src/migrations/security-events",
);
