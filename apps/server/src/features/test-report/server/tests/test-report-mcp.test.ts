import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, test } from "vitest";
import {
  createTestReportMcpServer,
  TEST_REPORT_SUBMIT_TOOL,
  type VerifiedIntegration,
} from "../test-report-mcp";
import {
  accountId,
  createMemoryHarness,
  type MemoryHarnessOptions,
  projectId,
} from "../test-report-memory-store";

const integration: VerifiedIntegration = {
  accountId,
  integrationId: "integration-7",
  projectIds: [projectId],
};

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    executor: { name: "Codex", type: "ai_agent", version: "1.2" },
    external_session_id: "run-1",
    project_id: projectId,
    reported_at: "2026-08-06T12:30:00Z",
    schema_version: "test-report/1",
    tests: [{ external_test_id: "a", normalized_result: "passed", title: "A" }],
    ...overrides,
  };
}

const clients: Client[] = [];

async function connect(
  options: MemoryHarnessOptions = {},
  resolved: VerifiedIntegration | null = integration,
) {
  const harness = createMemoryHarness(options);
  const server = createTestReportMcpServer({
    resolveIntegration: () => Promise.resolve(resolved),
    testReports: harness.testReports,
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "external-tool", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  clients.push(client);
  return { client, harness };
}

async function submit(client: Client, report: unknown) {
  const result = await client.callTool({
    arguments: report as Record<string, unknown>,
    name: TEST_REPORT_SUBMIT_TOOL,
  });
  const [block] = result.content as { text: string; type: string }[];
  return {
    body: JSON.parse(block?.text ?? "null") as Record<string, unknown>,
    isError: result.isError === true,
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("narrow MCP surface", () => {
  test("lists exactly one tool and no resources, prompts or other capability", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toEqual(["test_report.submit"]);
    const capabilities = client.getServerCapabilities() ?? {};
    expect(Object.keys(capabilities)).toEqual(["tools"]);
    await expect(client.listResources()).rejects.toThrow();
    await expect(client.listPrompts()).rejects.toThrow();
    await expect(client.readResource({ uri: "file:///x" })).rejects.toThrow();
    await expect(
      client.callTool({ arguments: {}, name: "test_session.list" }),
    ).rejects.toThrow();
  });
});

describe("test_report.submit", () => {
  test("success is a receipt only, with no Test Session body", async () => {
    const { client, harness } = await connect();
    const { body, isError } = await submit(client, envelope());
    expect(isError).toBe(false);
    expect(Object.keys(body).sort()).toEqual([
      "accepted_at",
      "external_session_id",
      "fingerprint",
      "result",
      "session_id",
    ]);
    expect(body.result).toBe("created");
    expect(body.external_session_id).toBe("run-1");
    const [stored] = [...harness.sessions.values()];
    expect(body.session_id).toBe(stored?.id);
    expect(body.fingerprint).toBe(stored?.fingerprint);
    expect(JSON.stringify(body)).not.toContain("Codex");
    expect(JSON.stringify(body)).not.toContain("tests");
  });

  test("a retry is a duplicate receipt and writes nothing", async () => {
    const { client, harness } = await connect();
    const first = await submit(client, envelope());
    const second = await submit(client, envelope());
    expect(second.body.result).toBe("duplicate");
    expect(second.body.session_id).toBe(first.body.session_id);
    expect(harness.sessions.size).toBe(1);
  });

  test("the reporter is the verified integration, never a payload field", async () => {
    const { client, harness } = await connect();
    const forged = await submit(
      client,
      envelope({ reporter: { id: "founder", kind: "user" } }),
    );
    expect(forged.isError).toBe(true);
    expect(forged.body.code).toBe("unsupported_field");
    expect(JSON.stringify(forged.body)).not.toContain("founder");
    expect(harness.sessions.size).toBe(0);
    await submit(client, envelope());
    expect([...harness.sessions.values()][0]).toMatchObject({
      ingress: "MCP",
      reporter: { id: "integration-7", kind: "integration" },
    });
  });

  test("a Project outside the integration's scope, or no verified integration, is project_not_authorized", async () => {
    const scoped = await connect({}, { ...integration, projectIds: ["other"] });
    const outside = await submit(scoped.client, envelope());
    expect(outside).toMatchObject({
      body: { code: "project_not_authorized" },
      isError: true,
    });
    const anonymous = await connect({}, null);
    expect((await submit(anonymous.client, envelope())).body.code).toBe(
      "project_not_authorized",
    );
    expect(scoped.harness.sessions.size + anonymous.harness.sessions.size).toBe(
      0,
    );
  });

  test("a refusal carries the closed code and safe path and never the value", async () => {
    const { client, harness } = await connect();
    const refused = await submit(
      client,
      envelope({ schema_version: "test-report/2" }),
    );
    expect(refused).toMatchObject({
      body: { code: "schema_unsupported", field_path: "schema_version" },
      isError: true,
    });
    expect(JSON.stringify(refused.body)).not.toContain("test-report/2");
    expect(harness.sessions.size).toBe(0);
  });

  test("limits are never trimmed silently", async () => {
    const { client, harness } = await connect();
    const many = Array.from({ length: 1001 }, (_, index) => ({
      external_test_id: `t${index}`,
      title: "T",
    }));
    const refused = await submit(client, envelope({ tests: many }));
    expect(refused.body.code).toBe("payload_too_large");
    expect(harness.sessions.size).toBe(0);
  });

  test("a report to a Canceled Handoff is bound as history and the Handoff is untouched", async () => {
    const handoffs: NonNullable<MemoryHarnessOptions["handoffs"]> = [
      {
        id: "handoff-canceled",
        packageVersion: 1,
        projectId,
        scenarios: [],
        state: "Canceled",
      },
    ];
    const { client, harness } = await connect({ handoffs });
    const { isError } = await submit(
      client,
      envelope({ handoff_id: "handoff-canceled", handoff_package_version: 1 }),
    );
    expect(isError).toBe(false);
    expect([...harness.sessions.values()][0]?.handoffStateAtAccept).toBe(
      "Canceled",
    );
    expect(handoffs[0]?.state).toBe("Canceled");
  });

  test.each([
    [
      "a data URI",
      { type: "attachment_ref", value: "data:image/png;base64,iVBORw0KGgo=" },
    ],
    ["a base64 blob", { type: "attachment_ref", value: "QUJD".repeat(400) }],
    [
      "a text excerpt holding a data URI",
      { type: "text_excerpt", value: "x data:text/plain;base64,QUJD" },
    ],
    [
      "inline file content",
      { content_base64: "QUJD", type: "attachment_ref", value: "shot.png" },
    ],
  ])("binary evidence (%s) is attachment_rejected", async (_name, evidence) => {
    const { client, harness } = await connect();
    const refused = await submit(
      client,
      envelope({
        tests: [{ evidence: [evidence], external_test_id: "a", title: "A" }],
      }),
    );
    expect(refused).toMatchObject({
      body: { code: "attachment_rejected" },
      isError: true,
    });
    expect(harness.sessions.size).toBe(0);
  });
});
