import { Client } from "@neondatabase/serverless";

export interface DisposableConnection {
  close: () => Promise<void>;
  /** Runs one multi-statement script; the result is discarded. */
  execute: (sql: string) => Promise<void>;
  /** Server major version, for example `17`. */
  serverMajor: () => Promise<number>;
}

/**
 * One connection to a database that exists only for a static SQL validation.
 * The product never opens this for a user, staging or production target.
 */
export async function connectDisposable(
  connectionString: string,
): Promise<DisposableConnection> {
  const client = new Client({ connectionString });
  await client.connect();
  return {
    close: () => client.end(),
    execute: async (sql) => {
      await client.query(sql);
    },
    serverMajor: async () => {
      const result = await client.query<{ major: string }>(
        "SELECT current_setting('server_version_num')::int / 10000 AS major",
      );
      return Number(result.rows[0]?.major);
    },
  };
}
