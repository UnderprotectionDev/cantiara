import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectWall,
  projectWallFocusStep,
  projectWallGroup,
  projectWallItem,
  projectWallLink,
} from "@cantiara/db/schema/project-wall";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type {
  BuildInPublicSourceMember,
  BuildInPublicSourceWall,
} from "./build-in-public-project-view";

const MAX_TEXT = 20_000;

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

function text(value: string | null | undefined) {
  return (value ?? "").slice(0, MAX_TEXT);
}

async function wallsOf(
  database: Database,
  projectId: string,
): Promise<BuildInPublicSourceMember[]> {
  const walls = await database
    .select()
    .from(projectWall)
    .where(eq(projectWall.projectId, projectId))
    .orderBy(asc(projectWall.title));
  if (walls.length === 0) {
    return [];
  }
  const wallIds = walls.map((wall) => wall.id);
  const [items, groups, links, steps] = await Promise.all([
    database
      .select()
      .from(projectWallItem)
      .where(inArray(projectWallItem.wallId, wallIds))
      .orderBy(asc(projectWallItem.zOrder)),
    database
      .select()
      .from(projectWallGroup)
      .where(inArray(projectWallGroup.wallId, wallIds)),
    database
      .select()
      .from(projectWallLink)
      .where(inArray(projectWallLink.wallId, wallIds)),
    database
      .select()
      .from(projectWallFocusStep)
      .where(inArray(projectWallFocusStep.wallId, wallIds))
      .orderBy(asc(projectWallFocusStep.position)),
  ]);
  const workIds = items
    .filter((item) => item.sourceType === "Work")
    .map((item) => item.sourceId);
  const decisionIds = items
    .filter((item) => item.sourceType === "Decision")
    .map((item) => item.sourceId);
  const [works, decisions] = await Promise.all([
    workIds.length > 0
      ? database
          .select({ id: work.id, title: work.title })
          .from(work)
          .where(inArray(work.id, workIds))
      : [],
    decisionIds.length > 0
      ? database
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(inArray(decision.id, decisionIds))
      : [],
  ]);
  const titles = new Map<string, string>([
    ...works.map((row) => [row.id, row.title] as const),
    ...decisions.map((row) => [row.id, row.title] as const),
  ]);

  return walls.map((wall): BuildInPublicSourceMember => {
    const own = items.filter((item) => item.wallId === wall.id);
    const source: BuildInPublicSourceWall = {
      cards: own.map((item) => ({
        color: item.highlight,
        groupId: item.groupId,
        id: item.id,
        title: titles.get(item.sourceId) ?? `${item.sourceType} card`,
        x: item.positionX,
        y: item.positionY,
      })),
      // The File Attachment owner has no Wall relation yet, and a live Smart
      // Collection block needs its query result; the seam takes both from this
      // port as soon as the owners expose them (tested with fixtures).
      files: [],
      focusOrder: steps
        .filter((step) => step.wallId === wall.id)
        .map((step) => step.itemId),
      groups: groups
        .filter((group) => group.wallId === wall.id)
        .map((group) => ({ id: group.id, title: group.title })),
      lines: links
        .filter((link) => link.wallId === wall.id)
        .map((link) => ({
          fromCardId: link.fromItemId,
          id: link.id,
          label: link.label,
          toCardId: link.toItemId,
        })),
      liveBlocks: [],
      narrative: null,
    };
    return {
      date: null,
      fields: [],
      kind: "Project Wall",
      recordId: wall.id,
      title: wall.title,
      wall: source,
    };
  });
}

/** Read-only candidates for the public Proje view; nothing here is public until approved. */
export async function projectMembersOf(
  database: Database,
  projectId: string,
): Promise<BuildInPublicSourceMember[]> {
  const [documents, decisions, releases, walls] = await Promise.all([
    database
      .select()
      .from(document)
      .where(
        and(eq(document.projectId, projectId), isNull(document.archivedAt)),
      )
      .orderBy(asc(document.title)),
    database
      .select()
      .from(decision)
      .where(and(eq(decision.projectId, projectId), eq(decision.life, "Valid")))
      .orderBy(asc(decision.title)),
    database
      .select()
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.projectId, projectId),
          eq(projectRelease.status, "Published"),
        ),
      )
      .orderBy(asc(projectRelease.name)),
    wallsOf(database, projectId),
  ]);
  return [
    ...documents.map(
      (row): BuildInPublicSourceMember => ({
        date: null,
        fields: [{ name: "Body", value: text(row.body) }],
        kind: "Document",
        recordId: row.id,
        title: row.title,
        wall: null,
      }),
    ),
    ...decisions.map(
      (row): BuildInPublicSourceMember => ({
        date: day(row.createdAt),
        fields: [
          { name: "Decision", value: text(row.decision) },
          ...(row.rationale
            ? [{ name: "Rationale", value: text(row.rationale) }]
            : []),
        ],
        kind: "Decision",
        recordId: row.id,
        title: row.title,
        wall: null,
      }),
    ),
    ...releases.map(
      (row): BuildInPublicSourceMember => ({
        date: day(row.updatedAt),
        fields: [
          ...(row.versionLabel
            ? [{ name: "Version", value: row.versionLabel }]
            : []),
          ...(row.description
            ? [{ name: "Summary", value: text(row.description) }]
            : []),
        ],
        kind: "Project Release",
        recordId: row.id,
        title: row.name,
        wall: null,
      }),
    ),
    ...walls,
  ];
}
