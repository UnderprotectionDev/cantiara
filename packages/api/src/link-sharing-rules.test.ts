import { describe, expect, test } from "vitest";

import { LIVE_ALLOW_LIST_FIELD_KINDS, SHARE_FIELD_KINDS } from "./link-sharing";
import {
  findPlaceholders,
  isLiveEligible,
  isSecretKind,
  shareLabel,
} from "./link-sharing-rules";

describe("Link Sharing live allow-list", () => {
  test("is exactly the PRD's closed structured fields", () => {
    expect([...LIVE_ALLOW_LIST_FIELD_KINDS].sort()).toEqual(
      [
        "closure-result",
        "due-date",
        "milestone-status",
        "planned-start",
        "priority",
        "reappear-date",
        "release-status",
        "roadmap-horizon",
        "status",
        "summary",
      ].sort(),
    );
  });

  test("keeps free text, links, files, people, secrets and custom fields frozen", () => {
    for (const kind of [
      "title",
      "description",
      "markdown",
      "comment",
      "relation-rationale",
      "contact",
      "company",
      "url",
      "custom-field",
      "classification",
      "secret",
      "share-token",
      "link-password",
    ] as const) {
      expect(isLiveEligible(kind)).toBe(false);
    }
    expect(SHARE_FIELD_KINDS.filter(isSecretKind)).toEqual([
      "secret",
      "share-token",
      "link-password",
    ]);
  });
});

describe("shareLabel", () => {
  test("never says Current", () => {
    expect(shareLabel(0, 4)).toBe("Approved snapshot");
    expect(shareLabel(1, 3)).toBe("Some fields live");
    expect(shareLabel(2, 0)).toBe("Live");
  });
});

describe("findPlaceholders", () => {
  test("finds recognised placeholders with their text context", () => {
    const [match] = findPlaceholders("Hello {{alan_adı}}, welcome.");
    expect(match).toEqual({
      context: "Hello {{alan_adı}}, welcome.",
      placeholder: "{{alan_adı}}",
    });
  });

  test("ignores fenced code, tilde fences, unclosed fences and inline code", () => {
    expect(findPlaceholders("```\n{{a}}\n```")).toEqual([]);
    expect(findPlaceholders("~~~js\n{{a}}\n~~~")).toEqual([]);
    expect(findPlaceholders("```\n{{a}}")).toEqual([]);
    expect(findPlaceholders("Use `{{a}}` and ``{{b}}``")).toEqual([]);
    expect(
      findPlaceholders("after fence\n```\n{{a}}\n```\n{{b}}"),
    ).toHaveLength(1);
  });

  test("only the closed syntax counts: no prose guesses, no other braces", () => {
    for (const text of [
      "TBD, fill in later",
      "{single}",
      "{{ spaced }}",
      "{{Upper}}",
      "{{1digit}}",
      "{{two words}}",
    ]) {
      expect(findPlaceholders(text)).toEqual([]);
    }
    expect(findPlaceholders("{{a1_b2}}")).toHaveLength(1);
  });
});
