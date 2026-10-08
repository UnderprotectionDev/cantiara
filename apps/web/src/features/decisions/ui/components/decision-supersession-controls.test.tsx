import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DecisionSupersessionPreviewView } from "./decision-supersession-view";

const cancel = () => undefined;
const confirm = () => Promise.resolve();
test("Decisions preview shows both rationale and evidence, changed lives and explicit confirmation", () => {
  const record = {
    id: "old",
    projectId: "project",
    sourceType: "Decision" as const,
    title: "Original scope",
    decision: "Small release",
    rationale: "Old constraints",
    life: "Valid" as const,
    createdAt: "2026-10-08T10:00:00.000Z",
    updatedAt: "2026-10-08T10:00:00.000Z",
    revision: 1,
  };
  const html = renderToStaticMarkup(
    <DecisionSupersessionPreviewView
      onCancel={cancel}
      onConfirm={confirm}
      pending={false}
      preview={{
        graph: {
          records: [
            record,
            {
              ...record,
              id: "new",
              title: "New scope",
              rationale: "New constraints",
            },
          ],
          relations: [],
          evidence: [
            {
              id: "evidence",
              revision: 1,
              decisionId: "old",
              title: "Customer evidence",
              excerpt: "Needs a smaller release",
            },
          ],
          revision: 0,
          readOnly: false,
        },
        changes: [{ id: "old", before: "Valid", after: "Superseded" }],
        command: {
          projectId: "project",
          predecessorIds: ["old"],
          successorId: "new",
          operation: "supersede",
          rationale: "Constraints changed",
          baseRevision: 0,
          previewFingerprint: "fingerprint",
        },
      }}
    />,
  );
  expect(html).toContain("Original scope");
  expect(html).toContain("New scope");
  expect(html).toContain("Old constraints");
  expect(html).toContain("New constraints");
  expect(html).toContain("Customer evidence");
  expect(html).toContain("Valid → Superseded");
  expect(html).toContain("Constraints changed");
  expect(html).toContain("Confirm supersession");
});
