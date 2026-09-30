import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { acquireDevelopmentLease } from "./development-lease";
import { diagnoseDatabase } from "./doctor";
import { assertLocalPostgresTarget } from "./migration-connection";
import { readMigrationRepository } from "./migration-repository";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const folder = fileURLToPath(new URL("../src/migrations/", import.meta.url));
const repository = readMigrationRepository(folder);
const securityUrl = databaseUrl ? new URL(databaseUrl) : undefined;
if (securityUrl) {
  securityUrl.pathname += "_security";
}
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: undefined,
  NEON_LOCAL: "true",
  SECURITY_EVENT_LOCAL: "true",
  SECURITY_EVENT_DATABASE_URL: securityUrl?.toString(),
  SECURITY_EVENT_DATABASE_URL_UNPOOLED: undefined,
};

function command(script: string, ...args: string[]) {
  return spawnSync("bun", [script, ...args], {
    cwd: root,
    env: environment,
    encoding: "utf8",
    timeout: 30_000,
  });
}

describeDatabase(
  "Migration command and read-only development readiness",
  () => {
    let database: Awaited<ReturnType<typeof connectMigrationTarget>>;
    let previousFolder: string;

    beforeAll(async () => {
      assertLocalPostgresTarget(databaseUrl);
      if (
        !new URL(databaseUrl ?? "").pathname.startsWith(
          "/cantiara_migration_test",
        )
      ) {
        throw new Error(
          "Migration integration tests require a dedicated cantiara_migration_test database",
        );
      }
      database = await connectMigrationTarget(
        resolveMigrationTarget(environment),
      );
      const state = await database.execute(
        sql`SELECT count(*) AS total FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      if (Number(state.rows[0]?.total) !== 0) {
        throw new Error(
          "Migration integration tests require an empty disposable database",
        );
      }
      previousFolder = mkdtempSync(
        join(tmpdir(), "cantiara-migration-upgrade-"),
      );
      mkdirSync(join(previousFolder, "meta"));
      const entries = repository.entries.slice(0, -1);
      for (const entry of entries) {
        copyFileSync(
          join(folder, `${entry.tag}.sql`),
          join(previousFolder, `${entry.tag}.sql`),
        );
      }
      writeFileSync(
        join(previousFolder, "meta", "_journal.json"),
        JSON.stringify({ version: "7", dialect: "postgresql", entries }),
      );
      await migrate(database, { migrationsFolder: previousFolder });
      await database.execute(
        sql`INSERT INTO "user" (id, name, email) VALUES ('migration-upgrade-founder', 'Founder', 'migration-upgrade@example.invalid')`,
      );
    }, 30_000);

    afterAll(async () => {
      await database?.$client.end();
      if (previousFolder) {
        rmSync(previousFolder, { recursive: true, force: true });
      }
    });

    test("reports the pending migration before applying it", async () => {
      expect((await diagnoseDatabase(environment)).reason).toBe("pending");
    });

    test("upgrades the previous schema and preserves existing data", async () => {
      const result = command("packages/db/scripts/migrate.ts");
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect((await diagnoseDatabase(environment, { deep: true })).reason).toBe(
        "ready",
      );
      const founder = await database.execute(
        sql`SELECT email FROM "user" WHERE id = 'migration-upgrade-founder'`,
      );
      expect(founder.rows[0]?.email).toBe("migration-upgrade@example.invalid");
    }, 30_000);

    test("repeating the migration command keeps the same canonical history", async () => {
      const result = command("packages/db/scripts/migrate.ts");
      expect(result.status).toBe(0);
      const history = await database.execute(
        sql`SELECT count(*) AS total FROM drizzle.__drizzle_migrations`,
      );
      expect(Number(history.rows[0]?.total)).toBe(repository.entries.length);
    });

    test("blocks a compatibility repair that skips unapplied canonical history", () => {
      const fresh = new URL(databaseUrl ?? "");
      fresh.pathname += "_fresh";
      const result = spawnSync(
        "bun",
        ["packages/db/scripts/migrate.ts", "--repair-prioritization-schema"],
        {
          cwd: root,
          env: { ...environment, DATABASE_URL: fresh.toString() },
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "cannot skip unapplied canonical migrations",
      );
    });

    test("applies the entire primary chain to an empty database through the canonical runner", async () => {
      const fresh = new URL(databaseUrl ?? "");
      fresh.pathname += "_fresh";
      const freshEnvironment = {
        ...environment,
        DATABASE_URL: fresh.toString(),
      };
      const result = spawnSync("bun", ["packages/db/scripts/migrate.ts"], {
        cwd: root,
        env: freshEnvironment,
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(
        (await diagnoseDatabase(freshEnvironment, { deep: true })).reason,
      ).toBe("ready");
    }, 30_000);

    test("applies the complete security-event chain to an empty separate database", async () => {
      const result = command(
        "packages/db/scripts/migrate.ts",
        "--security-events",
      );
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(
        (
          await diagnoseDatabase(environment, {
            securityEvents: true,
            deep: true,
          })
        ).reason,
      ).toBe("ready");
    }, 30_000);

    test("blocks changed SQL hashes, including through a compatibility repair", async () => {
      const [first] = repository.migrations;
      if (!first) {
        throw new Error("First migration is required");
      }
      await database.execute(
        sql`UPDATE drizzle.__drizzle_migrations SET hash = 'test-only-invalid-hash' WHERE created_at = ${first.folderMillis}`,
      );
      try {
        expect((await diagnoseDatabase(environment)).reason).toBe(
          "history-mismatch",
        );
        const result = command(
          "packages/db/scripts/migrate.ts",
          "--repair-prioritization-schema",
        );
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("migration history diverged");
      } finally {
        await database.execute(
          sql`UPDATE drizzle.__drizzle_migrations SET hash = ${first.hash} WHERE created_at = ${first.folderMillis}`,
        );
      }
    });

    test("blocks a database ahead of the branch without writing or repairing it", async () => {
      const last = repository.migrations.at(-1);
      if (!last) {
        throw new Error("Last migration is required");
      }
      await database.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('test-only-ahead', ${last.folderMillis + 1})`,
      );
      try {
        expect((await diagnoseDatabase(environment)).reason).toBe("ahead");
        const result = command("packages/db/scripts/migrate.ts");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("ahead of this Git branch");
      } finally {
        await database.execute(
          sql`DELETE FROM drizzle.__drizzle_migrations WHERE hash = 'test-only-ahead'`,
        );
      }
    });

    test("blocks missing history even if the schema already exists", async () => {
      await database.execute(
        sql`ALTER TABLE drizzle.__drizzle_migrations RENAME TO test_only_migration_history`,
      );
      try {
        expect((await diagnoseDatabase(environment)).reason).toBe(
          "history-mismatch",
        );
        expect(command("packages/db/scripts/migrate.ts").status).toBe(1);
      } finally {
        await database.execute(
          sql`ALTER TABLE drizzle.test_only_migration_history RENAME TO __drizzle_migrations`,
        );
      }
    });

    test("blocks a concurrent runner and readiness check under the migration lock", async () => {
      await database.execute(
        sql`SELECT pg_advisory_lock(1128351316, 1296648018)`,
      );
      try {
        const result = command("packages/db/scripts/migrate.ts");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Another migration or development API session",
        );
        expect((await diagnoseDatabase(environment)).reason).toBe(
          "migration-running",
        );
      } finally {
        await database.execute(
          sql`SELECT pg_advisory_unlock(1128351316, 1296648018)`,
        );
      }
    });

    test("running development prevents either migration boundary from changing", async () => {
      const lease = await acquireDevelopmentLease(environment);
      const parallelLease = await acquireDevelopmentLease(environment);
      try {
        await lease.verify();
        await parallelLease.verify();
        for (const args of [[], ["--security-events"]]) {
          const result = command("packages/db/scripts/migrate.ts", ...args);
          expect(result.status).toBe(1);
          expect(result.stderr).toContain("Another migration");
        }
      } finally {
        await lease.close();
        await parallelLease.close();
      }
      expect(command("packages/db/scripts/migrate.ts").status).toBe(0);
      expect(
        command("packages/db/scripts/migrate.ts", "--security-events").status,
      ).toBe(0);
    });

    test("Bun releases a healthy development lease without hanging on shutdown", () => {
      const result = command(
        "--eval",
        `
        const { acquireDevelopmentLease } = await import("./packages/db/scripts/development-lease");
        const lease = await acquireDevelopmentLease(process.env);
        await lease.verify();
        await lease.close();
        console.log("development lease released");
      `,
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("development lease released");
    });

    test("a disconnected development lease fails verification instead of leaving an unhandled connection error", async () => {
      const lease = await acquireDevelopmentLease(environment);
      try {
        await database.execute(sql`
          SELECT pg_terminate_backend(locks.pid)
          FROM pg_locks AS locks
          WHERE locks.locktype = 'advisory'
            AND locks.mode = 'ShareLock'
            AND locks.classid = 1128351316
            AND locks.objid = 1296648018
            AND locks.database = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND locks.pid <> pg_backend_pid()
        `);
        await expect(lease.verify()).rejects.toThrow();
      } finally {
        await lease.close().catch(() => undefined);
      }
    });

    test("detects real schema drift despite complete history", async () => {
      await database.execute(
        sql`ALTER TABLE "user" RENAME COLUMN name TO test_only_name`,
      );
      try {
        const result = await diagnoseDatabase(environment);
        expect(result.reason).toBe("schema-drift");
        expect(result.details).toContain("Missing column public.user.name");
        expect(
          (await diagnoseDatabase(environment, { deep: true })).reason,
        ).toBe("schema-drift");
      } finally {
        await database.execute(
          sql`ALTER TABLE "user" RENAME COLUMN test_only_name TO name`,
        );
      }
    });

    test("deep inspection detects a missing index without recreating it", async () => {
      const definition = await database.execute(
        sql`SELECT pg_get_indexdef(indexrelid) AS definition FROM pg_index WHERE indexrelid = 'public."account_userId_idx"'::regclass`,
      );
      const statement = definition.rows[0]?.definition;
      if (typeof statement !== "string") {
        throw new Error("Fixture index is required");
      }
      await database.execute(sql`DROP INDEX "account_userId_idx"`);
      try {
        const result = await diagnoseDatabase(environment, { deep: true });
        expect(result.reason).toBe("schema-drift");
        expect(result.details).toContain(
          "Index differs: account.account_userId_idx",
        );
      } finally {
        await database.execute(sql.raw(statement));
      }
    });

    test("deep inspection detects a changed check constraint", async () => {
      await database.execute(
        sql`ALTER TABLE account_preferences DROP CONSTRAINT account_preferences_appearance_check`,
      );
      await database.execute(
        sql`ALTER TABLE account_preferences ADD CONSTRAINT account_preferences_appearance_check CHECK (appearance = 'Light')`,
      );
      try {
        const result = await diagnoseDatabase(environment, { deep: true });
        expect(result.reason).toBe("schema-drift");
        expect(result.details).toContain(
          "Check constraint differs: account_preferences.account_preferences_appearance_check",
        );
      } finally {
        await database.execute(
          sql`ALTER TABLE account_preferences DROP CONSTRAINT account_preferences_appearance_check`,
        );
        await database.execute(
          sql`ALTER TABLE account_preferences ADD CONSTRAINT account_preferences_appearance_check CHECK (appearance IN ('Light', 'Dark'))`,
        );
      }
    });

    test("deep inspection detects changed unique null semantics", async () => {
      await database.execute(
        sql`ALTER TABLE "user" DROP CONSTRAINT user_email_unique`,
      );
      await database.execute(
        sql`ALTER TABLE "user" ADD CONSTRAINT user_email_unique UNIQUE NULLS NOT DISTINCT (email)`,
      );
      try {
        expect(
          (await diagnoseDatabase(environment, { deep: true })).reason,
        ).toBe("schema-drift");
      } finally {
        await database.execute(
          sql`ALTER TABLE "user" DROP CONSTRAINT user_email_unique`,
        );
        await database.execute(
          sql`ALTER TABLE "user" ADD CONSTRAINT user_email_unique UNIQUE (email)`,
        );
      }
    });

    test("deep inspection detects an unexpected write restriction", async () => {
      await database.execute(
        sql`ALTER TABLE "user" ADD CONSTRAINT test_only_extra_check CHECK (name <> 'blocked')`,
      );
      try {
        const result = await diagnoseDatabase(environment, { deep: true });
        expect(result.reason).toBe("schema-drift");
        expect(result.details).toContain(
          "Unexpected constraint: user.test_only_extra_check",
        );
      } finally {
        await database.execute(
          sql`ALTER TABLE "user" DROP CONSTRAINT test_only_extra_check`,
        );
      }
    });

    test("reports read permission failures without suggesting a migration", async () => {
      await database.execute(
        sql`CREATE ROLE cantiara_migration_test_denied LOGIN`,
      );
      try {
        const denied = new URL(databaseUrl ?? "");
        denied.username = "cantiara_migration_test_denied";
        const result = await diagnoseDatabase({
          ...environment,
          DATABASE_URL: denied.toString(),
        });
        expect(result.reason).toBe("permission");
        expect(result.nextStep).not.toContain("db:migrate");
      } finally {
        await database.execute(sql`DROP ROLE cantiara_migration_test_denied`);
      }
    });

    test("readiness succeeds with read-only privileges and leaves history unchanged", async () => {
      await database.execute(
        sql`CREATE ROLE cantiara_migration_test_reader LOGIN`,
      );
      await database.execute(
        sql`GRANT USAGE ON SCHEMA public, drizzle TO cantiara_migration_test_reader`,
      );
      await database.execute(
        sql`GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO cantiara_migration_test_reader`,
      );
      try {
        const readonly = new URL(databaseUrl ?? "");
        readonly.username = "cantiara_migration_test_reader";
        expect(
          (
            await diagnoseDatabase(
              { ...environment, DATABASE_URL: readonly.toString() },
              { deep: true },
            )
          ).reason,
        ).toBe("ready");
        const history = await database.execute(
          sql`SELECT count(*) AS total FROM drizzle.__drizzle_migrations`,
        );
        expect(Number(history.rows[0]?.total)).toBe(repository.entries.length);
      } finally {
        await database.execute(
          sql`DROP OWNED BY cantiara_migration_test_reader`,
        );
        await database.execute(sql`DROP ROLE cantiara_migration_test_reader`);
      }
    });

    test("reports a connection failure for an unavailable database", async () => {
      const missing = new URL(databaseUrl ?? "");
      missing.pathname = "/cantiara_migration_test_missing";
      expect(
        (
          await diagnoseDatabase({
            ...environment,
            DATABASE_URL: missing.toString(),
          })
        ).reason,
      ).toBe("connection");
    });

    test("development startup fails before launching applications on drift", async () => {
      await database.execute(
        sql`ALTER TABLE "user" RENAME COLUMN name TO test_only_name`,
      );
      try {
        const result = spawnSync("bun", ["scripts/local-dev.ts", "server"], {
          cwd: root,
          env: {
            ...environment,
            NEON_LOCAL_PROXY: "127.0.0.1:55439",
            NEON_LOCAL_PROXY_PORT: "55439",
            NEON_LOCAL_POSTGRES_PORT: new URL(databaseUrl ?? "").port || "5432",
          },
          encoding: "utf8",
          timeout: 30_000,
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("Primary: schema-drift");
        expect(result.stdout).not.toContain("turbo");
      } finally {
        await database.execute(
          sql`ALTER TABLE "user" RENAME COLUMN test_only_name TO name`,
        );
      }
    });
  },
);
