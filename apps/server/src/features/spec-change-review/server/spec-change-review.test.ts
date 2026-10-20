import { describe, expect, test } from "vitest";

import {
  SpecChangeReviewNotFoundError,
  SpecChangeReviewProjectNotFoundError,
} from "./spec-change-review";
import { createMemorySpecChangeReview } from "./spec-change-review-memory-store";

const accountId = "account-1";
const projectId = "project-1";

const specV1 = [
  "Intro line.",
  "",
  "## Goals {#goals}",
  "Ship the queue.",
  "",
  "## Scope {#scope}",
  "Only Primary spec.",
  "Second scope line.",
  "",
].join("\n");

function setup() {
  const harness = createMemorySpecChangeReview(accountId);
  harness.addDocument({
    id: "spec-1",
    projectId,
    versions: [{ body: specV1, title: "Queue spec", type: "Spec" }],
  });
  harness.addDocument({
    id: "notes-1",
    projectId,
    versions: [{ body: "Notes", title: "Notes", type: "General" }],
  });
  harness.addWork({
    id: "feature-1",
    key: "CAN-1",
    primarySpecId: "spec-1",
    projectId,
    title: "Queue",
    type: "Feature",
  });
  return harness;
}

describe("Spec Change Review: exact Document version pair", () => {
  test("a saved Primary spec version opens a review of exactly that pair", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", {
      body: specV1.replace("Ship the queue.", "Ship the exact queue."),
    });

    const queue = await harness.access.list(accountId, projectId);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      documentId: "spec-1",
      featureId: "feature-1",
      nextRevision: 2,
      previousRevision: 1,
    });
  });

  test("the diff is version-backed and scoped to the changed section", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", {
      body: specV1.replace("Ship the queue.", "Ship the exact queue."),
    });
    const [review] = await harness.access.list(accountId, projectId);

    const detail = await harness.access.get(accountId, {
      reviewId: review?.id ?? "",
    });

    expect(detail.previous.revision).toBe(1);
    expect(detail.next.revision).toBe(2);
    expect(detail.diff.sections).toHaveLength(1);
    const [section] = detail.diff.sections;
    expect(section).toMatchObject({
      change: "Changed",
      heading: "Goals",
      sectionId: "goals",
    });
    expect(section?.lines.filter(({ kind }) => kind !== "unchanged")).toEqual([
      { kind: "removed", text: "Ship the queue." },
      { kind: "added", text: "Ship the exact queue." },
    ]);
  });

  test("added, removed and renamed sections and the introduction are reported", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", {
      body: [
        "New intro.",
        "",
        "## Aims {#goals}",
        "Ship the queue.",
        "",
        "## Risks {#risks}",
        "Too much.",
        "",
      ].join("\n"),
      title: "Queue spec v2",
    });
    const [review] = await harness.access.list(accountId, projectId);
    const { diff } = await harness.access.get(accountId, {
      reviewId: review?.id ?? "",
    });

    expect(
      diff.sections.map(({ change, heading, previousHeading, sectionId }) => ({
        change,
        heading,
        previousHeading,
        sectionId,
      })),
    ).toEqual([
      {
        change: "Changed",
        heading: "",
        previousHeading: null,
        sectionId: null,
      },
      {
        change: "Changed",
        heading: "Aims",
        previousHeading: "Goals",
        sectionId: "goals",
      },
      {
        change: "Added",
        heading: "Risks",
        previousHeading: null,
        sectionId: "risks",
      },
      {
        change: "Removed",
        heading: "Scope",
        previousHeading: null,
        sectionId: "scope",
      },
    ]);
    expect(diff.titleChange).toEqual({
      next: "Queue spec v2",
      previous: "Queue spec",
    });
  });

  test("a parent section does not absorb a change inside its child section", async () => {
    const harness = createMemorySpecChangeReview(accountId);
    const body = [
      "## Parent {#parent}",
      "P",
      "",
      "### Child {#child}",
      "C",
      "",
    ].join("\n");
    harness.addDocument({
      id: "spec-1",
      projectId,
      versions: [{ body, title: "Spec", type: "Spec" }],
    });
    harness.addWork({
      id: "f",
      key: "CAN-2",
      primarySpecId: "spec-1",
      projectId,
      title: "F",
      type: "Feature",
    });
    harness.saveVersion("spec-1", { body: body.replace("C\n", "C2\n") });
    const [review] = await harness.access.list(accountId, projectId);
    const { diff } = await harness.access.get(accountId, {
      reviewId: review?.id ?? "",
    });

    expect(diff.sections.map(({ sectionId }) => sectionId)).toEqual(["child"]);
  });

  test("unchanged long runs collapse to an omitted marker with context", async () => {
    const harness = createMemorySpecChangeReview(accountId);
    const lines = Array.from({ length: 20 }, (_, index) => `line ${index}`);
    const body = ["## Long {#long}", ...lines, ""].join("\n");
    harness.addDocument({
      id: "spec-1",
      projectId,
      versions: [{ body, title: "Spec", type: "Spec" }],
    });
    harness.addWork({
      id: "f",
      key: "CAN-2",
      primarySpecId: "spec-1",
      projectId,
      title: "F",
      type: "Feature",
    });
    harness.saveVersion("spec-1", { body: body.replace("line 10", "LINE 10") });
    const [review] = await harness.access.list(accountId, projectId);
    const { diff } = await harness.access.get(accountId, {
      reviewId: review?.id ?? "",
    });

    const kinds = diff.sections[0]?.lines.map(({ kind }) => kind);
    expect(kinds).toEqual([
      "omitted",
      "unchanged",
      "unchanged",
      "removed",
      "added",
      "unchanged",
      "unchanged",
      "omitted",
    ]);
  });
});

