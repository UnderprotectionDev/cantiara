import { ProjectReleasePlanningConflictError } from "@cantiara/api/project-release-planning";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { workspaceContact } from "@cantiara/db/schema/contact";
import {
  githubInstallation,
  githubRepositoryLink,
} from "@cantiara/db/schema/github-integration";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { projectReleaseScope } from "@cantiara/db/schema/project-release-planning";
import { work } from "@cantiara/db/schema/work";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createProjectReleasePlanning } from "../../../../project-release-planning-wiring";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("Project Release Planning PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const otherAccountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const otherWorkspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const strangerProjectId = crypto.randomUUID();
  const releaseId = crypto.randomUUID();
  const otherReleaseId = crypto.randomUUID();
  const openWorkId = crypto.randomUUID();
  const doneWorkId = crypto.randomUUID();
  const otherWorkId = crypto.randomUUID();
  const repositoryId = crypto.randomUUID();
  const otherRepositoryId = crypto.randomUUID();
  const contactId = crypto.randomUUID();
  const strangerContactId = crypto.randomUUID();
  const targets: string[] = [];

  function access() {
    if (!db) {
      throw new Error("Test database required");
    }
    return createProjectReleasePlanning(db);
  }
  function envelope() {
    return { baseRevision: 0, clientIdempotencyKey: crypto.randomUUID() };
  }
  function scope(workId: string, extra: Partial<{ releaseId: string }> = {}) {
    return {
      ...envelope(),
      attached: true,
      projectId,
      releaseId,
      workId,
      ...extra,
    };
  }
  async function releaseRow(id = releaseId) {
    const [row] = await (db
      ?.select()
      .from(projectRelease)
      .where(eq(projectRelease.id, id)) ?? []);
    return row;
  }

  beforeEach(async () => {
    if (!db) {
      throw new Error("Test database required");
    }
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Stranger",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    await db.insert(project).values([
      {
        id: projectId,
        name: "tidekit",
        shortCode: `R${accountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "second",
        shortCode: `S${accountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: strangerProjectId,
        name: "stranger",
        shortCode: `T${otherAccountId.slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(projectRelease).values([
      { id: releaseId, name: "tidekit 1.1", projectId, revision: 1 },
      {
        id: otherReleaseId,
        name: "second 1.0",
        projectId: otherProjectId,
        revision: 1,
      },
    ]);
    await db.insert(work).values([
      {
        id: openWorkId,
        key: "TK-1",
        number: 1,
        projectId,
        status: "In Progress",
        title: "Sync engine",
        type: "Feature",
      },
      {
        closureResult: "Completed",
        id: doneWorkId,
        key: "TK-2",
        number: 2,
        projectId,
        status: "Closed",
        title: "Docs",
        type: "Task",
      },
      {
        id: otherWorkId,
        key: "SE-1",
        number: 1,
        projectId: otherProjectId,
        status: "Not Started",
        title: "Other Project Work",
        type: "Task",
      },
    ]);
    const installationId = crypto.randomUUID();
    const otherInstallationId = crypto.randomUUID();
    await db.insert(githubInstallation).values([
      {
        accountLogin: "acme",
        connectedByAccountId: accountId,
        id: installationId,
        installationId: Math.floor(Math.random() * 1e9),
        projectId,
      },
      {
        accountLogin: "acme",
        connectedByAccountId: accountId,
        id: otherInstallationId,
        installationId: Math.floor(Math.random() * 1e9),
        projectId: otherProjectId,
      },
    ]);
    await db.insert(githubRepositoryLink).values([
      {
        htmlUrl: "https://github.com/acme/tidekit",
        id: repositoryId,
        installationRowId: installationId,
        name: "tidekit",
        owner: "acme",
        projectId,
        repositoryId: Math.floor(Math.random() * 1e9),
      },
      {
        htmlUrl: "https://github.com/acme/second",
        id: otherRepositoryId,
        installationRowId: otherInstallationId,
        name: "second",
        owner: "acme",
        projectId: otherProjectId,
        repositoryId: Math.floor(Math.random() * 1e9),
      },
    ]);
    await db.insert(workspaceContact).values([
      { displayName: "Early adopter", id: contactId, workspaceId },
      {
        displayName: "Stranger",
        id: strangerContactId,
        workspaceId: otherWorkspaceId,
      },
    ]);
  });

  afterEach(async () => {
    if (!db) {
      return;
    }
    const actors = [accountId, otherAccountId];
    await db
      .delete(mutationStaging)
      .where(inArray(mutationStaging.actorId, actors));
    await db
      .delete(mutationReceipt)
      .where(inArray(mutationReceipt.actorId, actors));
    await db
      .delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, actors));
    if (targets.length) {
      await db
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, targets));
    }
    targets.length = 0;
    await db.delete(user).where(inArray(user.id, [accountId, otherAccountId]));
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  test("gathers explicit Work as scope, retries once and never writes the release or Work status", async () => {
    const planning = access();
    const before = await releaseRow();
    const command = scope(openWorkId);
    const member = await planning.setScope(accountId, command);
    expect(member).toMatchObject({
      attached: true,
      revision: 1,
      work: { id: openWorkId, status: "In Progress" },
    });
    if (member) {
      targets.push(member.id);
    }
    expect(await planning.setScope(accountId, command)).toEqual(member);
    const done = await planning.setScope(accountId, scope(doneWorkId));
    if (done) {
      targets.push(done.id);
    }
    const overview = await planning.overview(accountId, projectId);
    expect(overview?.releases).toHaveLength(1);
    expect(overview?.releases[0]?.scope).toEqual({ completed: 1, open: 1 });
    expect(await releaseRow()).toEqual(before);
    const [workRow] = await (db
      ?.select({ status: work.status })
      .from(work)
      .where(eq(work.id, openWorkId)) ?? []);
    expect(workRow?.status).toBe("In Progress");

    const removed = await planning.setScope(accountId, {
      ...scope(openWorkId),
      attached: false,
      baseRevision: 1,
    });
    expect(removed).toMatchObject({ attached: false, revision: 2 });
    const detail = await planning.detail(accountId, { projectId, releaseId });
    expect(
      detail?.scope.filter((row) => row.attached).map((row) => row.work.id),
    ).toEqual([doneWorkId]);
    expect(detail?.scopeCandidates.map((row) => row.id)).toEqual([openWorkId]);
    expect(detail?.release.status).toBe("Draft");
  });

  test("rejects cross-Project scope, foreign releases and other accounts", async () => {
    const planning = access();
    expect(await planning.setScope(accountId, scope(otherWorkId))).toBeNull();
    expect(
      await planning.setScope(
        accountId,
        scope(openWorkId, { releaseId: otherReleaseId }),
      ),
    ).toBeNull();
    expect(
      await planning.setScope(otherAccountId, scope(openWorkId)),
    ).toBeNull();
    expect(
      await planning.detail(otherAccountId, { projectId, releaseId }),
    ).toBeNull();
    expect(
      await planning.detail(accountId, {
        projectId,
        releaseId: otherReleaseId,
      }),
    ).toBeNull();
    await expect(
      db?.insert(projectReleaseScope).values({
        id: crypto.randomUUID(),
        projectId,
        releaseId,
        workId: otherWorkId,
      }),
    ).rejects.toThrow();
  });

  test("attaches references from the Project's repositories only, never as status", async () => {
    const planning = access();
    const before = await releaseRow();
    const link = {
      ...envelope(),
      attached: true,
      kind: "Release" as const,
      label: "v1.1.0",
      projectId,
      releaseId,
      repositoryLinkId: repositoryId,
      url: "https://github.com/acme/tidekit/releases/tag/v1.1.0",
    };
    const added = await planning.setLink(accountId, link);
    expect(added).toMatchObject({
      kind: "Release",
      repository: { name: "tidekit", owner: "acme" },
    });
    if (!added) {
      throw new Error("Release reference was not attached");
    }
    targets.push(added.id);
    // An identical repeated add reuses the payload-derived row id.
    const repeated = await planning.setLink(accountId, {
      ...link,
      ...envelope(),
      baseRevision: added.revision,
    });
    expect(repeated).toMatchObject({
      id: added.id,
      revision: added.revision + 1,
    });
    const environment = {
      ...envelope(),
      attached: true,
      kind: "Environment link" as const,
      label: "Production",
      projectId,
      releaseId,
      repositoryLinkId: null,
      url: "https://tidekit.example",
    };
    const addedEnvironment = await planning.setLink(accountId, environment);
    expect(addedEnvironment).toMatchObject({
      kind: "Environment link",
      repository: null,
    });
    if (!addedEnvironment) {
      throw new Error("Environment reference was not attached");
    }
    targets.push(addedEnvironment.id);
    expect(
      await planning.setLink(accountId, {
        ...envelope(),
        attached: true,
        kind: "Release",
        label: "v1.1.0",
        projectId,
        releaseId,
        repositoryLinkId: otherRepositoryId,
        url: "https://github.com/acme/tidekit/releases/tag/v1.1.0",
      }),
    ).toBeNull();
    // The repeated add did not open a second row: the detail holds two rows.
    const detail = await planning.detail(accountId, { projectId, releaseId });
    expect(detail?.links.map((row) => [row.kind, row.label])).toEqual([
      ["Release", "v1.1.0"],
      ["Environment link", "Production"],
    ]);
    const overview = await planning.overview(accountId, projectId);
    expect(overview?.releases[0]?.githubReferences).toBe(1);
    expect(await releaseRow()).toEqual(before);
  });

  test("links audience Contacts of the same workspace only", async () => {
    const planning = access();
    const audience = {
      ...envelope(),
      attached: true,
      projectId,
      releaseId,
      targetId: contactId,
      targetType: "Contact" as const,
    };
    const linked = await planning.setAudience(accountId, audience);
    expect(linked).toMatchObject({
      attached: true,
      target: { title: "Early adopter", type: "Contact" },
    });
    if (linked) {
      targets.push(linked.id);
    }
    expect(
      await planning.setAudience(accountId, {
        ...audience,
        ...envelope(),
        targetId: strangerContactId,
      }),
    ).toBeNull();
  });

  test("keeps an archived Project readable but closes planning writes", async () => {
    const planning = access();
    await db
      ?.update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect((await planning.overview(accountId, projectId))?.readOnly).toBe(
      true,
    );
    expect(await planning.setScope(accountId, scope(openWorkId))).toBeNull();
  });

  test("a GitHub Release double leaves the status unchanged and only suggests Published", async () => {
    const planning = access();
    await db
      ?.update(projectRelease)
      .set({ revision: 2, status: "Preparing" })
      .where(eq(projectRelease.id, releaseId));
    const before = await releaseRow();
    // Stand-in for a GitHub Release upsert: the linked Release reference.
    const githubRelease = {
      ...envelope(),
      attached: true,
      kind: "Release" as const,
      label: "v1.0.0",
      projectId,
      releaseId,
      repositoryLinkId: repositoryId,
      url: "https://github.com/acme/tidekit/releases/tag/v1.0.0",
    };
    const attached = await planning.setLink(accountId, githubRelease);
    expect(attached).toMatchObject({ kind: "Release" });
    if (!attached) {
      throw new Error("GitHub Release reference was not attached");
    }
    targets.push(attached.id);
    expect(await releaseRow()).toEqual(before);
    const detail = await planning.detail(accountId, { projectId, releaseId });
    expect(detail?.release.status).toBe("Preparing");
    expect(detail?.suggestion).toEqual({
      linkId: attached.id,
      reason: "GitHub Release v1.0.0 was published.",
      status: "Published",
    });
    const overview = await planning.overview(accountId, projectId);
    expect(overview?.releases[0]?.release.status).toBe("Preparing");
  });

  test.each(["Published", "Cancelled"] as const)(
    "a %s release keeps its scope, references and audience read-only",
    async (status) => {
      const planning = access();
      const member = await planning.setScope(accountId, scope(doneWorkId));
      if (member) {
        targets.push(member.id);
      }
      await db
        ?.update(projectRelease)
        .set({ revision: 2, status })
        .where(eq(projectRelease.id, releaseId));
      const before = await releaseRow();
      await expect(
        planning.setScope(accountId, scope(openWorkId)),
      ).rejects.toBeInstanceOf(ProjectReleasePlanningConflictError);
      await expect(
        planning.setScope(accountId, {
          ...scope(doneWorkId),
          attached: false,
          baseRevision: 1,
        }),
      ).rejects.toBeInstanceOf(ProjectReleasePlanningConflictError);
      await expect(
        planning.setLink(accountId, {
          ...envelope(),
          attached: true,
          kind: "Release",
          label: "v1.0.0",
          projectId,
          releaseId,
          repositoryLinkId: repositoryId,
          url: null,
        }),
      ).rejects.toBeInstanceOf(ProjectReleasePlanningConflictError);
      await expect(
        planning.setAudience(accountId, {
          ...envelope(),
          attached: true,
          projectId,
          releaseId,
          targetId: contactId,
          targetType: "Contact",
        }),
      ).rejects.toBeInstanceOf(ProjectReleasePlanningConflictError);
      expect(await releaseRow()).toEqual(before);
      const detail = await planning.detail(accountId, { projectId, releaseId });
      expect(detail?.release.status).toBe(status);
      expect(
        detail?.scope.filter((row) => row.attached).map((row) => row.work.id),
      ).toEqual([doneWorkId]);
      expect(detail?.links).toEqual([]);
      expect(detail?.suggestion).toBeNull();
    },
  );
});
