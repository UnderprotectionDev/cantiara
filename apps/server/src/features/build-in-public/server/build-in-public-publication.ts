import {
  BuildInPublicError,
  type BuildInPublicPreview,
} from "@cantiara/api/build-in-public";
import {
  BUILD_IN_PUBLIC_INDEXING_WARNING,
  type BuildInPublicPublication,
  type BuildInPublicPublicationAccess,
  buildInPublicPath,
  defaultBuildInPublicSlug,
} from "@cantiara/api/build-in-public-publication";

import type { BuildInPublicLatest } from "./build-in-public";

export interface BuildInPublicSlugs {
  /** Earlier slugs that redirect to the canonical one while the surface is public. */
  aliases: string[];
  canonical: string | null;
}

export interface BuildInPublicPublicationStore {
  /**
   * Terminal. Sets `cancelledAt` so every URL of the surface answers `410 Gone`
   * from now on, and deletes the surface's slugs so no redirect outlives it.
   * False when a concurrent unpublish won.
   */
  cancel: (surfaceId: string) => Promise<boolean>;
  /**
   * Makes `slug` the canonical one and keeps the previous canonical slug as a
   * redirect. False when another surface of the Workspace already holds it.
   */
  changeSlug: (write: {
    slug: string;
    surfaceId: string;
    workspaceId: string;
  }) => Promise<boolean>;
  /** Explicit founder action only; publishing never writes this. False when the surface is cancelled. */
  setIndexing: (surfaceId: string, enabled: boolean) => Promise<boolean>;
  /** The surface that holds `slug` in the Workspace, or null. */
  slugOwner: (workspaceId: string, slug: string) => Promise<string | null>;
  slugs: (surfaceId: string) => Promise<BuildInPublicSlugs>;
}

export interface BuildInPublicPublicationOptions {
  facts: {
    project: (
      accountId: string,
      projectId: string,
    ) => Promise<{ workspaceId: string } | null>;
  };
  previewOf: (
    accountId: string,
    projectId: string,
  ) => Promise<BuildInPublicPreview | null>;
  store: BuildInPublicPublicationStore & {
    latest: (projectId: string) => Promise<BuildInPublicLatest | null>;
  };
}

const NO_SLUGS: BuildInPublicSlugs = { aliases: [], canonical: null };

function shape(
  projectId: string,
  surface: {
    indexingEnabled: boolean;
    revision: number;
    surfaceId: string;
  } | null,
  slugs: BuildInPublicSlugs,
  unpublishedChanges: boolean,
): BuildInPublicPublication {
  if (!surface) {
    return {
      aliases: [],
      changelogPath: null,
      indexingEnabled: false,
      indexingWarning: BUILD_IN_PUBLIC_INDEXING_WARNING,
      path: null,
      projectId,
      published: false,
      revision: null,
      roadmapPath: null,
      slug: null,
      surfaceId: null,
      unpublishedChanges: false,
    };
  }
  const slug = slugs.canonical ?? defaultBuildInPublicSlug(null);
  return {
    aliases: slugs.aliases,
    changelogPath: buildInPublicPath(surface.surfaceId, slug, "changelog"),
    indexingEnabled: surface.indexingEnabled,
    indexingWarning: BUILD_IN_PUBLIC_INDEXING_WARNING,
    path: buildInPublicPath(surface.surfaceId, slug),
    projectId,
    published: true,
    revision: surface.revision,
    roadmapPath: buildInPublicPath(surface.surfaceId, slug, "roadmap"),
    slug,
    surfaceId: surface.surfaceId,
    unpublishedChanges,
  };
}

