import { describe, expect, test } from "vitest";

import { extensionsRequiredByScripts } from "./schema-static-validation";

describe("extensions required by the offered scripts", () => {
  test("reports only the operator classes the scripts actually use", () => {
    expect(
      extensionsRequiredByScripts(["CREATE TABLE t (id integer);"]),
    ).toEqual([]);
    expect(
      extensionsRequiredByScripts([
        "CREATE TABLE t (note text);",
        "CREATE INDEX t_note_trgm ON t USING gin (note gin_trgm_ops);",
        "ALTER TABLE t ADD COLUMN x text;",
      ]),
    ).toEqual(["pg_trgm"]);
  });

  test("an edited Up referencing a matrix operator class is still reported", () => {
    expect(
      extensionsRequiredByScripts([
        "CREATE INDEX t_note_trgm ON t USING gist (note gist_trgm_ops);",
      ]),
    ).toEqual(["pg_trgm"]);
  });
});
