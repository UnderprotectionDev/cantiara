// biome-ignore-all lint/performance/noAwaitInLoops: Consent attempts are deliberately sequential at the same revision to prove rollback.
import {
  researchSessionContentInputSchema,
  researchSessionConvertPreview,
} from "@cantiara/api/research-sessions";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  createDatabaseResearchSessions,
  sweepExpiredResearchBindingPreviews,
} from "./research-sessions-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
(url ? describe : describe.skip)(
  "Research Sessions — Kişisel veri consent fixture",
  () => {
    const db = url ? createDb({ DATABASE_URL: url }) : undefined;
    const accountId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    beforeAll(async () => {
      if (!db) {
        throw new Error("Database required");
      }
      await db.insert(user).values({
        id: accountId,
        name: "Founder",
        email: `${accountId}@example.invalid`,
      });
      await db
        .insert(workspace)
        .values({ id: workspaceId, ownerAccountId: accountId });
      await db.insert(project).values({
        id: projectId,
        workspaceId,
        name: "Research Sessions",
        shortCode: `R${accountId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
    });
    afterAll(async () => {
      await db?.delete(user).where(eq(user.id, accountId));
      await db?.$client.end();
    });
    test.each(["Not asked", "Not allowed"] as const)(
      "%s rejects protected bytes and later Allowed cannot resurrect them",
      async (consent) => {
        if (!db) {
          throw new Error("Database required");
        }
        const sessions = createDatabaseResearchSessions(db);
        const command = {
          id: crypto.randomUUID(),
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          fields: {
            title: "Private export interview",
            purpose: "Understand demand",
            consent,
          },
        };
        const saved = await sessions.save(accountId, command);
        expect(await sessions.save(accountId, command)).toEqual(saved);
        for (const content of [
          {
            kind: "Participant quote",
            id: "quote-private",
            text: "Private words",
            speakerLabel: "Private name",
          },
          {
            kind: "Identifying personal note",
            id: "note-private",
            text: "Private address",
          },
          {
            kind: "File Attachment",
            id: "file-private",
            fileId: "file-1",
            fileVersionId: "version-1",
          },
        ]) {
          await expect(
            sessions.capture(accountId, {
              id: saved.id,
              projectId,
              baseRevision: saved.revision,
              clientIdempotencyKey: crypto.randomUUID(),
              content: researchSessionContentInputSchema.parse(content),
            }),
          ).rejects.toThrow();
        }
        const allowed = await sessions.save(accountId, {
          ...command,
          fields: { ...command.fields, consent: "Allowed" },
          baseRevision: saved.revision,
          clientIdempotencyKey: crypto.randomUUID(),
        });
        expect(allowed.content).toEqual([]);
        expect(
          (await sessions.list(accountId, projectId))?.records,
        ).toContainEqual(allowed);
        expect(await sessions.list("another-founder", projectId)).toBeNull();
      },
    );
    test.each(["Allowed", "Not applicable"] as const)(
      "%s captures protected content once and rejects stale writes after revocation",
      async (consent) => {
        if (!db) {
          throw new Error("Database required");
        }
        const sessions = createDatabaseResearchSessions(db);
        const command = {
          id: crypto.randomUUID(),
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          fields: {
            title: "Consented interview",
            purpose: "Understand CSV",
            consent,
          },
        };
        const saved = await sessions.save(accountId, command);
        const capture = {
          id: saved.id,
          projectId,
          baseRevision: saved.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          content: {
            id: "quote-1",
            kind: "Participant quote" as const,
            text: "Use CSV",
          },
        };
        const quoted = await sessions.capture(accountId, capture);
        expect(quoted.content).toEqual([
          {
            consentAtCapture: consent,
            content: {
              id: "quote-1",
              kind: "Participant quote",
              text: "Use CSV",
              speakerLabel: null,
              relationIds: [],
            },
          },
        ]);
        expect(await sessions.capture(accountId, capture)).toEqual(quoted);
        const revoked = await sessions.save(accountId, {
          ...command,
          fields: { ...command.fields, consent: "Not allowed" },
          baseRevision: quoted.revision,
          clientIdempotencyKey: crypto.randomUUID(),
        });
        await expect(
          sessions.capture(accountId, {
            ...capture,
            clientIdempotencyKey: crypto.randomUUID(),
            content: { ...capture.content, id: "stale-quote" },
          }),
        ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
        await expect(
          sessions.capture(accountId, {
            ...capture,
            baseRevision: revoked.revision,
            clientIdempotencyKey: crypto.randomUUID(),
            content: { ...capture.content, id: "denied-quote" },
          }),
        ).rejects.toThrow();
        expect(
          (await sessions.list(accountId, projectId))?.records,
        ).toContainEqual(revoked);
        expect(revoked.consentRecordedBy).toBe(accountId);
        expect(revoked.consentRecordedAt).toEqual(revoked.updatedAt);
      },
    );
    test("Contact must resolve through the owning collaborator; unknown interviews do not need it", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const command = {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: "Known participant",
          purpose: "Export needs",
          participantContactId: "known-contact",
        },
      };
      await expect(
        createDatabaseResearchSessions(db).save(accountId, command),
      ).rejects.toThrow();
      const sessions = createDatabaseResearchSessions(db, {
        isAvailable: async (_executor, actorId, contactId) =>
          actorId === accountId && contactId === "known-contact",
      });
      const linked = await sessions.save(accountId, {
        ...command,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      expect(linked.participantContactId).toBe("known-contact");
      expect(linked.participantConsentAtLink).toBe("Not asked");
      const allowed = await sessions.save(accountId, {
        ...command,
        baseRevision: linked.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: { ...command.fields, consent: "Allowed" },
      });
      expect(allowed.participantConsentAtLink).toBe("Not asked");
      await expect(
        sessions.save(accountId, {
          ...command,
          id: crypto.randomUUID(),
          clientIdempotencyKey: crypto.randomUUID(),
          fields: {
            ...command.fields,
            participantContactId: "unavailable-contact",
          },
        }),
      ).rejects.toThrow();
    });
    test("File Attachment capture uses the exact accessible Project file version", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const saved = await sessions.save(accountId, {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: "File context",
          purpose: "Export needs",
          consent: "Allowed",
        },
      });
      const command = {
        id: saved.id,
        projectId,
        baseRevision: saved.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        content: {
          id: "file-context",
          kind: "File Attachment" as const,
          fileId: crypto.randomUUID(),
          fileVersionId: crypto.randomUUID(),
        },
      };
      await expect(sessions.capture(accountId, command)).rejects.toThrow();
      await db.insert(fileAttachment).values({
        id: command.content.fileId,
        workspaceId,
        projectId,
        scopeType: "Project",
        name: "Interview notes",
      });
      await db.insert(fileAttachmentVersion).values({
        id: command.content.fileVersionId,
        attachmentId: command.content.fileId,
        byteSize: 10,
        contentHash: "0".repeat(64),
        detectedMimeType: "text/plain",
        extension: "txt",
        fileName: "interview.txt",
        mimeType: "text/plain",
        objectKey: "research-fixture",
        version: 1,
      });
      const withFile = await sessions.capture(accountId, {
        ...command,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      expect(withFile.content).toEqual([
        {
          consentAtCapture: "Allowed",
          content: { ...command.content, relationIds: [] },
        },
      ]);
      await expect(
        sessions.capture(accountId, {
          ...command,
          baseRevision: withFile.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          content: {
            ...command.content,
            id: "wrong-version",
            fileVersionId: "unavailable-version",
          },
        }),
      ).rejects.toThrow();
    });
    test("typed notes persist with atomic revisions, stable kinds, retry identity and immutable capture Consent", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const saved = await sessions.save(accountId, {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: "Typed notes",
          purpose: "Export",
          consent: "Not allowed",
        },
      });
      const command = {
        id: saved.id,
        projectId,
        baseRevision: saved.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        create: true,
        note: {
          id: "observation",
          kind: "Observation" as const,
          text: "The menu took three attempts",
          containsPersonalInformation: false,
        },
      };
      const noted = await sessions.saveNote(accountId, command);
      expect(await sessions.saveNote(accountId, command)).toEqual(noted);
      expect(noted.sourceType).toBe("Research Session");
      expect(noted.content[0]).toMatchObject({
        consentAtCapture: "Not allowed",
        content: { kind: "Observation", text: command.note.text },
      });
      await expect(
        sessions.saveNote(accountId, {
          ...command,
          create: false,
          baseRevision: noted.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          note: { ...command.note, containsPersonalInformation: true },
        }),
      ).rejects.toThrow();
      const allowed = await sessions.save(accountId, {
        id: saved.id,
        projectId,
        baseRevision: noted.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: { title: "Typed notes", purpose: "Export", consent: "Allowed" },
      });
      const edit = {
        ...command,
        create: false,
        baseRevision: allowed.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        note: { ...command.note, text: "The menu took four attempts" },
      };
      const edited = await sessions.saveNote(accountId, edit);
      expect(await sessions.saveNote(accountId, edit)).toEqual(edited);
      expect(edited.content[0]).toMatchObject({
        consentAtCapture: "Not allowed",
        content: { text: edit.note.text },
      });
      await expect(
        sessions.saveNote(accountId, {
          ...edit,
          baseRevision: edited.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          note: {
            id: command.note.id,
            kind: "Participant quote",
            text: "Misattributed words",
          },
        }),
      ).rejects.toThrow();
      await expect(
        sessions.saveNote(accountId, {
          ...edit,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
      await expect(
        sessions.saveNote("foreign-founder", {
          ...edit,
          baseRevision: edited.revision,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        sessions.saveNote(accountId, {
          ...edit,
          note: { ...edit.note, id: "missing" },
          baseRevision: edited.revision,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      const interpretation = await sessions.saveNote(accountId, {
        ...command,
        baseRevision: edited.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        note: {
          id: "interpretation",
          kind: "Founder interpretation",
          text: "A shorter menu may help",
          containsPersonalInformation: true,
        },
      });
      expect(
        (await sessions.list(accountId, projectId))?.records,
      ).toContainEqual(interpretation);
      expect(interpretation.content[1]).toMatchObject({
        content: {
          kind: "Founder interpretation",
          text: "A shorter menu may help",
        },
      });
      const preview = researchSessionConvertPreview(
        interpretation,
        "interpretation",
      );
      const rewritten = await sessions.saveNote(accountId, {
        ...edit,
        baseRevision: interpretation.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        note: {
          id: "interpretation",
          kind: "Founder interpretation",
          text: "An explicit action may help",
          containsPersonalInformation: true,
        },
      });
      expect(preview).toMatchObject({
        sessionRevision: interpretation.revision,
        content: {
          kind: "Founder interpretation",
          text: "A shorter menu may help",
        },
      });
      expect(rewritten.content[1]).toMatchObject({
        content: {
          kind: "Founder interpretation",
          text: "An explicit action may help",
        },
      });
    });
    test("foreign and archived Projects refuse new writes", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const command = {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: { title: "Unavailable interview", purpose: "Export needs" },
      };
      await expect(sessions.save("foreign-founder", command)).rejects.toThrow();
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect((await sessions.list(accountId, projectId))?.readOnly).toBe(true);
      await expect(
        sessions.save(accountId, {
          ...command,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        sessions.saveNote(accountId, {
          id: command.id,
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          create: true,
          note: {
            id: "archived-note",
            kind: "Observation",
            text: "Menu behavior",
            containsPersonalInformation: false,
          },
        }),
      ).rejects.toThrow();
    });
  },
);

(url ? describe : describe.skip)(
  "Research Sessions — preview and pinned conversion",
  () => {
    const db = url ? createDb({ DATABASE_URL: url }) : undefined;
    const accountId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const foreignLifecycleAccounts: string[] = [];
    beforeAll(async () => {
      if (!db) {
        throw new Error("Database required");
      }
      await db.insert(user).values({
        id: accountId,
        name: "Founder",
        email: `${accountId}@example.invalid`,
      });
      await db
        .insert(workspace)
        .values({ id: workspaceId, ownerAccountId: accountId });
      await db.insert(project).values({
        id: projectId,
        workspaceId,
        name: "Pinned research",
        shortCode: `P${accountId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
    });
    afterAll(async () => {
      for (const id of foreignLifecycleAccounts) {
        await db?.delete(user).where(eq(user.id, id));
      }
      await db?.delete(user).where(eq(user.id, accountId));
      await db?.$client.end();
    });
    test("preview creates no target; confirm creates one target and preserves the old pin after editing", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const { createDatabaseProjectSourceRecords } = await import(
        "../../project-source-records/server/project-source-records-database"
      );
      const targets = createDatabaseProjectSourceRecords(db);
      const saved = await sessions.save(accountId, {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: "CSV interview",
          purpose: "Export needs",
          consent: "Allowed",
        },
      });
      const noted = await sessions.saveNote(accountId, {
        id: saved.id,
        projectId,
        baseRevision: saved.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        create: true,
        note: {
          id: "q1",
          kind: "Participant quote",
          text: "Please use CSV exports today.",
        },
      });
      const { listAssumptions } = targets;
      if (!listAssumptions) {
        throw new Error("Assumption listing required");
      }
      const before = await listAssumptions(accountId, projectId);
      const preview = await sessions.previewBinding(accountId, {
        id: noted.id,
        projectId,
        baseRevision: noted.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        contentId: "q1",
        start: 11,
        end: 22,
        target: {
          mode: "create",
          type: "Assumption",
          projectId,
          title: "CSV demand",
        },
      });
      expect(await listAssumptions(accountId, projectId)).toEqual(before);
      const command = {
        id: noted.id,
        projectId,
        baseRevision: noted.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        previewId: preview.previewId,
      };
      const binding = await sessions.confirmBinding(accountId, command);
      expect(await sessions.confirmBinding(accountId, command)).toEqual(
        binding,
      );
      expect((await listAssumptions(accountId, projectId))?.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: binding.target.recordId,
            statement: "CSV exports",
          }),
        ]),
      );
      const current = (await sessions.list(accountId, projectId))?.records.find(
        (record) => record.id === noted.id,
      );
      if (!current) {
        throw new Error("Session required");
      }
      expect(current.content[0]?.content).toMatchObject({
        id: "q1",
        text: "Please use CSV exports today.",
      });
      await sessions.saveNote(accountId, {
        id: current.id,
        projectId,
        baseRevision: current.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        create: false,
        note: { id: "q1", kind: "Participant quote", text: "PDF instead" },
      });
      expect(
        await sessions.listBindings(accountId, { id: current.id, projectId }),
      ).toEqual([binding]);
      expect(binding.pin).toMatchObject({
        excerpt: "CSV exports",
        source: { revision: noted.revision, componentId: "q1" },
      });
    });

    async function notedSession(
      consent: "Allowed" | "Not allowed" = "Allowed",
    ) {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const saved = await sessions.save(accountId, {
        id: crypto.randomUUID(),
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: "Binding interview",
          purpose: "CSV demand",
          consent,
          channel: "Interview",
        },
      });
      return sessions.saveNote(accountId, {
        id: saved.id,
        projectId,
        baseRevision: saved.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        create: true,
        note: {
          id: "note",
          kind: "Observation",
          text: "CSV exports",
          containsPersonalInformation: false,
        },
      });
    }
    function previewInput(
      record: { id: string; revision: number },
      target: import("@cantiara/api/research-session-bindings").ResearchBindingPlan["target"],
    ) {
      return {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        contentId: "note",
        start: 0,
        end: 11,
        target,
      };
    }
    test("expired preparations are swept while confirmed retries keep their receipt and current consent gate", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const record = await notedSession();
      const input = previewInput(record, {
        mode: "create",
        type: "Assumption",
        projectId,
        title: "Retained receipt",
      });
      const abandoned = await sessions.previewBinding(accountId, input);
      const preview = await sessions.previewBinding(accountId, input);
      const command = {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        previewId: preview.previewId,
        clientIdempotencyKey: crypto.randomUUID(),
      };
      const binding = await sessions.confirmBinding(accountId, command);
      expect(
        await sweepExpiredResearchBindingPreviews(
          db,
          new Date(Date.now() + 16 * 60_000),
        ),
      ).toBeGreaterThanOrEqual(2);
      expect(await sessions.confirmBinding(accountId, command)).toEqual(
        binding,
      );
      await expect(
        sessions.confirmBinding(accountId, {
          ...command,
          previewId: abandoned.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        sessions.confirmBinding(accountId, {
          ...command,
          previewId: abandoned.previewId,
        }),
      ).rejects.toThrow();
      const current = (await sessions.list(accountId, projectId))?.records.find(
        (item) => item.id === record.id,
      );
      if (!current) {
        throw new Error("Session required");
      }
      await sessions.save(accountId, {
        id: current.id,
        projectId,
        baseRevision: current.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: current.title,
          purpose: current.purpose,
          consent: "Not allowed",
        },
      });
      await expect(
        sessions.confirmBinding(accountId, command),
      ).rejects.toThrow();
    });

    test.each(["source", "target"] as const)(
      "deleting the %s Project preserves Evidence and Origin for the surviving end",
      async (deletedEnd) => {
        if (!db) {
          throw new Error("Database required");
        }
        const sessions = createDatabaseResearchSessions(db);
        const sourceProjectId = crypto.randomUUID();
        const targetProjectId = crypto.randomUUID();
        for (const id of [sourceProjectId, targetProjectId]) {
          await db.insert(project).values({
            id,
            workspaceId,
            name: "Deletion fixture",
            shortCode: `D${id.slice(0, 6).toUpperCase()}`,
            starterConfiguration: "Blank Project",
          });
        }
        const saved = await sessions.save(accountId, {
          id: crypto.randomUUID(),
          projectId: sourceProjectId,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          fields: {
            title: "Historical research",
            purpose: "Keep provenance",
            consent: "Allowed",
          },
        });
        const record = await sessions.saveNote(accountId, {
          id: saved.id,
          projectId: sourceProjectId,
          baseRevision: saved.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          create: true,
          note: {
            id: "note",
            kind: "Participant quote",
            text: "Private quote",
          },
        });
        const preview = await sessions.previewBinding(accountId, {
          ...previewInput(record, {
            mode: "create",
            type: "Assumption",
            projectId: targetProjectId,
            title: "Surviving claim",
          }),
          projectId: sourceProjectId,
        });
        const binding = await sessions.confirmBinding(accountId, {
          id: record.id,
          projectId: sourceProjectId,
          baseRevision: record.revision,
          previewId: preview.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        });
        await db
          .delete(project)
          .where(
            eq(
              project.id,
              deletedEnd === "source" ? sourceProjectId : targetProjectId,
            ),
          );
        // Persistence invariant: Project cascade must never remove a surviving end's historical relation.
        const { evidenceBinding, recordOrigin } = await import(
          "@cantiara/db/schema/evidence"
        );
        const [historical] = await db
          .select()
          .from(evidenceBinding)
          .where(eq(evidenceBinding.id, binding.id));
        expect(historical).toMatchObject({
          sourceProjectId: deletedEnd === "source" ? null : sourceProjectId,
          targetProjectId: deletedEnd === "target" ? null : targetProjectId,
          sourceRecordId: record.id,
          targetRecordId: binding.target.recordId,
          createdAt: new Date(binding.createdAt),
        });
        const [origin] = await db
          .select()
          .from(recordOrigin)
          .where(eq(recordOrigin.evidenceBindingId, binding.id));
        expect(origin).toMatchObject({
          sourceRecordId: record.id,
          targetRecordId: binding.target.recordId,
          location: binding.pin.source,
        });
        if (deletedEnd === "target") {
          expect(
            await sessions.listBindings(accountId, {
              id: record.id,
              projectId: sourceProjectId,
            }),
          ).toEqual([
            {
              ...binding,
              target: {
                ...binding.target,
                projectId: null,
                label: null,
                brokenReason: "Permanently deleted",
                canOpenSourceRecord: false,
              },
            },
          ]);
        } else {
          await expect(
            sessions.listBindings(accountId, {
              id: record.id,
              projectId: sourceProjectId,
            }),
          ).rejects.toThrow();
          const { createDatabaseProjectSourceRecords } = await import(
            "../../project-source-records/server/project-source-records-database"
          );
          const records = await createDatabaseProjectSourceRecords(
            db,
          ).listAssumptions?.(accountId, targetProjectId);
          expect(records?.records).toEqual([
            expect.objectContaining({ id: binding.target.recordId }),
          ]);
        }
        await db
          .delete(project)
          .where(
            eq(
              project.id,
              deletedEnd === "source" ? targetProjectId : sourceProjectId,
            ),
          );
      },
    );

    test.each([
      "Archived Project",
      "Archived Work",
      "In Trash",
      "Archived Feedback",
      "Permanently deleted",
      "No access",
    ] as const)("%s retains a safe binding row", async (state) => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const record = await notedSession();
      const targetProjectId = crypto.randomUUID();
      await db.insert(project).values({
        id: targetProjectId,
        workspaceId,
        name: "Lifecycle target",
        shortCode: `L${targetProjectId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      const type = state === "Archived Feedback" ? "Feedback" : "Work";
      const preview = await sessions.previewBinding(
        accountId,
        previewInput(record, {
          mode: "create",
          type,
          projectId: targetProjectId,
          title: "Private target title",
          ...(type === "Work" ? { workType: "Research" as const } : {}),
        }),
      );
      const command = {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        previewId: preview.previewId,
        clientIdempotencyKey: crypto.randomUUID(),
      };
      const binding = await sessions.confirmBinding(accountId, command);
      const { work } = await import("@cantiara/db/schema/work");
      const { feedback } = await import("@cantiara/db/schema/feedback");
      if (state === "No access") {
        const otherWorkspaceId = crypto.randomUUID();
        const foreignAccountId = crypto.randomUUID();
        foreignLifecycleAccounts.push(foreignAccountId);
        await db.insert(user).values({
          id: foreignAccountId,
          name: "Foreign owner",
          email: `${foreignAccountId}@example.invalid`,
        });
        await db
          .insert(workspace)
          .values({ id: otherWorkspaceId, ownerAccountId: foreignAccountId });
        await db
          .update(project)
          .set({ workspaceId: otherWorkspaceId })
          .where(eq(project.id, targetProjectId));
      } else if (state === "Archived Project") {
        await db
          .update(project)
          .set({ archivedAt: new Date() })
          .where(eq(project.id, targetProjectId));
      } else if (state === "Archived Feedback") {
        await db
          .update(feedback)
          .set({ status: "Archived" })
          .where(eq(feedback.id, binding.target.recordId));
      } else if (state === "Permanently deleted") {
        await db.delete(work).where(eq(work.id, binding.target.recordId));
      } else {
        await db
          .update(work)
          .set(
            state === "In Trash"
              ? { trashedAt: new Date() }
              : { archivedAt: new Date() },
          )
          .where(eq(work.id, binding.target.recordId));
      }
      if (state === "Archived Feedback") {
        expect(
          await sessions.readBindingFeedback(accountId, {
            id: record.id,
            projectId,
            bindingId: binding.id,
          }),
        ).toMatchObject({
          id: binding.target.recordId,
          status: "Archived",
          originalMessage: "CSV exports",
        });
        await expect(
          sessions.readBindingFeedback("foreign-account", {
            id: record.id,
            projectId,
            bindingId: binding.id,
          }),
        ).rejects.toThrow();
      }
      const rows = await sessions.listBindings(accountId, {
        id: record.id,
        projectId,
      });
      expect(rows).toEqual([
        {
          ...binding,
          target: {
            ...binding.target,
            projectId:
              state === "Permanently deleted" || state === "No access"
                ? null
                : targetProjectId,
            label: null,
            brokenReason:
              state === "In Trash" ||
              state === "Permanently deleted" ||
              state === "No access"
                ? state
                : "Archived",
            canOpenSourceRecord:
              state !== "Permanently deleted" && state !== "No access",
          },
        },
      ]);
      expect(await sessions.confirmBinding(accountId, command)).toEqual(
        rows[0],
      );
      if (state !== "Permanently deleted") {
        const current = (
          await sessions.list(accountId, projectId)
        )?.records.find((item) => item.id === record.id);
        if (!current) {
          throw new Error("Session required");
        }
        await expect(
          sessions.previewBinding(
            accountId,
            previewInput(current, {
              mode: "bind",
              type,
              projectId: targetProjectId,
              recordId: binding.target.recordId,
            }),
          ),
        ).rejects.toThrow();
      }
      if (state === "Archived Work" || state === "In Trash") {
        await db
          .update(work)
          .set({ archivedAt: null, trashedAt: null })
          .where(eq(work.id, binding.target.recordId));
        expect(
          await sessions.listBindings(accountId, { id: record.id, projectId }),
        ).toEqual([binding]);
      }
      await db.delete(project).where(eq(project.id, targetProjectId));
    });

    test.each([
      "Feedback",
      "Assumption",
      "Open Question",
      "Work",
      "Feature",
      "Decision",
    ] as const)(
      "%s creates once and binds an existing target without creating another record",
      async (type) => {
        if (!db) {
          throw new Error("Database required");
        }
        const sessions = createDatabaseResearchSessions(db);
        const record = await notedSession();
        const target = {
          mode: "create" as const,
          type,
          projectId,
          title: `CSV ${type}`,
          ...(type === "Work" ? { workType: "Research" as const } : {}),
        };
        const before = await sessions.bindingTargets(accountId, {
          id: record.id,
          projectId,
        });
        const preview = await sessions.previewBinding(
          accountId,
          previewInput(record, target),
        );
        expect(
          await sessions.bindingTargets(accountId, {
            id: record.id,
            projectId,
          }),
        ).toEqual(before);
        const command = {
          id: record.id,
          projectId,
          baseRevision: record.revision,
          previewId: preview.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        };
        const binding = await sessions.confirmBinding(accountId, command);
        expect(await sessions.confirmBinding(accountId, command)).toEqual(
          binding,
        );
        expect(binding.origin).toBe(true);
        const after = await sessions.bindingTargets(accountId, {
          id: record.id,
          projectId,
        });
        expect(after.records.length).toBe(before.records.length + 1);
        expect(after.records).toContainEqual({
          id: binding.target.recordId,
          projectId,
          type,
          title: target.title,
        });
        if (type === "Feedback") {
          const { listFeedbackRecords } = await import(
            "../../feedback/server/feedback-database"
          );
          expect(
            await listFeedbackRecords(db, accountId, projectId),
          ).toContainEqual(
            expect.objectContaining({
              id: binding.target.recordId,
              originalMessage: "CSV exports",
              channel: "Interview",
              occurredAt: record.createdAt,
              status: "New",
            }),
          );
          expect(
            await listFeedbackRecords(db, "foreign-account", projectId),
          ).toEqual([]);
        }
        if (type === "Work" || type === "Feature") {
          const { createDatabaseWorkLifecycle } = await import(
            "../../work-lifecycle/server/work-lifecycle-database"
          );
          expect(
            await createDatabaseWorkLifecycle(db).find(
              accountId,
              binding.target.recordId,
            ),
          ).toMatchObject({
            type: type === "Work" ? "Research" : "Feature",
            description: "CSV exports",
            originPosition: {
              ownerRecordId: record.id,
              componentId: "note",
              sourceVersion: String(record.revision),
            },
          });
        }
        const current = (
          await sessions.list(accountId, projectId)
        )?.records.find((item) => item.id === record.id);
        if (!current) {
          throw new Error("Session required");
        }
        const bindPreview = await sessions.previewBinding(
          accountId,
          previewInput(current, {
            mode: "bind",
            type,
            projectId,
            recordId: binding.target.recordId,
          }),
        );
        const linked = await sessions.confirmBinding(accountId, {
          ...command,
          baseRevision: current.revision,
          previewId: bindPreview.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        });
        expect(linked.origin).toBe(false);
        expect(linked.target.recordId).toBe(binding.target.recordId);
        expect(
          await sessions.bindingTargets(accountId, {
            id: record.id,
            projectId,
          }),
        ).toEqual(after);
        expect(
          await sessions.listBindings(accountId, { id: record.id, projectId }),
        ).toHaveLength(2);
        await expect(
          sessions.confirmBinding(accountId, {
            ...command,
            clientIdempotencyKey: crypto.randomUUID(),
          }),
        ).rejects.toThrow();
        await expect(
          sessions.confirmBinding(accountId, {
            ...command,
            previewId: bindPreview.previewId,
          }),
        ).rejects.toThrow();
      },
    );
    test("stale, revoked, capture-denied, invalid and foreign previews never produce a target", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const record = await notedSession();
      const target = {
        mode: "create" as const,
        type: "Assumption" as const,
        projectId,
        title: "Must not exist",
      };
      const input = previewInput(record, target);
      const preview = await sessions.previewBinding(accountId, input);
      const before = await sessions.bindingTargets(accountId, record);
      for (const change of [
        { start: -1 },
        { end: 12 },
        { start: 11 },
        { contentId: "missing" },
        { target: { ...target, projectId: "foreign-project" } },
      ]) {
        await expect(
          sessions.previewBinding(accountId, { ...input, ...change }),
        ).rejects.toThrow();
      }
      await expect(
        sessions.previewBinding("foreign-account", input),
      ).rejects.toThrow();
      await expect(
        sessions.confirmBinding("foreign-account", {
          id: record.id,
          projectId,
          baseRevision: record.revision,
          previewId: preview.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      const revoked = await sessions.save(accountId, {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: record.title,
          purpose: record.purpose,
          consent: "Not allowed",
        },
      });
      await expect(
        sessions.confirmBinding(accountId, {
          id: record.id,
          projectId,
          baseRevision: record.revision,
          previewId: preview.previewId,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        sessions.previewBinding(accountId, previewInput(revoked, target)),
      ).rejects.toThrow();
      const denied = await notedSession("Not allowed");
      const widened = await sessions.save(accountId, {
        id: denied.id,
        projectId,
        baseRevision: denied.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: denied.title,
          purpose: denied.purpose,
          consent: "Allowed",
        },
      });
      await expect(
        sessions.previewBinding(accountId, previewInput(widened, target)),
      ).rejects.toThrow();
      expect(await sessions.bindingTargets(accountId, record)).toEqual(before);
    });
    test("a target archived after preview rolls back confirmation without consuming it", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const record = await notedSession();
      const targetProjectId = crypto.randomUUID();
      await db.insert(project).values({
        id: targetProjectId,
        workspaceId,
        name: "Target",
        shortCode: `T${targetProjectId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      });
      const preview = await sessions.previewBinding(
        accountId,
        previewInput(record, {
          mode: "create",
          type: "Decision",
          projectId: targetProjectId,
          title: "CSV decision",
        }),
      );
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, targetProjectId));
      const command = {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        previewId: preview.previewId,
        clientIdempotencyKey: crypto.randomUUID(),
      };
      await expect(
        sessions.confirmBinding(accountId, command),
      ).rejects.toThrow();
      expect(await sessions.listBindings(accountId, record)).toEqual([]);
      expect(
        (await sessions.list(accountId, projectId))?.records,
      ).toContainEqual(record);
      await db
        .update(project)
        .set({ archivedAt: null })
        .where(eq(project.id, targetProjectId));
      expect(await sessions.confirmBinding(accountId, command)).toMatchObject({
        target: { projectId: targetProjectId, type: "Decision" },
      });
    });

    test("expired previews and revoked Evidence reads fail closed", async () => {
      if (!db) {
        throw new Error("Database required");
      }
      const sessions = createDatabaseResearchSessions(db);
      const record = await notedSession();
      const input = previewInput(record, {
        mode: "create",
        type: "Assumption",
        projectId,
        title: "Expiry demand",
      });
      const expired = await sessions.previewBinding(accountId, input);
      const command = {
        id: record.id,
        projectId,
        baseRevision: record.revision,
        previewId: expired.previewId,
        clientIdempotencyKey: crypto.randomUUID(),
      };
      vi.setSystemTime(new Date(Date.now() + 16 * 60_000));
      try {
        await expect(
          sessions.confirmBinding(accountId, command),
        ).rejects.toThrow();
      } finally {
        vi.useRealTimers();
      }
      const preview = await sessions.previewBinding(accountId, input);
      const confirmed = await sessions.confirmBinding(accountId, {
        ...command,
        previewId: preview.previewId,
        clientIdempotencyKey: crypto.randomUUID(),
      });
      expect(await sessions.listBindings(accountId, record)).toEqual([
        confirmed,
      ]);
      const current = (await sessions.list(accountId, projectId))?.records.find(
        (item) => item.id === record.id,
      );
      if (!current) {
        throw new Error("Session required");
      }
      await sessions.save(accountId, {
        id: record.id,
        projectId,
        baseRevision: current.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: current.title,
          purpose: current.purpose,
          consent: "Not allowed",
        },
      });
      expect(await sessions.listBindings(accountId, record)).toEqual([]);
      await expect(
        sessions.listBindings("foreign-account", record),
      ).rejects.toThrow();
    });
  },
);
