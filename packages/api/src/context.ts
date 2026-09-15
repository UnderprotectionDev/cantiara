import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";

export type Context = {
  auth: null;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
  >;
  db: Database;
};
