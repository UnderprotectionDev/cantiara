import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

import { createSecurityRedaction } from "../security-redaction";

const ACCOUNT = "account-1";
const VALUE = "sk-live-very-secret";

function setup(consume = vi.fn(() => Promise.resolve(true))) {
  const context = {
    githubIdentityConfirmation: { consume },
    securityRedaction: createSecurityRedaction({
      projectName: (accountId, projectId) =>
        Promise.resolve(
          accountId === ACCOUNT && projectId === "project-1" ? "Atlas" : null,
        ),
    }),
    session: {
      session: { id: "session" },
      user: { id: ACCOUNT, name: "Mert" },
    },
  } as unknown as Context;
  return { client: createRouterClient(appRouter, { context }), consume };
}

const request = {
  grant: "g",
  scope: { kind: "Project", projectId: "project-1" },
  sensitiveValue: VALUE,
  typedName: "Atlas",
} as const;

describe("Security Redaction RPC", () => {
  test("previews without consuming a grant", async () => {
    const { client, consume } = setup();
    const preview = await client.previewSecurityRedaction({
      scope: request.scope,
      sensitiveValue: VALUE,
    });
    expect(preview.typedNameTarget).toEqual({ kind: "Project", name: "Atlas" });
    expect(JSON.stringify(preview)).not.toContain(VALUE);
    expect(consume).not.toHaveBeenCalled();
  });

  test("consumes the security-redaction grant once and fails closed", async () => {
    const consume = vi.fn(() => Promise.resolve(false));
    const { client } = setup(consume);

    await expect(client.applySecurityRedaction(request)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      client.applySecurityRedaction({ ...request, typedName: "Ship it" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(
      { accountId: ACCOUNT, sessionId: "session" },
      "security-redaction",
      "g",
      undefined,
    );

    consume.mockResolvedValueOnce(true);
    await expect(client.applySecurityRedaction(request)).resolves.toMatchObject(
      { removal: "not-performed", status: "gate-passed" },
    );
  });

  test("does not find another Account's Project", async () => {
    await expect(
      setup().client.applySecurityRedaction({
        ...request,
        scope: { kind: "Project", projectId: "missing" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
