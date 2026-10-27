import type { Context } from "@cantiara/api/context";
import type {
  Document,
  DocumentMutationContracts,
  DocumentMutationValue,
} from "@cantiara/api/documents";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectClosureSummary } from "../project-closure-summary";
import { createMemoryProjectClosureSummary } from "../project-closure-summary-memory-store";

const ACCOUNT = "account-1";
const CLOSURE_PROCEDURE = /closuresummary/i;
const WRITE_PROCEDURE =
  /^(add|set|remove|create|update|delete|close|write|save)/i;
const SCORE_FIELD = /score|health|rating|grade|actual/i;
const STARTER_HEADINGS = /^## (Context|Goals|Behaviors|Retrospective)/m;
const COMMITTED_AT = "2026-10-27T10:00:00.000Z";

/** The Documents contracts double: records commands, replays by key. */
function documentContracts() {
  const commands: MutationCommand[] = [];
  const seen = new Map<string, Document>();
  const contract = (
    current: Document | null = null,
  ): MutationContract<DocumentMutationValue> => ({
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<DocumentMutationValue, TPayload>,
    ) => {
      commands.push(command);
      const key = command.kind === "human" ? command.clientIdempotencyKey : "";
      const replay = seen.get(key);
      const nextValue: DocumentMutationValue = replay
        ? { document: replay }
        : await apply({
            committedAt: COMMITTED_AT,
            currentRevision: 0,
            currentValue: {
              document: null,
              sourceDocument: current ?? undefined,
            },
            payload: command.payload,
          });
      if (nextValue.document && !replay) {
        seen.set(key, nextValue.document);
      }
      return {
        actor: command.actor,
        committedAt: COMMITTED_AT,
        id: "receipt",
        nextValue,
        origin: { clientIdempotencyKey: key, kind: "human" },
        payloadFingerprint: "0".repeat(64),
        previousValue: { document: null },
        revision: 1,
        targetId: command.targetId,
      } as MutationReceipt<DocumentMutationValue>;
    },
    replay: async () => null,
  });
  const contracts: DocumentMutationContracts = {
    create: () => contract(),
    transfer: () => contract([...seen.values()][0] ?? null),
    update: () => {
      throw new Error("Saving must not update a Document.");
    },
  };
  return { commands, contracts, seen };
}

