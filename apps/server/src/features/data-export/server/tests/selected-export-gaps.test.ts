import {
  ExportError,
  type ExportRecordType,
  exportRequestSchema,
} from "@cantiara/api/data-export";
import { isSecretKey, stripSecrets } from "@cantiara/api/data-export-secrets";
import type { Database } from "@cantiara/db";
import { describe, expect, test } from "vitest";

import {
  createSelectedExport,
  type ExportSourceReader,
} from "../selected-export";
import { projectScopeId } from "../selected-export-database-support";
import { dedupeRelations } from "../selected-export-relations-database";
import { createDatabaseWorkspaceExportSources } from "../selected-export-workspace-database";

const workspaceScope = { kind: "workspace" } as const;
const projectScope = { kind: "project", projectId: "p1" } as const;

function fakeReader(
  ids: string[],
  relations: [string, string, string][],
  seen?: { scope?: unknown },
): ExportSourceReader {
  return {
    fields: () => [{ key: "title", label: "Title" }],
    read(input) {
      if (seen) {
        seen.scope = input.scope;
      }
      return Promise.resolve({
        records: ids.map((id) => ({
          id,
          label: id,
          values: { title: `Title ${id}` },
        })),
        relations: relations.map(([fromRecordId, kind, toRecordId]) => ({
          fromRecordId,
          kind,
          toRecordId,
        })),
      });
    },
  };
}

describe("Workspace scope", () => {
  test("accepts only the bare workspace kind, never a client workspace id", () => {
    const base = { filters: {}, format: "JSON", recordType: "Contact" };
    expect(
      exportRequestSchema.safeParse({ ...base, scope: workspaceScope }).success,
    ).toBe(true);
    expect(
      exportRequestSchema.safeParse({
        ...base,
        scope: { kind: "workspace", workspaceId: "w-other" },
      }).success,
    ).toBe(false);
  });

  test("a Workspace-scoped type previews and carries its scope in the manifest", async () => {
    const seen: { scope?: unknown } = {};
    const selected = createSelectedExport({
      sources: { Contact: fakeReader(["c1"], [], seen) },
    });
    const preview = await selected.preview("a1", {
      filters: {},
      format: "JSON",
      recordType: "Contact",
      scope: workspaceScope,
    });
    expect(preview.scope).toEqual(workspaceScope);
    expect(seen.scope).toEqual(workspaceScope);
    expect(preview.recordCount).toBe(1);
  });

  test("a Project reader refuses a Workspace scope visibly", () => {
    expect(() => projectScopeId(workspaceScope, "Decision")).toThrow(
      ExportError,
    );
    expect(projectScopeId(projectScope, "Decision")).toBe("p1");
  });
});

describe("Workspace readers", () => {
  const sources = createDatabaseWorkspaceExportSources({} as Database);

  test("register Contact, Company and Product Gap only", () => {
    expect(Object.keys(sources).sort()).toEqual([
      "Company",
      "Contact",
      "Product Gap",
    ]);
  });

  test.each(Object.entries(sources))(
    "%s exports an explicit allowlist without internals or secrets",
    (type, reader) => {
      const keys = reader.fields(type as ExportRecordType).map((f) => f.key);
      expect(keys.length).toBeGreaterThan(2);
      for (const key of keys) {
        expect(["revision", "workspaceId", "id"]).not.toContain(key);
        expect(isSecretKey(key)).toBe(false);
      }
    },
  );

  test("a Workspace reader refuses a Project scope before touching data", async () => {
    await expect(
      sources.Contact?.read({
        accountId: "a1",
        filters: {},
        limit: 10,
        recordType: "Contact",
        scope: projectScope,
      }),
    ).rejects.toMatchObject({ code: "source_unavailable" });
  });

  test("a Workspace reader refuses an unsupported filter", async () => {
    await expect(
      sources["Product Gap"]?.read({
        accountId: "a1",
        filters: { status: "Open" },
        limit: 10,
        recordType: "Product Gap",
        scope: workspaceScope,
      }),
    ).rejects.toMatchObject({ code: "source_unavailable" });
  });
});

