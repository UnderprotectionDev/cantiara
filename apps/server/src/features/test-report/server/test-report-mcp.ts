import {
  type TestReportAcceptanceAccess,
  TestReportRejectedError,
  toTestReportMcpReceipt,
} from "@cantiara/api/test-report";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * The narrow MCP delivery of Test Report Acceptance (spec 54, ticket 04). It
 * is not a general MCP or API: exactly one tool, `test_report.submit`, hands a
 * `test-report/1` envelope to `accept` with the `MCP` ingress and answers with
 * a receipt. There is no read, list, resource, prompt, update or other tool,
 * no command and no binary upload, and the server declares only the `tools`
 * capability. Context for the sending tool comes only from a Handoff package
 * the founder made.
 */
export const TEST_REPORT_SUBMIT_TOOL = "test_report.submit";

/** The integration an MCP request was verified to come from, and what it may report into. */
export interface VerifiedIntegration {
  accountId: string;
  integrationId: string;
  /** Projects the integration may deliver reports to; nothing else is reachable. */
  projectIds: readonly string[];
}

/**
 * Resolves the verified integration of one request. Authentication, token
 * issuance and the integration identity store are not part of this module:
 * the resolver is injected, and `null` means no verified integration.
 */
export type ResolveIntegration = (request: {
  authInfo?: unknown;
}) => Promise<VerifiedIntegration | null>;

export interface TestReportMcpDependencies {
  resolveIntegration: ResolveIntegration;
  testReports: TestReportAcceptanceAccess;
}

const SUBMIT_TOOL_DESCRIPTION =
  "Deliver one test-report/1 envelope as a new Test Session. Returns a receipt only.";

function textResult(body: unknown, isError: boolean): CallToolResult {
  return { content: [{ text: JSON.stringify(body), type: "text" }], isError };
}

function refusal(error: TestReportRejectedError) {
  return textResult(
    {
      code: error.code,
      explanation: error.explanation,
      field_path: error.fieldPath,
    },
    true,
  );
}

function projectIdOf(report: unknown) {
  const candidate =
    typeof report === "object" && report !== null
      ? (report as Record<string, unknown>).project_id
      : undefined;
  return typeof candidate === "string" ? candidate : null;
}

/**
 * Transport-agnostic handler of `test_report.submit`. The reporter is the
 * verified integration, never a payload field; a Project outside its scope is
 * `project_not_authorized` before the payload is read any further.
 */
export async function submitTestReport(
  dependencies: TestReportMcpDependencies,
  request: { authInfo?: unknown },
  report: unknown,
): Promise<CallToolResult> {
  const integration = await dependencies.resolveIntegration(request);
  const projectId = projectIdOf(report);
  if (
    !integration ||
    (projectId !== null && !integration.projectIds.includes(projectId))
  ) {
    return refusal(
      new TestReportRejectedError(
        "project_not_authorized",
        null,
        "The Project is unavailable for this report.",
      ),
    );
  }
  try {
    const receipt = await dependencies.testReports.accept(
      {
        accountId: integration.accountId,
        reporter: { id: integration.integrationId, kind: "integration" },
      },
      { ingress: "MCP", report },
    );
    return textResult(toTestReportMcpReceipt(receipt), false);
  } catch (error) {
    if (error instanceof TestReportRejectedError) {
      return refusal(error);
    }
    throw error;
  }
}

/**
 * Builds the MCP server. It is deliberately the low-level `Server` with two
 * request handlers (list the one tool, call the one tool) so no resource,
 * prompt or other capability can be registered by accident. Mounting it on a
 * transport belongs to the caller, together with a real authentication that
 * feeds `resolveIntegration`.
 */
export function createTestReportMcpServer(
  dependencies: TestReportMcpDependencies,
) {
  const server = new Server(
    { name: "cantiara-test-report", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        description: SUBMIT_TOOL_DESCRIPTION,
        inputSchema: { additionalProperties: true, type: "object" as const },
        name: TEST_REPORT_SUBMIT_TOOL,
      },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, (request, extra) => {
    if (request.params.name !== TEST_REPORT_SUBMIT_TOOL) {
      throw new McpError(ErrorCode.MethodNotFound, "Unknown tool.");
    }
    return submitTestReport(
      dependencies,
      { authInfo: extra.authInfo },
      request.params.arguments,
    );
  });
  return server;
}
