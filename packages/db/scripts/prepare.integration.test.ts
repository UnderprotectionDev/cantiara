import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { assertLocalPostgresTarget } from "./migration-connection";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";

const fixtureUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const describeDatabase = fixtureUrl ? describe : describe.skip;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const FIXTURE_DATABASE_PATTERN = /^\/cantiara_migration_test[a-z0-9_]*$/;
const DEEP_CHECKS_PATTERN = /deep schema checks passed/g;

describeDatabase("Development database preparation command", () => {
  let admin: Awaited<ReturnType<typeof connectMigrationTarget>>;
  let primary: Awaited<ReturnType<typeof connectMigrationTarget>>;
  let security: Awaited<ReturnType<typeof connectMigrationTarget>>;
  let environment: Record<string, string | undefined>;
  const created: string[] = [];

  beforeAll(async () => {
    assertLocalPostgresTarget(fixtureUrl);
    const base = new URL(fixtureUrl ?? "");
    if (!FIXTURE_DATABASE_PATTERN.test(base.pathname)) {
      throw new Error(
        "Preparation tests require a dedicated migration fixture database",
      );
    }
    const suffix = randomUUID().slice(0, 8);
    const primaryUrl = new URL(base);
    primaryUrl.pathname = `/cantiara_migration_test_prepare_${suffix}`;
    const securityUrl = new URL(base);
    securityUrl.pathname = `${primaryUrl.pathname}_security`;
    environment = {
      ...process.env,
      NODE_ENV: "test",
      CANTIARA_DEPLOY_MIGRATION: undefined,
      NEON_LOCAL: "true",
      SECURITY_EVENT_LOCAL: "true",
      DATABASE_URL: primaryUrl.toString(),
      DATABASE_URL_UNPOOLED: undefined,
      SECURITY_EVENT_DATABASE_URL: securityUrl.toString(),
      SECURITY_EVENT_DATABASE_URL_UNPOOLED: undefined,
    };
    admin = await connectMigrationTarget(
      resolveMigrationTarget({ ...environment, DATABASE_URL: fixtureUrl }),
    );
    for (const target of [primaryUrl, securityUrl]) {
      const name = target.pathname.slice(1);
      // biome-ignore lint/performance/noAwaitInLoops: Register each owned fixture before a later setup operation can fail.
      await admin.execute(sql`CREATE DATABASE ${sql.identifier(name)}`);
      created.push(name);
    }
    primary = await connectMigrationTarget(resolveMigrationTarget(environment));
    security = await connectMigrationTarget(
      resolveMigrationTarget(environment, { securityEvents: true }),
    );
  });

  afterAll(async () => {
    await primary?.$client.end();
    await security?.$client.end();
    try {
      for (const name of created) {
        // biome-ignore lint/performance/noAwaitInLoops: Dispose only registered fixtures before closing their administrator connection.
        await admin.execute(sql`DROP DATABASE ${sql.identifier(name)}`);
      }
    } finally {
      await admin?.$client.end();
    }
  });

  function prepare(overrides: Record<string, string | undefined> = {}) {
    return spawnSync("bun", ["run", "db:prepare"], {
      cwd: root,
      env: { ...environment, ...overrides },
      encoding: "utf8",
      timeout: 60_000,
    });
  }

  async function emptyState(database: typeof primary) {
    const state = await database.execute(sql`
      SELECT to_regclass('drizzle.__drizzle_migrations') AS history,
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables
    `);
    return {
      history: state.rows[0]?.history,
      tables: Number(state.rows[0]?.tables),
    };
  }

  function histories() {
    return Promise.all(
      [primary, security].map(
        async (database) =>
          (
            await database.execute(
              sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`,
            )
          ).rows,
      ),
    );
  }

  test("rejects an invalid security target before applying either pending chain", async () => {
    const result = prepare({
      SECURITY_EVENT_DATABASE_URL: "not-a-url-security-secret",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Security events: target-mismatch");
    expect(result.stdout + result.stderr).not.toContain("security-secret");
    expect(result.stdout).not.toContain("applying reviewed");
    expect(await Promise.all([primary, security].map(emptyState))).toEqual([
      { history: null, tables: 0 },
      { history: null, tables: 0 },
    ]);
  }, 60_000);

  test("stops under a development lock without applying the other target", async () => {
    const client =
      primary.$client instanceof Pool
        ? await primary.$client.connect()
        : primary.$client;
    try {
      await client.query(
        "SELECT pg_advisory_lock_shared(1128351316, 1296648018)",
      );
      const result = prepare();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Stop development servers");
      expect(result.stdout).not.toContain("Security events: applying reviewed");
      expect(await Promise.all([primary, security].map(emptyState))).toEqual([
        { history: null, tables: 0 },
        { history: null, tables: 0 },
      ]);
    } finally {
      await client.query(
        "SELECT pg_advisory_unlock_shared(1128351316, 1296648018)",
      );
      if ("release" in client) {
        client.release();
      }
    }
  }, 60_000);

  test("prepares both pending chains through canonical commands and verifies deeply", () => {
    const result = prepare();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Primary: applying reviewed pending migrations",
    );
    expect(result.stdout).toContain(
      "Security events: applying reviewed pending migrations",
    );
    expect(result.stdout.match(DEEP_CHECKS_PATTERN)).toHaveLength(2);
    expect(result.stdout).toContain("Both development databases are ready");
  }, 60_000);

  test("repeated preparation preserves histories and existing product data", async () => {
    await primary.execute(sql`
      INSERT INTO "user" (id, name, email)
      VALUES ('preparation-founder', 'Founder', 'preparation@example.invalid')
    `);
    const before = await histories();
    const result = prepare();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toContain("applying reviewed");
    const after = await histories();
    expect(after).toEqual(before);
    const founder = await primary.execute(
      sql`SELECT email FROM "user" WHERE id = 'preparation-founder'`,
    );
    expect(founder.rows[0]?.email).toBe("preparation@example.invalid");
  }, 60_000);

  test("blocks deep schema drift without repairing or modifying either history", async () => {
    const definition = await primary.execute(
      sql`SELECT pg_get_indexdef('public."account_userId_idx"'::regclass) AS statement`,
    );
    const statement = definition.rows[0]?.statement;
    if (typeof statement !== "string") {
      throw new Error("Fixture index is required");
    }
    const before = await histories();
    await primary.execute(sql`DROP INDEX "account_userId_idx"`);
    try {
      const result = prepare();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("Primary: schema-drift");
      expect(result.stdout).not.toContain("applying reviewed");
      const index = await primary.execute(
        sql`SELECT to_regclass('public."account_userId_idx"') AS name`,
      );
      expect(index.rows[0]?.name).toBeNull();
      expect(await histories()).toEqual(before);
    } finally {
      await primary.execute(sql.raw(statement));
    }
  }, 60_000);
});
