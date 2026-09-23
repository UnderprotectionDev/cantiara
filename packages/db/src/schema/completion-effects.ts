import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const completionEffectPreferences = pgTable(
  "completion_effect_preferences",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    theme: text("theme").default("Calm").notNull(),
    palette: text("palette").default("Haze").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "completion_effect_preferences_catalog_check",
      sql`(${table.theme} = 'Calm' AND ${table.palette} IN ('Haze', 'Pebble', 'Linen', 'Moss')) OR (${table.theme} = 'Weave' AND ${table.palette} IN ('Loom', 'Cord', 'Lattice', 'Knot')) OR (${table.theme} = 'Arc' AND ${table.palette} IN ('Gleam', 'Trace', 'Halo', 'Span')) OR (${table.theme} = 'Nova' AND ${table.palette} IN ('Ember', 'Pulse', 'Orbit', 'Flare'))`,
    ),
  ],
);