describe("Spec Change Review: what opens the queue", () => {
  test("saving a version of another Document opens nothing", async () => {
    const harness = setup();
    harness.saveVersion("notes-1", { body: "Changed notes" });

    expect(await harness.access.list(accountId, projectId)).toEqual([]);
  });

  test("a Feature without a Primary spec creates no queue", async () => {
    const harness = createMemorySpecChangeReview(accountId);
    harness.addDocument({
      id: "spec-1",
      projectId,
      versions: [{ body: "A", title: "Spec", type: "Spec" }],
    });
    harness.addWork({
      id: "feature-1",
      key: "CAN-1",
      primarySpecId: null,
      projectId,
      title: "Queue",
      type: "Feature",
    });
    harness.saveVersion("spec-1", { body: "B" });

    expect(await harness.access.list(accountId, projectId)).toEqual([]);
  });

  test("only a Feature opens a review, never another Work type or a trashed Feature", async () => {
    const harness = createMemorySpecChangeReview(accountId);
    harness.addDocument({
      id: "spec-1",
      projectId,
      versions: [{ body: "A", title: "Spec", type: "Spec" }],
    });
    harness.addWork({
      id: "task-1",
      key: "CAN-1",
      primarySpecId: "spec-1",
      projectId,
      title: "Task",
      type: "Task",
    });
    harness.addWork({
      id: "feature-trashed",
      key: "CAN-2",
      primarySpecId: "spec-1",
      projectId,
      title: "Gone",
      trashedAt: "2026-10-01T09:00:00.000Z",
      type: "Feature",
    });
    harness.saveVersion("spec-1", { body: "B" });

    expect(await harness.access.list(accountId, projectId)).toEqual([]);
  });

  test("a new version keeps earlier open reviews, each with its own pair", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", { body: "Second" });
    harness.saveVersion("spec-1", { body: "Third" });

    const queue = await harness.access.list(accountId, projectId);
    expect(
      queue.map(({ previousRevision, nextRevision }) => [
        previousRevision,
        nextRevision,
      ]),
    ).toEqual([
      [2, 3],
      [1, 2],
    ]);
    const older = queue.find(({ nextRevision }) => nextRevision === 2);
    const detail = await harness.access.get(accountId, {
      reviewId: older?.id ?? "",
    });
    expect(detail.previous.revision).toBe(1);
    expect(detail.next.revision).toBe(2);
  });

  test("the review record is the version pair, not a copy of the spec body", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", { body: "Second" });

    const [review] = await harness.access.list(accountId, projectId);
    expect(Object.keys(review ?? {}).sort()).toEqual([
      "createdAt",
      "documentId",
      "documentTitle",
      "featureId",
      "featureKey",
      "featureTitle",
      "id",
      "nextRevision",
      "previousRevision",
      "projectId",
      "projectName",
    ]);
  });

  test("another account sees neither the queue nor a review", async () => {
    const harness = setup();
    harness.saveVersion("spec-1", { body: "Second" });
    const [review] = await harness.access.list(accountId, projectId);

    await expect(
      harness.access.list("account-2", projectId),
    ).rejects.toBeInstanceOf(SpecChangeReviewProjectNotFoundError);
    await expect(
      harness.access.get("account-2", { reviewId: review?.id ?? "" }),
    ).rejects.toBeInstanceOf(SpecChangeReviewNotFoundError);
  });
});