describe("Relations across families", () => {
  const cases: [ExportRecordType, string][] = [
    ["Decision", "Supersedes"],
    ["Risk", "Context"],
    ["Feedback", "Attachment"],
    ["Product Gap", "Related"],
    ["Contact", "Belongs to Company"],
    ["Company", "Belongs to Company"],
    ["Project Goal", "Contributes to Goal"],
    ["Milestone", "Contributes to Goal"],
  ];

  test.each(cases)(
    "%s carries a relation with both ends selected and omits a one-ended one",
    async (recordType, kind) => {
      const selected = createSelectedExport({
        sources: {
          [recordType]: fakeReader(
            ["a", "b"],
            [
              ["a", kind, "b"],
              ["a", kind, "outside"],
              ["outside", "Evidence", "b"],
            ],
          ),
        },
      });
      const preview = await selected.preview("a1", {
        filters: {},
        format: "JSON",
        recordType,
        scope:
          recordType === "Contact" ||
          recordType === "Company" ||
          recordType === "Product Gap"
            ? workspaceScope
            : projectScope,
      });
      expect(preview.relations).toEqual([
        { fromRecordId: "a", kind, toRecordId: "b" },
      ]);
      expect(preview.relationsOmitted).toBe(2);
    },
  );

  test("the same relation read twice is one relation", () => {
    const one = { fromRecordId: "a", kind: "Evidence", toRecordId: "b" };
    expect(
      dedupeRelations([one, { ...one }, { ...one, kind: "Origin" }]),
    ).toHaveLength(2);
  });
});

describe("Secret stripping", () => {
  const strip = (value: unknown) => {
    const removed = new Set<string>();
    return {
      removed: [...removed],
      output: stripSecrets(value, removed),
      set: removed,
    };
  };

  test("keeps key-name matching for tokens and passwords", () => {
    const { output, set } = strip({
      linkPassword: "pw",
      sessionToken: "t",
      title: "ok",
    });
    expect(output).toEqual({ title: "ok" });
    expect([...set].sort()).toEqual(["linkPassword", "sessionToken"]);
  });

  test("allowlists commit and content hashes as product identity", () => {
    const { output, set } = strip({
      commitHash: "a".repeat(40),
      contentHash: "b".repeat(64),
      passwordHash: "x",
      tokenHash: "y",
    });
    expect(output).toEqual({
      commitHash: "a".repeat(40),
      contentHash: "b".repeat(64),
    });
    expect([...set].sort()).toEqual(["passwordHash", "tokenHash"]);
    expect(isSecretKey("content_hash")).toBe(false);
    expect(isSecretKey("contentHashX")).toBe(true);
  });

  test.each([
    ["Bearer token", "Call with Authorization: Bearer abcdEFGH1234567890xyz"],
    ["GitHub token", "pushed using ghp_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["API secret key", "key sk-proj-abcdefghijklmnop12345678"],
    ["JSON Web Token", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig"],
    ["Private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIE"],
    ["AWS access key", "AKIAIOSFODNN7EXAMPLE"],
    ["High-entropy token", "kP9vQ2xLm4Zt8RbN1cYw6HjD3sFa7UeG5oIq0TnXhV2yBrM9"],
  ])("redacts a %s found in a value and reports the class", (name, text) => {
    const { output, set } = strip({ description: text, title: "Keep" });
    expect(output).toEqual({ description: null, title: "Keep" });
    expect([...set]).toEqual([`value: ${name}`]);
    expect(JSON.stringify([...set])).not.toContain("abcdef");
  });

  test("drops a credential array item and keeps the rest", () => {
    const { output } = strip({
      notes: ["fine", "Bearer abcdEFGH1234567890xyz", null],
    });
    expect(output).toEqual({ notes: ["fine", null] });
  });

  test("does not over-strip ordinary text and product identity", () => {
    const keep = {
      a: "The bearer of this news was late; ask-me later.",
      b: "We use sk as a prefix; task-force and desk-lamp are words",
      c: "https://example.com/a/very/long/path/with/MixedCase/and/digits/123456789",
      d: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      e: "123e4567-e89b-12d3-a456-426614174000",
      f: "supercalifragilisticexpialidocious-and-more-words-here-for-length",
      g: "Bearer",
    };
    const { output, set } = strip(keep);
    expect(output).toEqual(keep);
    expect(set.size).toBe(0);
  });
});
