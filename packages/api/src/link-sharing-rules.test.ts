import { describe, expect, test } from "vitest";

import { LIVE_ALLOW_LIST_FIELD_KINDS, SHARE_FIELD_KINDS } from "./link-sharing";
import {
  findPlaceholders,
  isLiveEligible,
  isSecretKind,
  shareLabel,
  youtubeVideoId,
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

  test("a stray backtick in one paragraph never hides a placeholder in the next", () => {
    expect(
      findPlaceholders("It`s one.\n\nFill {{alan_adı}} here.\n\nAnother` end."),
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

describe("Link Sharing YouTube id", () => {
  test("accepts only a watch or short YouTube URL with an 11 character id", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    for (const url of [
      null,
      "",
      "not a url",
      "javascript:alert(1)",
      "https://evil.example/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      'https://www.youtube.com/watch?v="><script>',
    ]) {
      expect(youtubeVideoId(url)).toBeNull();
    }
  });
});
