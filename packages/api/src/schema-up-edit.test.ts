import { describe, expect, test } from "vitest";

import { checkUpEdit, diffUpEdit, splitStatements } from "./schema-up-edit";

describe("Up edit guard", () => {
  test("accepts catalog statements and keeps ON DELETE CASCADE", () => {
    expect(
      checkUpEdit(
        "ALTER TABLE t ADD COLUMN note text;\nALTER TABLE c ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES t (id) ON DELETE CASCADE ON UPDATE NO ACTION;\nCREATE INDEX i ON t USING gin (note gin_trgm_ops);",
      ),
    ).toEqual([]);
  });

  test.each([
    ["UPDATE t SET a = 1;", "Data statements"],
    ["INSERT INTO t VALUES (1);", "Data statements"],
    ["DELETE FROM t;", "Data statements"],
    ["TRUNCATE t;", "Data statements"],
    ["SELECT 1;", "Data statements"],
    ["CREATE VIEW v AS SELECT 1;", "outside the closed operation catalog"],
    ["CREATE EXTENSION pg_trgm;", "outside the closed operation catalog"],
    ["GRANT ALL ON t TO PUBLIC;", "outside the closed operation catalog"],
    ["ALTER TABLE t ALTER COLUMN a TYPE integer USING a::integer;", "USING"],
    ["DROP TABLE t CASCADE;", "CASCADE"],
    ["ALTER TABLE t ALTER COLUMN a SET DEFAULT nextval('s');", "sequences"],
    ["ALTER TABLE t ADD COLUMN a text; -- hide", "Comments"],
    ["VACUUM t;", "not in the operation catalog"],
  ])("rejects %s", (sql, reason) => {
    const issues = checkUpEdit(sql);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => issue.reason).join(" ")).toContain(reason);
  });

  test("splits only on semicolons outside quotes", () => {
    expect(
      splitStatements(
        "ALTER TABLE t ALTER COLUMN a SET DEFAULT 'x;y'; DROP TABLE u;",
      ),
    ).toEqual([
      "ALTER TABLE t ALTER COLUMN a SET DEFAULT 'x;y'",
      "DROP TABLE u",
    ]);
  });

  test("shows generator output and the user's edit apart", () => {
    const diff = diffUpEdit("A;\nB;\n", "A;\nC;\n");
    expect(diff.changed).toBe(true);
    expect(diff.parts.filter(({ kind }) => kind !== "same")).toEqual([
      { kind: "removed", text: "B;\n" },
      { kind: "added", text: "C;\n" },
    ]);
    expect(diffUpEdit("A;\n", "A;\n").changed).toBe(false);
  });
});
