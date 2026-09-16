import {
  isSupportReference,
  SUPPORT_REFERENCE_PATTERN,
} from "@cantiara/api/support-reference";
import { describe, expect, test, vi } from "vitest";

import {
  classifySupportReason,
  createSupportFailureResponse,
  createSupportReferenceFailure,
  decorateSupportFailureResponse,
  recordSupportFailure,
} from "./support-reference";

interface FailureResponseBody {
  data: {
    reasonCode: string;
    retryPolicy: string;
    supportReference: string;
    writeOutcome: string;
  };
  message: string;
}

describe("Client Shell Support reference", () => {
  test("derives the Support reference from a safe server tracking id", () => {
    const failure = createSupportReferenceFailure({
      requestId: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(failure.supportReference).toBe(
      "SUP-123E4567-E89B-12D3-A456-426614174000",
    );
  });

  test("does not echo an unsafe server tracking id", () => {
    const failure = createSupportReferenceFailure({
      error: new Error("token=private-token Workspace body"),
      requestId: "server-trace-secret",
    });

    expect(failure.supportReference).toMatch(SUPPORT_REFERENCE_PATTERN);
    expect(isSupportReference(failure.supportReference)).toBe(true);
    expect(JSON.stringify(failure)).not.toContain("server-trace-secret");
    expect(JSON.stringify(failure)).not.toContain("private-token");
    expect(JSON.stringify(failure)).not.toContain("Workspace body");
  });

  test("classifies schema drift without exposing the database error", () => {
    expect(
      classifySupportReason(
        new Error('42P01 relation "private_workspace" does not exist'),
      ),
    ).toBe("schema-drift");
    expect(
      classifySupportReason(
        new Error('42703 column "private_body" does not exist'),
      ),
    ).toBe("schema-drift");
  });

  test("maps an unmatched RPC to restart-the-API copy", () => {
    expect(
      classifySupportReason({ code: "NOT_FOUND", message: "404 Not Found" }),
    ).toBe("restart-api");
    expect(classifySupportReason({ status: 404, message: "Not Found" })).toBe(
      "restart-api",
    );
  });

  test("returns a safe failure envelope with the write outcome", async () => {
    const response = createSupportFailureResponse({
      error: new Error("session=secret-token private Workspace content"),
      requestId: "trace-secret",
      status: 500,
      writeOutcome: "not-written",
    });
    const body = (await response.json()) as FailureResponseBody;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(response.headers.get("x-cantiara-support-reference")).toBe(
      body.data.supportReference,
    );
    expect(body.message).toBe("This action could not be completed.");
    expect(body.data.writeOutcome).toBe("not-written");
    expect(body.data.retryPolicy).toBe("once");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("private Workspace content");
  });

  test("preserves a partial safe write outcome without trusting raw error data", () => {
    const failure = createSupportReferenceFailure({
      error: {
        data: { writeOutcome: "written" },
        message: "token=secret-token private Workspace content",
      },
    });

    expect(failure.writeOutcome).toBe("written");
    expect(failure.retryPolicy).toBe("never");
    expect(JSON.stringify(failure)).not.toContain("secret-token");
    expect(JSON.stringify(failure)).not.toContain("private Workspace content");
  });

  test("replaces a raw failed RPC response before it reaches the client", async () => {
    const rawResponse = Response.json(
      {
        data: "private Workspace content",
        message: "42703 column private_body does not exist",
        token: "secret-token",
      },
      { status: 500 },
    );

    const response = await decorateSupportFailureResponse(rawResponse, {
      requestId: "trace-secret",
    });
    const body = (await response.json()) as FailureResponseBody;
    const serialized = JSON.stringify(body);

    expect(body.message).toBe(
      "Please restart after applying the latest migration.",
    );
    expect(body.data.reasonCode).toBe("schema-drift");
    expect(serialized).not.toContain("private Workspace content");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("42703");
  });

  test("records only the safe support fields in the operator log", () => {
    const log = {
      set: vi.fn(),
      setLevel: vi.fn(),
    };
    const failure = createSupportReferenceFailure({
      error: new Error("token=secret-token private body"),
      requestId: "trace-secret",
    });

    recordSupportFailure(log, failure);

    expect(log.setLevel).toHaveBeenCalledWith("error");
    expect(log.set).toHaveBeenCalledWith({
      supportFailure: {
        reasonCode: failure.reasonCode,
        retryPolicy: failure.retryPolicy,
        supportReference: failure.supportReference,
        writeOutcome: failure.writeOutcome,
      },
    });
    expect(JSON.stringify(log.set.mock.calls)).not.toContain("secret-token");
  });
});
