import type { Context } from "@cantiara/api/context";
import {
  ProductionIncidentConflictError,
  ProductionIncidentFollowUpStaleError,
  type ProductionIncidentsAccess,
} from "@cantiara/api/production-incidents";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const INCIDENT_RPC =
  /incident|pager|on-?call|sentry|alarm|status-?page|downtime/i;

function setup(authenticated = true) {
  const productionIncidents: ProductionIncidentsAccess = {
    createFollowUp: vi.fn().mockResolvedValue({ id: "work-9" }),
    previewFollowUp: vi.fn().mockResolvedValue({ fingerprint: "fp", plan: {} }),
    detail: vi.fn().mockResolvedValue({ incident: { id: "incident-1" } }),
    overview: vi.fn().mockResolvedValue({ incidents: [], readOnly: false }),
    setLink: vi.fn().mockResolvedValue({ id: "link-1" }),
  };
  const context = {
    productionIncidents,
    session: authenticated
      ? { session: { id: "session" }, user: { id: "founder" } }
      : null,
  } as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    productionIncidents,
  };
}

const link = {
  attached: true,
  baseRevision: 0,
  clientIdempotencyKey: "link-add",
  incidentId: "incident-1",
  projectId: "project-1",
  targetId: "work-1",
  targetType: "Bug" as const,
};

describe("Production Incidents RPC seam", () => {
  test("reads the list and the detail for the authenticated account", async () => {
    const { client, productionIncidents } = setup();
    await client.productionIncidents({ projectId: "project-1" });
    expect(productionIncidents.overview).toHaveBeenCalledWith(
      "founder",
      "project-1",
    );
    await client.productionIncidentDetail({
      incidentId: "incident-1",
      projectId: "project-1",
    });
    expect(productionIncidents.detail).toHaveBeenCalledWith("founder", {
      incidentId: "incident-1",
      projectId: "project-1",
    });
  });

  test("binds each linkable record type through one command, unchanged", async () => {
    const { client, productionIncidents } = setup();
    const commands = (
      ["Bug", "GitHub PR", "Project Release", "Risk", "Decision"] as const
    ).map((targetType) => ({ ...link, targetType }));
    await Promise.all(
      commands.map((command) => client.setProductionIncidentLink(command)),
    );
    for (const command of commands) {
      expect(productionIncidents.setLink).toHaveBeenCalledWith(
        "founder",
        command,
      );
    }
  });

  test("exposes no pager, on-call, status page, alarm, Sentry or timing procedure", () => {
    expect(
      Object.keys(appRouter)
        .filter((name) => INCIDENT_RPC.test(name))
        .sort(),
    ).toEqual([
      "createProductionIncidentFollowUp",
      "previewProductionIncidentFollowUp",
      "productionIncidentDetail",
      "productionIncidents",
      "setProductionIncidentLink",
    ]);
  });

  test("rejects a status, a Work type or an agent actor before the seam", async () => {
    const { client, productionIncidents } = setup();
    await expect(
      client.setProductionIncidentLink({
        ...link,
        status: "Resolved",
      } as never),
    ).rejects.toThrow();
    await expect(
      client.setProductionIncidentLink({
        ...link,
        targetType: "Task",
      } as never),
    ).rejects.toThrow();
    await expect(
      client.setProductionIncidentLink({
        ...link,
        actor: { type: "Integration" },
        kind: "agent",
      } as never),
    ).rejects.toThrow();
    expect(productionIncidents.setLink).not.toHaveBeenCalled();
  });

  test("answers an unavailable incident as not found and a stale link as conflict", async () => {
    const { client, productionIncidents } = setup();
    vi.mocked(productionIncidents.detail).mockResolvedValue(null);
    await expect(
      client.productionIncidentDetail({
        incidentId: "other",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    vi.mocked(productionIncidents.setLink).mockResolvedValue(null);
    await expect(client.setProductionIncidentLink(link)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    vi.mocked(productionIncidents.setLink).mockRejectedValue(
      new ProductionIncidentConflictError("incident-1"),
    );
    await expect(client.setProductionIncidentLink(link)).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "CONFLICT", targetId: "incident-1" },
    });
  });

  test("follow-up work is previewed first and committed only with the preview fingerprint", async () => {
    const { client, productionIncidents } = setup();
    const preview = {
      incidentId: "incident-1",
      projectId: "project-1",
      title: "Add a canary",
      workType: "Task" as const,
    };
    await client.previewProductionIncidentFollowUp(preview);
    expect(productionIncidents.previewFollowUp).toHaveBeenCalledWith(
      "founder",
      preview,
    );
    expect(productionIncidents.createFollowUp).not.toHaveBeenCalled();
    const commit = {
      ...preview,
      baseRevision: 0,
      clientIdempotencyKey: "follow-up",
      previewFingerprint: "fp",
      workId: "work-9",
    };
    await client.createProductionIncidentFollowUp(commit);
    expect(productionIncidents.createFollowUp).toHaveBeenCalledWith(
      "founder",
      commit,
    );
    const { previewFingerprint: _omitted, ...withoutPreview } = commit;
    await expect(
      client.createProductionIncidentFollowUp(withoutPreview as never),
    ).rejects.toThrow();
    await expect(
      client.createProductionIncidentFollowUp({
        ...commit,
        previewFingerprint: "",
      }),
    ).rejects.toThrow();
    expect(productionIncidents.createFollowUp).toHaveBeenCalledTimes(1);
  });

  test("a stale preview is a conflict the founder can review again", async () => {
    const { client, productionIncidents } = setup();
    vi.mocked(productionIncidents.createFollowUp).mockRejectedValue(
      new ProductionIncidentFollowUpStaleError("incident-1"),
    );
    await expect(
      client.createProductionIncidentFollowUp({
        baseRevision: 0,
        clientIdempotencyKey: "follow-up",
        incidentId: "incident-1",
        previewFingerprint: "old",
        projectId: "project-1",
        title: "Add a canary",
        workId: "work-9",
        workType: "Task",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "PREVIEW_STALE" },
    });
  });

  test("blocks anonymous access before reaching Production Incidents", async () => {
    const { client, productionIncidents } = setup(false);
    await expect(
      client.productionIncidents({ projectId: "project-1" }),
    ).rejects.toThrow();
    await expect(client.setProductionIncidentLink(link)).rejects.toThrow();
    expect(productionIncidents.overview).not.toHaveBeenCalled();
    expect(productionIncidents.setLink).not.toHaveBeenCalled();
  });
});
