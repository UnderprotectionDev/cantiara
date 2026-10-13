import { describe, expect, it } from "vitest";

import {
  documentTemplateFields,
  documentTemplateSkeleton,
  personalReviewTemplate,
  renderDocumentTemplate,
} from "./document-templates";
import { createDocumentInputSchema } from "./documents";

describe("Documents — Document Templates", () => {
  it("offers the optional Personal Review golden headings in their contracted order", () => {
    expect(personalReviewTemplate.body).toBe(
      "## Period\n\n## What changed?\n\n## What worked?\n\n## What was difficult?\n\n## Decisions and learnings\n\n## What will I change next?\n\n## Related records\n",
    );
    expect(personalReviewTemplate.type).toBe("General");
  });

  it("asks only for explicit text placeholders outside fenced and inline code", () => {
    const body =
      "# {{period}}\n{{period}} {{next_step}} {{Bad}} {{2bad}}\n`{{inline}}`\n```md\n{{code}}\n```\n~~~\n{{other_code}}\n~~~\n";
    expect(documentTemplateFields(body)).toEqual(["period", "next_step"]);
    expect(
      renderDocumentTemplate(body, {
        period: "September",
        next_step: "$& {{period}}",
      }),
    ).toBe(
      "# September\nSeptember $& {{period}} {{Bad}} {{2bad}}\n`{{inline}}`\n```md\n{{code}}\n```\n~~~\n{{other_code}}\n~~~\n",
    );
  });

  it("requires placeholder values without inventing defaults or custom fields", () => {
    expect(() => renderDocumentTemplate("{{period}}", {})).toThrow("period");
    expect(renderDocumentTemplate("{{period}}", { period: "" })).toBe("");
  });

  it("preserves placeholders inside multiline Markdown code spans", () => {
    const body = "{{before}}\n`{{code}}\n{{still_code}}`\n{{after}}\n";
    expect(documentTemplateFields(body)).toEqual(["before", "after"]);
    expect(
      renderDocumentTemplate(body, { before: "Start", after: "End" }),
    ).toBe("Start\n`{{code}}\n{{still_code}}`\nEnd\n");
  });

  it("ignores placeholders in indented Markdown code blocks", () => {
    const body = "{{period}}\n\n    {{code}}\n\t{{tab_code}}\n";
    expect(documentTemplateFields(body)).toEqual(["period"]);
    expect(renderDocumentTemplate(body, { period: "September" })).toBe(
      "September\n\n    {{code}}\n\t{{tab_code}}\n",
    );
  });

  it("preserves placeholders inside blockquoted fenced code", () => {
    const body =
      "> ```md\n> {{literal}}\n> ```\n> ~~~md\n> {{tilde_literal}}\n> ~~~\n> - {{period}}\n";
    expect(documentTemplateFields(body)).toEqual(["period"]);
    expect(renderDocumentTemplate(body, { period: "September" })).toBe(
      "> ```md\n> {{literal}}\n> ```\n> ~~~md\n> {{tilde_literal}}\n> ~~~\n> - September\n",
    );
  });

  it("keeps readable skeleton text without carrying source relationships or live bindings", () => {
    const body =
      '## Related records\n[[record:Work:work-source|Launch]]\n:::live-work{workId="work-source"}\n\n`[[record:Work:work-source|Code sample]]`\n';
    expect(documentTemplateSkeleton(body)).toBe(
      "## Related records\nLaunch\n\n\n`[[record:Work:work-source|Code sample]]`\n",
    );
    expect(renderDocumentTemplate("{{note}}", { note: body })).toBe(
      documentTemplateSkeleton(body),
    );
  });

  it("creates a Document in Personal Wiki without a Project scope", () => {
    expect(
      createDocumentInputSchema.parse({
        projectId: null,
        title: "Review",
        type: "General",
        body: "",
      }),
    ).toMatchObject({ projectId: null });
  });
});
