import { describe, expect, test } from "vitest";
import {
  projectReleaseCreateFormSchema,
  projectReleaseHypothesisFormSchema,
  projectReleaseLinkFormSchema,
  projectReleasesHref,
} from "../project-release-planning-form";

describe("Project Release Planning form schemas", () => {
  test("create needs only a Name; a date is not accepted", () => {
    expect(
      projectReleaseCreateFormSchema.safeParse({
        description: "",
        name: "  ",
        versionLabel: "",
      }).success,
    ).toBe(false);
    expect(
      projectReleaseCreateFormSchema.parse({
        description: "",
        name: "tidekit 1.1",
        versionLabel: " v1.1.0 ",
      }),
    ).toEqual({
      description: null,
      name: "tidekit 1.1",
      versionLabel: "v1.1.0",
    });
    expect(
      projectReleaseCreateFormSchema.safeParse({
        description: "",
        name: "tidekit 1.1",
        targetDate: "2026-11-01",
        versionLabel: "",
      }).success,
    ).toBe(false);
  });

  test("an empty hypothesis is valid and every field stays separate", () => {
    expect(
      projectReleaseHypothesisFormSchema.parse({
        accessEvidence: "",
        audience: "",
        intendedOutcome: "Founders return",
        outcomeEvidence: "",
        primaryAccessPath: "",
      }),
    ).toEqual({
      accessEvidence: null,
      audience: null,
      intendedOutcome: "Founders return",
      outcomeEvidence: null,
      primaryAccessPath: null,
    });
  });

  test("references need a Project repository for Tag and Release, and a URL for an environment", () => {
    const base = { label: "v1.1.0", repositoryLinkId: "", url: "" };
    expect(
      projectReleaseLinkFormSchema.safeParse({ ...base, kind: "Tag" }).success,
    ).toBe(false);
    expect(
      projectReleaseLinkFormSchema.safeParse({
        ...base,
        kind: "Environment link",
      }).success,
    ).toBe(false);
    expect(
      projectReleaseLinkFormSchema.parse({
        ...base,
        kind: "Environment link",
        label: "Production",
        url: "https://tidekit.example",
      }),
    ).toMatchObject({ repositoryLinkId: null, url: "https://tidekit.example" });
  });

  test("links to the Releases area and to one release's Planning detail", () => {
    expect(projectReleasesHref("project 1")).toBe(
      "/projects/project%201#project-area-releases",
    );
    expect(projectReleasesHref("project-1", "release/1")).toBe(
      "/projects/project-1#source-project-release-release%2F1",
    );
  });
});
