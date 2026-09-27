import { describe, expect, it } from "vitest";

import { mergeWorkspaceEnv } from "./workspace-env";

describe("workspace environment file", () => {
  it("preserves unrelated OAuth credentials and comments while replacing owned values", () => {
    const existing = [
      "# Local application credentials",
      "BETTER_AUTH_SECRET=old-secret",
      "GITHUB_CLIENT_ID=client-id",
      "GITHUB_CLIENT_SECRET=client-secret",
      "DATABASE_URL=postgresql://old-shared-db",
      "export PORT=3000",
      "",
    ].join("\n");
    const merged = mergeWorkspaceEnv(existing, {
      DATABASE_URL: "postgresql://workspace-db",
      PORT: "55070",
    });
    expect(merged).toContain("# Local application credentials");
    expect(merged).toContain("BETTER_AUTH_SECRET=old-secret");
    expect(merged).toContain("GITHUB_CLIENT_ID=client-id");
    expect(merged).toContain("GITHUB_CLIENT_SECRET=client-secret");
    expect(merged).not.toContain("old-shared-db");
    expect(merged).not.toContain("PORT=3000");
    expect(merged).toContain('DATABASE_URL="postgresql://workspace-db"');
    expect(merged).toContain('PORT="55070"');
  });
});
