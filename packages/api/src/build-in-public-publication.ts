import { z } from "zod";

import type {
  BuildInPublicMetadata,
  BuildInPublicSnapshot,
  BuildInPublicSnapshotMember,
  BuildInPublicSnapshotWork,
  BuildInPublicSurfaceCopy,
} from "./build-in-public";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { defaultWikiSlug } from "./wiki-publishing";

const identifierSchema = z.string().trim().min(1).max(255);

/** Public routes under `/b/:surfaceId/:slug`; these words are not slugs. */
export const BUILD_IN_PUBLIC_RESERVED_SLUGS = [
  "assets",
  "changelog",
  "roadmap",
] as const;

export const buildInPublicSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use lowercase letters, digits and -.")
  .refine(
    (slug) =>
      !(BUILD_IN_PUBLIC_RESERVED_SLUGS as readonly string[]).includes(slug),
    { message: "This word is reserved for a page of the surface." },
  );

export const BUILD_IN_PUBLIC_INDEXING_WARNING =
  "Search engines and other third parties may keep copies of this page. Those copies cannot be fully recalled, even if you unpublish or disable indexing later.";

/** Readable default slug from the publication title; never from an internal name. */
export function defaultBuildInPublicSlug(title: string | null | undefined) {
  const slug = defaultWikiSlug(title?.trim() || "build-in-public");
  return (BUILD_IN_PUBLIC_RESERVED_SLUGS as readonly string[]).includes(slug)
    ? `${slug}-page`
    : slug;
}

export type BuildInPublicView = "changelog" | "project" | "roadmap";

/** Canonical public path of one view; the surface id is random and never reused. */
export function buildInPublicPath(
  surfaceId: string,
  slug: string,
  view: BuildInPublicView = "project",
) {
  const base = `/b/${surfaceId}/${slug}`;
  return view === "project" ? base : `${base}/${view}`;
}

/* -------------------------------------------------------------------------- */
/* Publication management                                                      */
/* -------------------------------------------------------------------------- */

export interface BuildInPublicPublication {
  /** Earlier slugs that redirect to the canonical path while the surface is public. */
  aliases: string[];
  changelogPath: string | null;
  indexingEnabled: boolean;
  indexingWarning: string;
  path: string | null;
  projectId: string;
  published: boolean;
  revision: number | null;
  roadmapPath: string | null;
  slug: string | null;
  surfaceId: string | null;
  /** A source changed after the last approval and waits for a new one. */
  unpublishedChanges: boolean;
}

export interface BuildInPublicSlugPreview {
  available: boolean;
  /** Shown before the change is applied; null when nothing redirects. */
  redirect: { from: string; to: string } | null;
  slug: string;
}

export const buildInPublicSlugPreviewInputSchema = z
  .object({ projectId: identifierSchema, slug: buildInPublicSlugSchema })
  .strict();

export const setBuildInPublicSlugInputSchema = humanMutationEnvelopeSchema
  .extend({
    /** Separate confirmation that the old address will redirect. */
    confirmRedirect: z.boolean(),
    projectId: identifierSchema,
    slug: buildInPublicSlugSchema,
  })
  .strict();

export const setBuildInPublicIndexingInputSchema = humanMutationEnvelopeSchema
  .extend({
    acknowledgeThirdPartyCopies: z.boolean(),
    enabled: z.boolean(),
    projectId: identifierSchema,
  })
  .strict();

export const unpublishBuildInPublicInputSchema = humanMutationEnvelopeSchema
  .extend({ projectId: identifierSchema })
  .strict();

export interface BuildInPublicPublicationAccess {
  previewSlug: (
    accountId: string,
    input: { projectId: string; slug: string },
  ) => Promise<BuildInPublicSlugPreview | null>;
  publication: (
    accountId: string,
    projectId: string,
  ) => Promise<BuildInPublicPublication | null>;
  setIndexing: (
    accountId: string,
    input: {
      acknowledgeThirdPartyCopies: boolean;
      enabled: boolean;
      projectId: string;
    },
  ) => Promise<BuildInPublicPublication | null>;
  setSlug: (
    accountId: string,
    input: { confirmRedirect: boolean; projectId: string; slug: string },
  ) => Promise<BuildInPublicPublication | null>;
  /** Terminal: the URL answers an empty `410 Gone`; a later publish gets a new URL. */
  unpublish: (
    accountId: string,
    projectId: string,
  ) => Promise<BuildInPublicPublication | null>;
}

