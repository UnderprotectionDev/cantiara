import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseWorkspaceOverview } from "./workspace-overview-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Workspace Overview PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `workspace-overview-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database.insert(workspace).values({
      id: workspaceId,
      ownerAccountId: accountId,
      overviewConfiguration: {
        layout: { hidden: [], order: [] },
        liveBlockSources: [],
        savedLists: [
          {
            columns: ["name", "archive"],
            conditions: {
              archive: "archived",
              areaMatch: "any",
              lifecycleStatuses: [],
              nameContains: "",
              projectAreas: [],
              stageNames: [],
            },
            groupBy: null,
            id: "archived-projects",
            name: "Archived Projects",
            sort: { direction: "asc", field: "name" },
          },
          {
            columns: ["name", "archive"],
            conditions: {
              archive: "not-archived",
              areaMatch: "any",
              lifecycleStatuses: [],
              nameContains: "",
              projectAreas: [],
              stageNames: [],
            },
            groupBy: null,
            id: "active-projects",
            name: "Active Projects",
            sort: { direction: "asc", field: "name" },
          },
        ],
        version: 1,
      },
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("reads Project archive state for live saved-list membership", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const archivedProjectId = `project-archived-${crypto.randomUUID()}`;
    const activeProjectId = `project-active-${crypto.randomUUID()}`;
    await database.insert(project).values([
      {
        archivedAt: new Date("2026-09-19T12:00:00.000Z"),
        id: archivedProjectId,
        name: "Archived Project",
        shortCode: "ARCH",
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: activeProjectId,
        name: "Active Project",
        shortCode: "ACTIVE",
        starterConfiguration: "Blank Project",
        workspaceId,
      },
    ]);

    const overview =
      await createDatabaseWorkspaceOverview(database).get(accountId);

    expect(overview.savedLists[0]?.projects.map(({ id }) => id)).toEqual([
      archivedProjectId,
    ]);
    expect(overview.savedLists[1]?.projects.map(({ id }) => id)).toEqual([
      activeProjectId,
    ]);
    expect(overview.savedLists[0]?.projects[0]?.archivedAt).toBe(
      "2026-09-19T12:00:00.000Z",
    );
  });
});
