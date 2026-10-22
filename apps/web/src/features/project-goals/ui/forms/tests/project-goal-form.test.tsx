import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProjectGoalEditor } from "../project-goal-form";

const onSave = async () => undefined;
const onCancel = () => undefined;

describe("Project Goal form", () => {
  test("provides labelled required fields and optional outcome fields", () => {
    const html = renderToStaticMarkup(
      <ProjectGoalEditor onCancel={onCancel} onSave={onSave} />,
    );
    expect(html).toContain('for="project-goal-title"');
    expect(html).toContain('for="project-goal-description"');
    expect(html).toContain('for="project-goal-intendedOutcome"');
    expect(html).toContain('for="project-goal-observedOutcomeLearning"');
    expect(html.match(/required=""/g)).toHaveLength(2);
    expect(html).toContain("Cancel");
  });
});