/* -------------------------------------------------------------------------- */
/* One revision, three views                                                   */
/* -------------------------------------------------------------------------- */

export interface BuildInPublicChangelogEntry {
  date: string;
  kind: BuildInPublicSnapshotMember["kind"];
  memberId: string;
  summary: string | null;
  title: string;
}

export interface BuildInPublicViews {
  approvedAt: string;
  changelog: {
    copy: BuildInPublicSurfaceCopy;
    entries: BuildInPublicChangelogEntry[];
  };
  project: {
    copy: BuildInPublicSurfaceCopy;
    /** Set only while the founder's window is open. */
    featured: BuildInPublicSnapshotMember | null;
    /** Chronological, without the featured record. */
    members: BuildInPublicSnapshotMember[];
  };
  roadmap: {
    copy: BuildInPublicSurfaceCopy;
    horizons: { horizon: string; works: BuildInPublicSnapshotWork[] }[];
  };
}

const HORIZON_ORDER = ["Now", "Next", "Later"];
const CHANGELOG_KINDS = new Set(["Decision", "Project Release"]);

function copyOf(
  stored: BuildInPublicSurfaceCopy | undefined,
  fallbackTitle: string,
): BuildInPublicSurfaceCopy {
  // Nothing inherits across surfaces: a missing copy falls back to a fixed name, never to a sibling.
  return {
    summary: stored?.summary ?? null,
    title: stored?.title ?? fallbackTitle,
  };
}

function dateOf(member: BuildInPublicSnapshotMember, approvedAt: string) {
  return member.date ?? approvedAt.slice(0, 10);
}

/**
 * Roadmap, changelog and Proje view are projections of the same snapshot
 * object, so they cannot show different revisions. No input but the snapshot
 * (and the clock for the featured window) is read.
 */
export function buildInPublicViews(
  snapshot: BuildInPublicSnapshot,
  now: Date,
): BuildInPublicViews {
  const members = snapshot.members ?? [];
  const metadata: BuildInPublicMetadata = snapshot.metadata;
  const window = snapshot.featured;
  const featured =
    window && new Date(window.endsAt).getTime() > now.getTime()
      ? (members.find(
          (member) =>
            member.memberId === window.memberId &&
            CHANGELOG_KINDS.has(member.kind),
        ) ?? null)
      : null;
  const chronological = [...members].sort((a, b) =>
    dateOf(b, snapshot.approvedAt).localeCompare(
      dateOf(a, snapshot.approvedAt),
    ),
  );

  const horizons = new Map<string, BuildInPublicSnapshotWork[]>();
  for (const work of snapshot.roadmap) {
    horizons.set(work.horizon, [...(horizons.get(work.horizon) ?? []), work]);
  }

  return {
    approvedAt: snapshot.approvedAt,
    changelog: {
      copy: copyOf(metadata.changelogIndex, "Changelog"),
      entries: chronological
        .filter((member) => CHANGELOG_KINDS.has(member.kind))
        .map((member) => ({
          date: dateOf(member, snapshot.approvedAt),
          kind: member.kind,
          memberId: member.memberId,
          summary:
            member.fields.find((field) => field.name === "Summary")?.value ??
            null,
          title: member.title,
        })),
    },
    project: {
      copy: copyOf(metadata, "Build in Public"),
      featured,
      members: chronological.filter((member) => member !== featured),
    },
    roadmap: {
      copy: copyOf(metadata.roadmapIndex, "Roadmap"),
      horizons: [...horizons.entries()]
        .sort(
          ([a], [b]) =>
            (HORIZON_ORDER.indexOf(a) + 1 || 99) -
            (HORIZON_ORDER.indexOf(b) + 1 || 99),
        )
        .map(([horizon, works]) => ({ horizon, works })),
    },
  };
}
