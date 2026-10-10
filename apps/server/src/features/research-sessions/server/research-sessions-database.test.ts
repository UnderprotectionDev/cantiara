// biome-ignore-all lint/performance/noAwaitInLoops: Consent attempts are deliberately sequential at the same revision to prove rollback.
import { researchSessionContentInputSchema } from "@cantiara/api/research-sessions";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseResearchSessions } from "./research-sessions-database";

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
    });
  },
);
