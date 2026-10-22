import type { DisposableConnection } from "@cantiara/db/disposable-connection";
import { describe, expect, test } from "vitest";

import { createNeonDisposableDatabase } from "../neon-disposable-database";

function harness(options: { major?: number; deleteFails?: boolean } = {}) {
  const calls: string[] = [];
  const fetchMock = ((url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    calls.push(`${method} ${new URL(url).pathname}`);
    if (options.deleteFails && method === "DELETE") {
      return Promise.resolve(new Response("{}", { status: 500 }));
    }
    if (url.includes("connection_uri")) {
      return Promise.resolve(
        Response.json({ uri: "postgres://secret@host/db" }),
      );
    }
    return Promise.resolve(Response.json({ operations: [] }));
  }) as unknown as typeof fetch;
  const connection: DisposableConnection = {
    close: () => {
      calls.push("close");
      return Promise.resolve();
    },
    execute: (sql) => {
      calls.push(`sql:${sql.trim().slice(0, 30)}`);
      return sql.includes("BOOM")
        ? Promise.reject(new Error("boom"))
        : Promise.resolve();
    },
    serverMajor: () => Promise.resolve(options.major ?? 17),
  };
  const port = createNeonDisposableDatabase(
    { apiKey: "key", branchId: "br-1", projectId: "proj-1" },
    {
      connect: () => Promise.resolve(connection),
      fetch: fetchMock,
      pause: () => Promise.resolve(),
      randomSuffix: () => "abc",
    },
  );
  return { calls, port };
}

describe("Neon disposable database", () => {
  test("creates a role and database, applies, then drops both", async () => {
    const { calls, port } = harness();
    const result = await port.run(
      { extensions: ["pg_trgm"], postgresMajor: 17 },
      async (database) => {
        await database.execute("CREATE TABLE t (id int);");
        return "done";
      },
    );
    expect(result).toEqual({ destroyed: true, value: "done" });
    expect(calls).toEqual([
      "POST /api/v2/projects/proj-1/branches/br-1/roles",
      "POST /api/v2/projects/proj-1/branches/br-1/databases",
      "GET /api/v2/projects/proj-1/connection_uri",
      "sql:CREATE EXTENSION IF NOT EXISTS",
      "sql:CREATE TABLE t (id int);",
      "close",
      "DELETE /api/v2/projects/proj-1/branches/br-1/databases/cantiara_val_abc",
      "DELETE /api/v2/projects/proj-1/branches/br-1/roles/cantiara_val_abc",
    ]);
  });

  test("destroys the database and rethrows when the apply fails", async () => {
    const { calls, port } = harness();
    await expect(
      port.run({ extensions: [], postgresMajor: 17 }, (database) =>
        database.execute("BOOM"),
      ),
    ).rejects.toThrow("boom");
    expect(calls.filter((call) => call.startsWith("DELETE"))).toHaveLength(2);
  });

  test("refuses a branch whose PostgreSQL major differs from the pin", async () => {
    const { calls, port } = harness({ major: 16 });
    await expect(
      port.run({ extensions: [], postgresMajor: 17 }, async () => "x"),
    ).rejects.toThrow("not the pinned 17");
    expect(calls.some((call) => call.startsWith("DELETE"))).toBe(true);
  });

  test("reports an unproven destroy", async () => {
    const { port } = harness({ deleteFails: true });
    const result = await port.run(
      { extensions: [], postgresMajor: 17 },
      async () => "ok",
    );
    expect(result.destroyed).toBe(false);
  });
});