export function createBuildInPublicPublication(
  options: BuildInPublicPublicationOptions,
) {
  const { facts, previewOf, store } = options;

  async function current(accountId: string, projectId: string) {
    const project = await facts.project(accountId, projectId);
    if (!project) {
      return null;
    }
    const latest = await store.latest(projectId);
    return { latest, workspaceId: project.workspaceId };
  }

  async function describe(
    accountId: string,
    projectId: string,
    latest: BuildInPublicLatest | null,
  ) {
    if (!latest) {
      return shape(projectId, null, NO_SLUGS, false);
    }
    const [slugs, preview] = await Promise.all([
      store.slugs(latest.surfaceId),
      previewOf(accountId, projectId),
    ]);
    return shape(
      projectId,
      latest,
      slugs,
      preview?.items.some((item) => item.change === "Unpublished changes") ??
        false,
    );
  }

  async function slugChange(
    accountId: string,
    input: { projectId: string; slug: string },
  ) {
    const found = await current(accountId, input.projectId);
    if (!found) {
      return null;
    }
    if (!found.latest) {
      throw new BuildInPublicError("BUILD_IN_PUBLIC_NOT_PUBLISHED");
    }
    const { surfaceId } = found.latest;
    const [slugs, owner] = await Promise.all([
      store.slugs(surfaceId),
      store.slugOwner(found.workspaceId, input.slug),
    ]);
    const from = slugs.canonical
      ? buildInPublicPath(surfaceId, slugs.canonical)
      : null;
    return {
      available: owner === null || owner === surfaceId,
      found,
      preview: {
        available: owner === null || owner === surfaceId,
        // Only the surface's own canonical path is ever a redirect target.
        redirect:
          from && slugs.canonical !== input.slug
            ? { from, to: buildInPublicPath(surfaceId, input.slug) }
            : null,
        slug: input.slug,
      },
    };
  }

  const access: BuildInPublicPublicationAccess = {
    previewSlug: async (accountId, input) =>
      (await slugChange(accountId, input))?.preview ?? null,

    publication: async (accountId, projectId) => {
      const found = await current(accountId, projectId);
      return found ? describe(accountId, projectId, found.latest) : null;
    },

    setIndexing: async (accountId, input) => {
      const found = await current(accountId, input.projectId);
      if (!found) {
        return null;
      }
      if (input.enabled && !input.acknowledgeThirdPartyCopies) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_INDEXING_UNACKNOWLEDGED");
      }
      if (
        !(
          found.latest &&
          (await store.setIndexing(found.latest.surfaceId, input.enabled))
        )
      ) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_NOT_PUBLISHED");
      }
      return describe(accountId, input.projectId, {
        ...found.latest,
        indexingEnabled: input.enabled,
      });
    },

    setSlug: async (accountId, input) => {
      const change = await slugChange(accountId, input);
      if (!change) {
        return null;
      }
      if (!change.available) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_SLUG_TAKEN");
      }
      if (change.preview.redirect && !input.confirmRedirect) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED");
      }
      const { latest, workspaceId } = change.found;
      if (
        !(
          latest &&
          (await store.changeSlug({
            slug: input.slug,
            surfaceId: latest.surfaceId,
            workspaceId,
          }))
        )
      ) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_SLUG_TAKEN");
      }
      return describe(accountId, input.projectId, latest);
    },

    unpublish: async (accountId, projectId) => {
      const found = await current(accountId, projectId);
      if (!found) {
        return null;
      }
      if (!(found.latest && (await store.cancel(found.latest.surfaceId)))) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_NOT_PUBLISHED");
      }
      return shape(projectId, null, NO_SLUGS, false);
    },
  };

  return {
    access,
    /** First-publish slug: readable from the publication title, unique in the Workspace. */
    firstSlug: async (workspaceId: string, title: string | null) => {
      const base = defaultBuildInPublicSlug(title);
      let candidate = base;
      let suffix = 2;
      // Sequential on purpose: each candidate is checked after the previous one.
      // biome-ignore lint/performance/noAwaitInLoops: the next candidate depends on the last answer.
      while (await store.slugOwner(workspaceId, candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
      return candidate;
    },
  };
}
