// @vitest-environment happy-dom
import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#x">{children}</a>,
}));

import { SharesAndPublicationsView } from "../shares-and-publications-view";

const base: SurfaceRow = {
  actions: ["Open source", "Change expiry / Reactivate", "Revoke / Unpublish"],
  expiresAt: null,
  frozenDetached: false,
  hasUnpublishedChanges: false,
  lastApprovedAt: "2026-01-02T00:00:00Z",
  passwordProtected: true,
  projectId: "p1",
  redaction: "None",
  revision: 1,
  source: { id: "d1", kind: "Document", projectId: "p1", title: "Plan" },
  status: "Active",
  surfaceId: "s1",
  visibility: "Link",
};

const renderRemove = () => <button type="button">Revoke / Unpublish</button>;

function render(rows: SurfaceRow[]) {
  return renderToStaticMarkup(
    <SharesAndPublicationsView
      error={false}
      loading={false}
      renderRemove={renderRemove}
      rows={rows}
      scopeLabel="Scope"
    />,
  );
}

describe("Shares and Publications view", () => {
  test("names the directory and shows status, access and the state's actions", () => {
    const html = render([base]);
    expect(html).toContain("Shares and Publications");
    expect(html).toContain("Active");
    expect(html).toContain("Password set");
    expect(html).toContain("Open source");
    expect(html).toContain("Change expiry / Reactivate");
    expect(html).toContain("Revoke / Unpublish");
    expect(html).toContain("<table");
  });

  test("starts no create flow and shows no counter, last access or visitor", () => {
    const html = render([base]);
    for (const text of [
      "Share<",
      "Publish Wiki Document",
      "Build in Public<",
      "views",
      "Last access",
      "Visitor",
    ]) {
      expect(html).not.toContain(text);
    }
  });

  test("marks a kept surface frozen and detached, not live", () => {
    const html = render([
      { ...base, actions: ["Revoke / Unpublish"], frozenDetached: true },
    ]);
    expect(html).toContain("Frozen · source detached");
    expect(html).not.toContain("Open source");
  });

  test("shows redaction and unpublished changes as labels without values", () => {
    const html = render([
      { ...base, hasUnpublishedChanges: true, redaction: "Redacted" },
    ]);
    expect(html).toContain("Unpublished changes");
    expect(html).toContain("Redacted");
  });

  test("shows Expired and Revoked states", () => {
    const html = render([
      { ...base, status: "Expired", surfaceId: "s2" },
      { ...base, actions: [], status: "Revoked", surfaceId: "s3" },
    ]);
    expect(html).toContain("Expired");
    expect(html).toContain("Revoked");
  });
});
