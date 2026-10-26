import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProductionIncidentForm } from "../production-incident-form";

const noop = async () => undefined;
const PAGER_COPY = /severity|pager|on-call|status page|TTR|TTD/i;

describe("Production Incident form", () => {
  test("create asks for Title, Occurred at and the five optional texts, and starts Open", () => {
    const html = renderToStaticMarkup(
      <ProductionIncidentForm mode="create" onSubmit={noop} />,
    );
    for (const id of [
      "production-incident-title",
      "production-incident-occurred-at",
      "production-incident-impact",
      "production-incident-detectedHow",
      "production-incident-resolution",
      "production-incident-rootCause",
      "production-incident-learning",
    ]) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html.match(/required=""/g)).toHaveLength(2);
    expect(html).toContain("Record Production Incident");
    expect(html).toContain("Starts as Open");
    expect(html).toContain('type="datetime-local"');
    expect(html).not.toContain("Create follow-up work");
  });

  test("edit keeps the stored values and never offers a severity or paging field", () => {
    const html = renderToStaticMarkup(
      <ProductionIncidentForm
        draft={{
          detectedHow: "Customer email",
          impact: "Checkout failed",
          learning: "",
          occurredAt: "2026-10-19T08:30",
          resolution: "",
          rootCause: "",
          title: "Checkout outage",
        }}
        mode="edit"
        onSubmit={noop}
      />,
    );
    expect(html).toContain('value="Checkout outage"');
    expect(html).toContain("Customer email");
    expect(html).toContain("Save changes");
    expect(html).not.toMatch(PAGER_COPY);
  });
});
