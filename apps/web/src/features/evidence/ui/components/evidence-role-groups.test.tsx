import type { DocumentEvidenceForTarget } from "@cantiara/api/document-evidence";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import EvidenceRoleGroups from "./evidence-role-groups";

function item(
  id: string,
  role: DocumentEvidenceForTarget["role"],
  interpretation: string | null = null,
): DocumentEvidenceForTarget {
  return {
    id,
    role,
    interpretation,
    pin: role
      ? {
          source: {
            recordType: "Document",
            recordId: "doc",
            projectId: "project",
            revision: 1,
            componentId: null,
          },
          start: 0,
          end: 5,
          excerpt: "local",
          before: "",
          after: "",
        }
      : null,
    source: {
      documentId: "doc",
      projectId: role ? "project" : null,
      title: role ? "Interview notes" : null,
      brokenReason: role ? null : "No access",
      canOpenSourceRecord: Boolean(role),
    },
    newerVersionExists: false,
    createdAt: "2026-10-17T09:00:00.000Z",
  };
}

test("groups the role matrix with exact counts, keeps interpretation separate and withholds inaccessible roles", () => {
  const html = renderToStaticMarkup(
    <EvidenceRoleGroups
      items={[
        item("a", "Supporting"),
        item("b", "Supporting"),
        item("c", "Contradicting", "Pricing page disagrees"),
        item("d", "Provides context"),
        item("e", "Inconclusive"),
        item("f", "Unspecified"),
        item("g", null),
      ]}
    />,
  );
  expect(html).toContain("Supporting (2)");
  expect(html).toContain("Contradicting (1)");
  expect(html).toContain("Provides context (1)");
  expect(html).toContain("Inconclusive (1)");
  expect(html).toContain("Unspecified (1)");
  expect(html).toContain("Founder interpretation: Pricing page disagrees");
  expect(html).toContain("1 unavailable (role withheld)");
  for (const word of ["score", "majority", "recommend"]) {
    expect(html.toLowerCase()).not.toContain(word);
  }
});

test("keeps an archived source visible as Archived inside its role group", () => {
  const archived = {
    ...item("h", "Supporting"),
    source: {
      documentId: "doc",
      projectId: "project",
      title: "Archived notes",
      brokenReason: "Archived" as const,
      canOpenSourceRecord: true,
    },
  };
  const html = renderToStaticMarkup(<EvidenceRoleGroups items={[archived]} />);
  expect(html).toContain("Supporting (1)");
  expect(html).toContain("Archived notes");
  expect(html).toContain("<p>Archived</p>");
});