function setup(
  authenticated = true,
  status = "Completed",
  documents = documentContracts().contracts,
) {
  const context = {
    documentMutationContracts: documents,
    projectClosureSummary: createProjectClosureSummary(
      createMemoryProjectClosureSummary({
        accountId: ACCOUNT,
        projects: new Map([
          [
            "project-1",
            {
              candidates: [
                { label: "Alpha", recordId: "d1", recordType: "Decision" },
                { label: "P-1 Ship", recordId: "w1", recordType: "Work" },
              ],
              dateFacts: [
                {
                  closedAt: "2026-10-12T10:00:00.000Z",
                  currentTargetDate: "2026-10-10",
                  label: "P-1 Ship",
                  recordId: "w1",
                  recordType: "Work",
                  targetDates: ["2026-10-01", "2026-10-10"],
                },
              ],
              status,
            },
          ],
        ]),
      }),
    ),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Project Closure Summary RPC seam", () => {
  test("lists sources and previews the draft for the signed-in account", async () => {
    const client = setup();
    const sources = await client.projectClosureSummarySources({
      projectId: "project-1",
    });
    expect(sources.groups[0]?.candidates.map((c) => c.label)).toEqual([
      "Alpha",
    ]);
    const draft = await client.projectClosureSummaryDraft({
      projectId: "project-1",
      sources: [{ recordId: "d1", recordType: "Decision" }],
    });
    expect(draft.sections).toEqual([
      {
        heading: "Decisions",
        recordType: "Decision",
        sources: [{ label: "Alpha", recordId: "d1", recordType: "Decision" }],
      },
    ]);
  });

  test("refuses signed-out, foreign Project, open Project and foreign source", async () => {
    await expect(
      setup(false).projectClosureSummarySources({ projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectClosureSummarySources({ projectId: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setup(true, "Active").projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      setup().projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [{ recordId: "foreign", recordType: "Decision" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects smuggled narrative fields on the strict input", async () => {
    await expect(
      setup().projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [],
        summary: "Everything went great",
      } as never),
    ).rejects.toBeDefined();
  });

  test("the only write is the explicit save; draft and reads have none", () => {
    const names = Object.keys(appRouter).filter((name) =>
      CLOSURE_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "projectClosureSummaryDateComparison",
      "projectClosureSummaryDraft",
      "projectClosureSummarySources",
      "saveProjectClosureSummary",
    ]);
    expect(names.filter((name) => WRITE_PROCEDURE.test(name))).toEqual([
      "saveProjectClosureSummary",
    ]);
  });

  test("an unsaved draft is not a Document: generating it writes nothing", async () => {
    const documents = documentContracts();
    const client = setup(true, "Completed", documents.contracts);
    await client.projectClosureSummaryDraft({
      projectId: "project-1",
      sources: [{ recordId: "d1", recordType: "Decision" }],
    });
    await client.projectClosureSummaryDateComparison({
      projectId: "project-1",
      sources: [{ recordId: "w1", recordType: "Work" }],
    });
    expect(documents.commands).toEqual([]);
  });

  test("Save as Document creates one General Project Document titled Project Closure Summary", async () => {
    const documents = documentContracts();
    const client = setup(true, "Completed", documents.contracts);
    const saved = await client.saveProjectClosureSummary({
      baseRevision: 0,
      body: "## Decisions\n\n- [Alpha](/projects/project-1#d1)",
      clientIdempotencyKey: "save-1",
      projectId: "project-1",
    });
    expect(saved).toMatchObject({
      projectId: "project-1",
      revision: 1,
      title: "Project Closure Summary",
      type: "General",
    });
    expect(documents.commands).toHaveLength(1);
    expect(documents.commands[0]).toMatchObject({
      baseRevision: 0,
      clientIdempotencyKey: "save-1",
      kind: "human",
    });
    // Not a Retrospective starter skeleton: the founder's text is stored as is.
    expect(saved.body).not.toMatch(STARTER_HEADINGS);
  });

  test("a retried save with the same key returns the same Document", async () => {
    const documents = documentContracts();
    const client = setup(true, "Abandoned", documents.contracts);
    const input = {
      baseRevision: 0,
      body: "## Risks",
      clientIdempotencyKey: "save-retry",
      projectId: "project-1",
      title: "Closing notes",
    };
    const first = await client.saveProjectClosureSummary(input);
    const second = await client.saveProjectClosureSummary(input);
    expect(second.id).toBe(first.id);
    expect(first.title).toBe("Closing notes");
    expect(documents.seen.size).toBe(1);
  });

  test("saving leaves the Project and its source records alone and refuses an open Project", async () => {
    // The contracts double has no update and the memory sources have no write
    // member, so a save that touched a record or the lifecycle would throw.
    const client = setup();
    await expect(
      client.saveProjectClosureSummary({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "save-ok",
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({ type: "General" });
    await expect(
      client.projectClosureSummarySources({ projectId: "project-1" }),
    ).resolves.toMatchObject({ eligible: true, projectStatus: "Completed" });
    await expect(
      setup(true, "Active").saveProjectClosureSummary({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "save-open",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      setup(false).saveProjectClosureSummary({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "save-anon",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      client.saveProjectClosureSummary({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "save-foreign",
        projectId: "other",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("save refuses a smuggled type or a starter skeleton", async () => {
    const client = setup();
    await expect(
      client.saveProjectClosureSummary({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "save-type",
        projectId: "project-1",
        type: "Plan",
      } as never),
    ).rejects.toBeDefined();
    await expect(
      client.saveProjectClosureSummary({
        baseRevision: 0,
        clientIdempotencyKey: "save-skeleton",
        projectId: "project-1",
        skeleton: "Retrospective",
      } as never),
    ).rejects.toBeDefined();
  });

  test("the date comparison reads existing history and mints no score or actual date", async () => {
    const comparison = await setup().projectClosureSummaryDateComparison({
      projectId: "project-1",
      sources: [{ recordId: "w1", recordType: "Work" }],
    });
    expect(comparison.note).toBe(
      "This is a reading of existing history. It is not a score.",
    );
    expect(comparison.rows).toEqual([
      {
        closedOn: "2026-10-12",
        label: "P-1 Ship",
        moved: true,
        plannedDates: ["2026-10-01", "2026-10-10"],
        reading: "After target",
        recordId: "w1",
        recordType: "Work",
      },
    ]);
    expect(Object.keys(comparison.rows[0] ?? {}).join()).not.toMatch(
      SCORE_FIELD,
    );
    await expect(
      setup(true, "Active").projectClosureSummaryDateComparison({
        projectId: "project-1",
        sources: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("copying the saved Document to the Personal Wiki keeps the source origin and stays independent", async () => {
    const documents = documentContracts();
    const client = setup(true, "Completed", documents.contracts);
    const saved = await client.saveProjectClosureSummary({
      baseRevision: 0,
      body: "## Learnings",
      clientIdempotencyKey: "save-for-wiki",
      projectId: "project-1",
    });
    const copy = await client.transferDocument({
      action: "copy",
      baseRevision: 0,
      clientIdempotencyKey: "wiki-copy",
      copyDocumentId: crypto.randomUUID(),
      documentId: saved.id,
      documentRevision: saved.revision,
      previewFingerprint: "a".repeat(64),
      sourceRevision: saved.revision,
      targetProjectId: null,
    });
    expect(copy).toMatchObject({
      origin: { documentId: saved.id, revision: saved.revision },
      projectId: null,
    });
    expect(copy.id).not.toBe(saved.id);
    expect(documents.seen.get("save-for-wiki")?.projectId).toBe("project-1");
  });
});
