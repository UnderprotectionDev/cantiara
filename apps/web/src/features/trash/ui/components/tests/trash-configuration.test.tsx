import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TrashConfigurationImpactList } from "../trash-configuration-impact";
import { TrashRestoreConflicts } from "../trash-restore-conflicts";

describe("Configuration Trash UI", () => {
  test("the delete preview lists affected stored values and dependents", () => {
    const html = renderToStaticMarkup(
      <TrashConfigurationImpactList
        impact={{
          dependents: [
            { id: "wt1", kind: "Work Template", label: "Bug intake" },
          ],
          storedValues: [
            { count: 12, label: "Custom field values on records" },
          ],
        }}
      />,
    );

    expect(html).toContain("Affected stored values");
    expect(html).toContain("Custom field values on records: 12");
    expect(html).toContain("Dependent views, rules and references");
    expect(html).toContain("Work Template: Bug intake");
  });

  test("says so when nothing depends on the definition", () => {
    const html = renderToStaticMarkup(
      <TrashConfigurationImpactList
        impact={{ dependents: [], storedValues: [] }}
      />,
    );

    expect(html).toContain("No stored values are affected.");
    expect(html).toContain("No view, rule or reference depends on it.");
  });

  test("the conflict preview is an alert that names each dependency and reason", () => {
    const html = renderToStaticMarkup(
      <TrashRestoreConflicts
        conflicts={[
          {
            dependencyId: "cf1",
            dependencyKind: "Custom Field",
            label: "Effort band",
            reason: "Permanently deleted",
          },
        ]}
        label="Bug intake"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Restore conflicts: Bug intake");
    expect(html).toContain("Custom Field Effort band: Permanently deleted");
    expect(html).toContain("Nothing was restored or rebound.");
  });
});
