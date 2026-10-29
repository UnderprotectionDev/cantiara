import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  createExternalSurfaceManagement,
  type LinkSourceState,
  type SurfaceRecord,
} from "../external-surface-management";
import {
  ACCOUNT,
  buildInPublicSurface,
  memoryDirectory,
  PROJECT,
  surface,
  wikiSurface,
} from "./external-surface-management-fixtures";

const CREATE_PROCEDURE = /^(create|mint|enable|add)\w*(surface|publication)/i;
const NOW = new Date("2026-02-01T00:00:00Z");
const FORBIDDEN_KEYS = [
  "accessToken",
  "token",
  "tokenHash",
  "password",
  "passwordHash",
  "views",
  "viewCount",
  "lastAccess",
  "lastAccessAt",
  "visitor",
  "ip",
  "device",
  "snapshot",
  "body",
];

function setup(
  records: SurfaceRecord[],
  linkSource: (record: SurfaceRecord) => LinkSourceState | null = () => ({
    hasChanges: false,
  }),
) {
  const access = createExternalSurfaceManagement({
    linkSource: (_accountId, record) => Promise.resolve(linkSource(record)),
    now: () => NOW,
    store: memoryDirectory(records),
  });
  const context = {
    externalSurfaceManagement: access,
    session: { session: { id: "session" }, user: { id: ACCOUNT } },
  } as unknown as Context;
  return { access, client: createRouterClient(appRouter, { context }) };
}

const everything = () => [
  surface(),
  wikiSurface(),
  buildInPublicSurface(),
  surface({
    cancelledAt: new Date("2026-01-10T00:00:00Z"),
    surfaceId: "s-revoked",
  }),
  surface({
    expiresAt: new Date("2026-01-20T00:00:00Z"),
    surfaceId: "s-expired",
  }),
];

describe("External Surface Management", () => {
  test("lists link, Wiki and Build in Public surfaces of every state in one directory", async () => {
    const { client } = setup(everything());
    const { rows } = await client.listExternalSurfaces({});
    expect(rows.map((row) => [row.surfaceId, row.visibility])).toEqual(
      expect.arrayContaining([
        ["s-link", "Link"],
        ["s-wiki", "Wiki"],
        ["s-bip", "Build in Public"],
      ]),
    );
    const byId = Object.fromEntries(rows.map((row) => [row.surfaceId, row]));
    expect(byId["s-link"]?.status).toBe("Active");
    expect(byId["s-expired"]?.status).toBe("Expired");
    expect(byId["s-revoked"]?.status).toBe("Revoked");
    expect(rows).toHaveLength(5);
  });

  test("a Project scope narrows to that Project's rows", async () => {
    const { client } = setup(everything());
    const { rows } = await client.listExternalSurfaces({ projectId: PROJECT });
    expect(rows.map((row) => row.visibility)).not.toContain("Wiki");
    expect(rows.every((row) => row.projectId === PROJECT)).toBe(true);
  });

  test("a row carries source, password presence, expiry, approval time and revision, never a secret", async () => {
    const { client } = setup([
      surface({
        expiresAt: new Date("2026-03-01T00:00:00Z"),
        passwordProtected: true,
      }),
    ]);
    const { rows } = await client.listExternalSurfaces({});
    const [row] = rows;
    expect(row).toMatchObject({
      expiresAt: "2026-03-01T00:00:00.000Z",
      lastApprovedAt: "2026-01-02T00:00:00Z",
      passwordProtected: true,
      revision: 1,
      source: { id: "d1", kind: "Document", title: "Plan" },
      status: "Active",
    });
    const serialized = JSON.stringify(row);
    for (const key of FORBIDDEN_KEYS) {
      expect(Object.keys(row ?? {})).not.toContain(key);
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  test("shows an unpublished-changes flag and offers Review diff only for it", async () => {
    const { client } = setup(
      [surface(), wikiSurface({ wikiDocumentRevision: 6 })],
      () => ({ hasChanges: true }),
    );
    const { rows } = await client.listExternalSurfaces({});
    for (const row of rows) {
      expect(row.hasUnpublishedChanges).toBe(true);
      expect(row.actions).toContain("Review diff");
    }
    const clean = setup([surface(), wikiSurface()]);
    const cleanRows = (await clean.client.listExternalSurfaces({})).rows;
    for (const row of cleanRows) {
      expect(row.hasUnpublishedChanges).toBe(false);
      expect(row.actions).not.toContain("Review diff");
    }
  });

  test("offers actions that match the state and no create action", async () => {
    const { client } = setup(everything());
    const { rows } = await client.listExternalSurfaces({});
    const byId = Object.fromEntries(rows.map((row) => [row.surfaceId, row]));
    expect(byId["s-link"]?.actions).toEqual([
      "Open source",
      "Change expiry / Reactivate",
      "Revoke / Unpublish",
    ]);
    expect(byId["s-wiki"]?.actions).toEqual([
      "Open source",
      "Revoke / Unpublish",
    ]);
    expect(byId["s-expired"]?.actions).toContain("Change expiry / Reactivate");
    expect(byId["s-revoked"]?.actions).toEqual([]);
    const procedures = Object.keys(appRouter).filter((name) =>
      CREATE_PROCEDURE.test(name),
    );
    expect(procedures).toEqual([]);
  });

  test("a redacted revision shows as Redacted without the removed value", async () => {
    const { client } = setup([
      surface({
        revision: {
          createdAt: new Date("2026-01-02T00:00:00Z"),
          number: 2,
          snapshot: {
            approvedAt: "2026-01-02T00:00:00Z",
            redactedAt: "2026-01-05T00:00:00Z",
            root: { id: "d1", kind: "Document", title: "Plan" },
            items: [{ value: "sk-live-secret" }],
          },
        },
      }),
    ]);
    const { rows } = await client.listExternalSurfaces({});
    expect(rows[0]?.redaction).toBe("Redacted");
    expect(JSON.stringify(rows)).not.toContain("sk-live-secret");
  });

  test("a surface kept after its single source went is frozen and detached, not live and not gone", async () => {
    const { client } = setup(
      [
        surface({ surfaceId: "s-gone-link" }),
        wikiSurface({ wikiDocumentRevision: null }),
      ],
      (record) =>
        record.surfaceId === "s-gone-link" ? null : { hasChanges: false },
    );
    const { rows } = await client.listExternalSurfaces({});
    for (const row of rows) {
      expect(row.frozenDetached).toBe(true);
      expect(row.status).toBe("Active");
      expect(row.hasUnpublishedChanges).toBe(false);
      expect(row.actions).not.toContain("Open source");
      expect(row.actions).not.toContain("Review diff");
    }
  });

  test("another account sees nothing", async () => {
    const { access } = setup(everything());
    const directory = await access.list("account-2", {});
    expect(directory?.rows).toEqual([]);
  });
});
