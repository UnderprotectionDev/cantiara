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
  tables: Record<
    string,
    {
      columns: Record<
        string,
        { type: string; notNull?: boolean; primaryKey?: boolean }
      >;
      indexes: Record<string, unknown>;
      foreignKeys: Record<string, unknown>;
      uniqueConstraints: Record<string, unknown>;
      checkConstraints: Record<string, unknown>;
    }
  >;
}
type SnapshotTable = Snapshot["tables"][string];

function verifyTable(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actual: Map<string, { data_type: string; is_nullable: string }>,
  actualIndexes: Set<string>,
  actualConstraints: Set<string>,
) {
  for (const [columnName, expected] of Object.entries(table.columns)) {
    const column = actual.get(`${tableName}.${columnName}`);
    if (!column) {
      throw new Error(
        `${kind} expected schema column missing: ${tableName}.${columnName}`,
      );
    }
    const expectedType =
      expected.type === "timestamp"
        ? "timestamp without time zone"
        : expected.type;
    if (
      column.data_type !== expectedType ||
      (column.is_nullable === "NO") !==
        Boolean(expected.notNull || expected.primaryKey)
    ) {
      throw new Error(
        `${kind} schema column differs: ${tableName}.${columnName}`,
      );
    }
  }
  for (const name of Object.keys(table.indexes ?? {})) {
    if (!actualIndexes.has(`${tableName}.${name}`)) {
      throw new Error(`${kind} expected index missing: ${tableName}.${name}`);
    }
  }
  const expectedConstraints = [
    ...Object.keys(table.foreignKeys ?? {}),
    ...Object.keys(table.uniqueConstraints ?? {}),
    ...Object.keys(table.checkConstraints ?? {}),
  ];
  for (const name of expectedConstraints) {
    // PostgreSQL stores identifiers at most 63 bytes; these generated names are ASCII.
    if (!actualConstraints.has(`${tableName}.${name.slice(0, 63)}`)) {
      throw new Error(
        `${kind} expected constraint missing: ${tableName}.${name}`,
      );
    }
  }
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

async function verifySnapshot(
  client: Pool,
  snapshot: Snapshot,
  kind: "primary" | "security",
) {
  const columns = await client.query(
    "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public'",
  );
  const actual = new Map(
    columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
  );
  const indexes = await client.query(
    "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public'",
  );
  const actualIndexes = new Set(
    indexes.rows.map((row) => `${row.tablename}.${row.indexname}`),
  );
  const constraints = await client.query(
    "SELECT c.relname AS table_name, con.conname AS constraint_name FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'",
  );
  const actualConstraints = new Set(
    constraints.rows.map((row) => `${row.table_name}.${row.constraint_name}`),
  );
  for (const [tableKey, table] of Object.entries(snapshot.tables)) {
    const tableName = tableKey.split(".").at(-1) ?? tableKey;
    verifyTable(
      kind,
      tableName,
      table,
      actual,
      actualIndexes,
      actualConstraints,
    );
  }
  return actual.size;
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
      const count = await verifySnapshot(db.$client, snapshot, kind);
      console.log(
        `${kind}: ${records.rows.length} migration hashes and ${count} columns verified`,
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
