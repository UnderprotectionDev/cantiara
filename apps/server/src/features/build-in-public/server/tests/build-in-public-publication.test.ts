// biome-ignore-all lint/performance/useTopLevelRegex: assertions read clearer with inline patterns.

import {
  BUILD_IN_PUBLIC_INDEXING_WARNING,
  buildInPublicSlugSchema,
  defaultBuildInPublicSlug,
} from "@cantiara/api/build-in-public-publication";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  approveItems,
  createFixtures,
  createPublicSite,
  PROJECT_ID,
} from "./build-in-public-fixtures";

async function published(title = "My Project") {
  const fixtures = createFixtures();
  await approveItems(fixtures, { metadata: { title } });
  const site = createPublicSite(fixtures);
  return { fixtures, site };
}

describe("Build in Public slug", () => {
  test("starts readable from the publication title and never from an internal name", async () => {
    const { fixtures } = await published("My Project!");
    expect(fixtures.surfaces[0]?.slugs.canonical).toBe("my-project");
    expect(defaultBuildInPublicSlug(null)).toBe("build-in-public");
    expect(defaultBuildInPublicSlug("Roadmap")).toBe("roadmap-page");
  });

  test("rejects reserved and malformed slugs", () => {
    for (const bad of [
      "roadmap",
      "changelog",
      "assets",
      "Bad Slug",
      "a--b",
      "",
    ]) {
      expect(buildInPublicSlugSchema.safeParse(bad).success).toBe(false);
    }
    expect(buildInPublicSlugSchema.safeParse("launch-2026").success).toBe(true);
  });

  test("is unique in the Workspace", async () => {
    const { fixtures } = await published();
    // Another surface of the same Workspace already holds this slug.
    fixtures.surfaces.push({
      cancelled: false,
      id: "surface-other",
      indexingEnabled: false,
      revisions: [],
      slugs: { aliases: [], canonical: "taken" },
    });

    const preview = await fixtures.access.previewSlug(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      slug: "taken",
    });
    expect(preview?.available).toBe(false);
    await expect(
      fixtures.access.setSlug(ACCOUNT_ID, {
        confirmRedirect: true,
        projectId: PROJECT_ID,
        slug: "taken",
      }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_SLUG_TAKEN" });
  });

  test("previews the redirect before applying it, and applies it only once confirmed", async () => {
    const { fixtures, site } = await published();

    const preview = await fixtures.access.previewSlug(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      slug: "new-name",
    });
    expect(preview).toEqual({
      available: true,
      redirect: {
        from: "/b/surface-1/my-project",
        to: "/b/surface-1/new-name",
      },
      slug: "new-name",
    });
    // Previewing changed nothing.
    expect(fixtures.surfaces[0]?.slugs.canonical).toBe("my-project");

    await expect(
      fixtures.access.setSlug(ACCOUNT_ID, {
        confirmRedirect: false,
        projectId: PROJECT_ID,
        slug: "new-name",
      }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED" });

    const changed = await fixtures.access.setSlug(ACCOUNT_ID, {
      confirmRedirect: true,
      projectId: PROJECT_ID,
      slug: "new-name",
    });
    expect(changed?.path).toBe("/b/surface-1/new-name");
    expect(changed?.aliases).toEqual(["my-project"]);

    const redirect = await site.get("/surface-1/my-project/roadmap?page=2");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("location")).toBe(
      "/b/surface-1/new-name/roadmap?page=2",
    );
    expect((await site.get("/surface-1/never-existed")).status).toBe(404);
    expect((await site.get("/surface-1/new-name")).status).toBe(200);
  });

  test("an alias redirect is never cached and a warm canonical cache cannot outlive unpublish", async () => {
    const { fixtures, site } = await published();
    expect((await site.get("/surface-1/my-project")).status).toBe(200);
    await fixtures.access.setSlug(ACCOUNT_ID, {
      confirmRedirect: true,
      projectId: PROJECT_ID,
      slug: "new-name",
    });
    expect((await site.get("/surface-1/new-name")).status).toBe(200);
    const redirect = await site.get("/surface-1/my-project");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("cache-control")).toBe("no-store");
    expect(await redirect.text()).toBe("");

    await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);
    const dead = await Promise.all([
      site.get("/surface-1/my-project"),
      site.get("/surface-1/new-name"),
    ]);
    for (const response of dead) {
      expect(response.status).toBe(410);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  test("the redirect dies on unpublish and points at no content", async () => {
    const { fixtures, site } = await published();
    await fixtures.access.setSlug(ACCOUNT_ID, {
      confirmRedirect: true,
      projectId: PROJECT_ID,
      slug: "new-name",
    });
    expect((await site.get("/surface-1/my-project")).status).toBe(308);

    await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);

    const dead = await site.get("/surface-1/my-project");
    expect(dead.status).toBe(410);
    expect(dead.headers.get("location")).toBeNull();
    expect(fixtures.surfaces[0]?.slugs).toEqual({
      aliases: [],
      canonical: null,
    });
  });
});

describe("Build in Public indexing", () => {
  test("is off by default, and metadata alone does not turn it on", async () => {
    const { fixtures, site } = await published();
    const publication = await fixtures.access.publication(
      ACCOUNT_ID,
      PROJECT_ID,
    );
    expect(publication?.indexingEnabled).toBe(false);

    const response = await site.get("/surface-1/my-project");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.text()).toContain('name="robots"');
  });

  test("needs an explicit action and the third-party copy warning", async () => {
    const { fixtures, site } = await published();
    const publication = await fixtures.access.publication(
      ACCOUNT_ID,
      PROJECT_ID,
    );
    expect(publication?.indexingWarning).toBe(BUILD_IN_PUBLIC_INDEXING_WARNING);

    await expect(
      fixtures.access.setIndexing(ACCOUNT_ID, {
        acknowledgeThirdPartyCopies: false,
        enabled: true,
        projectId: PROJECT_ID,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_IN_PUBLIC_INDEXING_UNACKNOWLEDGED",
    });

    const enabled = await fixtures.access.setIndexing(ACCOUNT_ID, {
      acknowledgeThirdPartyCopies: true,
      enabled: true,
      projectId: PROJECT_ID,
    });
    expect(enabled?.indexingEnabled).toBe(true);
    const response = await site.get("/surface-1/my-project");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(await response.text()).not.toContain('name="robots"');

    // Turning it off needs no acknowledgement and restores noindex.
    await fixtures.access.setIndexing(ACCOUNT_ID, {
      acknowledgeThirdPartyCopies: false,
      enabled: false,
      projectId: PROJECT_ID,
    });
    expect(
      (await site.get("/surface-1/my-project")).headers.get("x-robots-tag"),
    ).toBe("noindex, nofollow");
  });

  test("unpublish is terminal for management too", async () => {
    const { fixtures } = await published();
    await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);
    await expect(
      fixtures.access.setIndexing(ACCOUNT_ID, {
        acknowledgeThirdPartyCopies: true,
        enabled: true,
        projectId: PROJECT_ID,
      }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_NOT_PUBLISHED" });
    await expect(
      fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_NOT_PUBLISHED" });
  });

  test("another account cannot read or change a Project it does not own", async () => {
    const { fixtures } = await published();
    expect(
      await fixtures.access.publication("account-2", PROJECT_ID),
    ).toBeNull();
    expect(await fixtures.access.unpublish("account-2", PROJECT_ID)).toBeNull();
  });
});
