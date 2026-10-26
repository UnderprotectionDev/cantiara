import type { ProductionIncidentFollowUpPreview } from "@cantiara/api/production-incidents";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { productionIncidentFollowUpFormSchema } from "../../../lib/production-incident-form";
import { ProductionIncidentFollowUpForm } from "../../forms/production-incident-follow-up-form";
import { ProductionIncidentFollowUpPreviewView } from "../production-incident-follow-up-preview";

const noop = () => undefined;
const noopAsync = async () => undefined;
const preview: ProductionIncidentFollowUpPreview = {
  fingerprint: "fp",
  plan: {
    incident: {
      id: "incident-1",
      revision: 2,
      status: "Watching",
      title: "Checkout outage",
    },
    relations: [
      {
        from: {
          id: "incident-1",
          label: "Checkout outage",
          type: "Production Incident",
        },
        kind: "Origin",
        to: { label: "Add a canary", type: "Work" },
      },
    ],
    work: {
      description: "Follow-up of Production Incident Checkout outage.",
      status: "Not Started",
      title: "Add a canary",
      type: "Task",
    },
  },
};

describe("Create follow-up work", () => {
  test("the first step asks for a Work type and title and says nothing is created yet", () => {
    const html = renderToStaticMarkup(
      <ProductionIncidentFollowUpForm
        draft={{ title: "Follow up: Checkout outage", workType: "Task" }}
        onCancel={noop}
        onPreview={noopAsync}
      />,
    );
    for (const type of ["Task", "Bug", "Research", "Improvement"]) {
      expect(html).toContain(`>${type}</option>`);
    }
    expect(html).toContain("Nothing is created yet");
    expect(html).toContain("Preview");
    expect(html).not.toContain("Create follow-up work");
  });

  test("the preview shows the Work, the Origin relation and the unchanged status before the confirm", () => {
    const html = renderToStaticMarkup(
      <ProductionIncidentFollowUpPreviewView
        confirming={false}
        error={null}
        onBack={noop}
        onConfirm={noop}
        preview={preview}
      />,
    );
    for (const text of [
      "Work to create",
      "Task",
      "Add a canary",
      "Not Started",
      "Relations to set",
      "Origin: Production Incident Checkout outage",
      "Work Add a canary",
      "stays Watching",
      "No other Bug, Risk or Work is created",
      "Create follow-up work",
      "Back",
    ]) {
      expect(html).toContain(text);
    }
  });

  test("the choice needs a title and only a known Work type", () => {
    expect(
      productionIncidentFollowUpFormSchema.safeParse({
        title: " ",
        workType: "Task",
      }).success,
    ).toBe(false);
    expect(
      productionIncidentFollowUpFormSchema.safeParse({
        title: "Add a canary",
        workType: "Feature",
      }).success,
    ).toBe(false);
    expect(
      productionIncidentFollowUpFormSchema.parse({
        title: " Add a canary ",
        workType: "Bug",
      }),
    ).toEqual({ title: "Add a canary", workType: "Bug" });
  });
});
