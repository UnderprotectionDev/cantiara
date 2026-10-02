import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { redactedFailure } from "./workspace-storage";

const projectPattern = /^[a-z0-9-]{1,80}$/;

const branchSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  parent_id: z.string().optional(),
  default: z.boolean(),
  primary: z.boolean().optional(),
  protected: z.boolean(),
  init_source: z.string().optional(),
  current_state: z.string(),
});
const endpointSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  branch_id: z.string(),
  type: z.string(),
});
export type NeonBranch = z.infer<typeof branchSchema>;
export type NeonEndpoint = z.infer<typeof endpointSchema>;
type Transport = (url: string, options: RequestInit) => Promise<Response>;

export class NeonApi {
  readonly projectId: string;
  private readonly key: string;
  private readonly transport: Transport;

  constructor(projectId: string, key: string, transport: Transport = fetch) {
    if (!(projectPattern.test(projectId) && key)) {
      throw new Error("Neon project and management API key are required");
    }
    this.projectId = projectId;
    this.key = key;
    this.transport = transport;
  }

  private async request(method: string, resource: string, body?: unknown) {
    let response: Response;
    try {
      response = await this.transport(
        `https://console.neon.tech/api/v2/projects/${this.projectId}/${resource}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        },
      );
    } catch (error) {
      throw redactedFailure(
        `Neon API ${method} connection failed; reconcile saved ownership before retrying`,
        error,
      );
    }
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new Error(`Neon API ${method} failed (${response.status})`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw redactedFailure(
        "Invalid Neon API response; response body redacted",
        error,
      );
    }
  }

  private decode<Output>(schema: z.ZodType<Output>, value: unknown): Output {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new Error("Unexpected Neon API response; response body redacted");
    }
    return parsed.data;
  }

  async getBranch(
    branchId: string,
    deadline = Date.now() + 120_000,
  ): Promise<NeonBranch | undefined> {
    const value = await this.request(
      "GET",
      `branches/${encodeURIComponent(branchId)}`,
    );
    if (value === undefined) {
      return undefined;
    }
    const { branch } = this.decode(z.object({ branch: branchSchema }), value);
    return this.readyBranch(branch, deadline);
  }

  private async readyBranch(
    branch: NeonBranch,
    deadline: number,
  ): Promise<NeonBranch | undefined> {
    if (branch.current_state === "ready") {
      return branch;
    }
    if (
      !["init", "resetting"].includes(branch.current_state) ||
      Date.now() > deadline
    ) {
      throw new Error(
        "Neon branch is not ready; retain saved ownership and inspect the pending operation",
      );
    }
    await delay(500);
    return this.getBranch(branch.id, deadline);
  }

  async findBranch(name: string) {
    const matches: NeonBranch[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    const nextPage = async (): Promise<void> => {
      const query = new URLSearchParams({ limit: "100" });
      if (cursor) {
        if (seen.has(cursor)) {
          throw new Error("Neon branch pagination did not advance");
        }
        seen.add(cursor);
        query.set("cursor", cursor);
      }
      const page = this.decode(
        z.object({
          branches: z.array(branchSchema),
          pagination: z.object({ cursor: z.string().optional() }).optional(),
        }),
        await this.request("GET", `branches?${query}`),
      );
      matches.push(...page.branches.filter((branch) => branch.name === name));
      cursor = page.pagination?.cursor;
      if (cursor) {
        await nextPage();
      }
    };
    await nextPage();
    if (matches.length > 1) {
      throw new Error("Ambiguous Neon branch name; no branch was reclaimed");
    }
    const [match] = matches;
    return match ? this.readyBranch(match, Date.now() + 120_000) : undefined;
  }

  private async waitForOperations(operations: { id: string }[]) {
    await Promise.all(
      operations.map((operation) =>
        this.waitForOperation(operation.id, Date.now() + 120_000),
      ),
    );
  }

  private async waitForOperation(
    operationId: string,
    deadline: number,
  ): Promise<void> {
    const result = this.decode(
      z.object({ operation: z.object({ status: z.string() }) }),
      await this.request(
        "GET",
        `operations/${encodeURIComponent(operationId)}`,
      ),
    );
    if (["finished", "skipped"].includes(result.operation.status)) {
      return;
    }
    if (
      !["scheduling", "running", "cancelling"].includes(
        result.operation.status,
      ) ||
      Date.now() > deadline
    ) {
      throw new Error("Neon operation failed or timed out; retain saved state");
    }
    await delay(500);
    await this.waitForOperation(operationId, deadline);
  }

  async createBranch(name: string, sourceBranchId: string, schemaOnly = false) {
    const result = this.decode(
      z.object({
        branch: branchSchema,
        operations: z.array(z.object({ id: z.string() })),
      }),
      await this.request("POST", "branches", {
        branch: {
          name,
          parent_id: sourceBranchId,
          init_source: schemaOnly ? "schema-only" : "parent-data",
        },
        endpoints: [{ type: "read_write" }],
      }),
    );
    await this.waitForOperations(result.operations);
    const branch = await this.getBranch(result.branch.id);
    if (!branch) {
      throw new Error(
        "Created Neon branch disappeared; retain saved ownership",
      );
    }
    return branch;
  }

  async endpoint(branchId: string) {
    const result = this.decode(
      z.object({ endpoints: z.array(endpointSchema) }),
      await this.request("GET", "endpoints"),
    );
    const endpoints = result.endpoints.filter(
      (endpoint) =>
        endpoint.branch_id === branchId && endpoint.type === "read_write",
    );
    if (endpoints.length !== 1 || endpoints[0]?.project_id !== this.projectId) {
      throw new Error("Owned branch requires exactly one read-write endpoint");
    }
    return endpoints[0];
  }

  async connection(
    branchId: string,
    endpointId: string,
    database: string,
    role: string,
  ) {
    const query = new URLSearchParams({
      branch_id: branchId,
      endpoint_id: endpointId,
      database_name: database,
      role_name: role,
      pooled: "false",
    });
    return this.decode(
      z.object({ uri: z.string() }),
      await this.request("GET", `connection_uri?${query}`),
    ).uri;
  }

  async ensureEmptyDatabase(branchId: string, name: string, owner: string) {
    const result = this.decode(
      z.object({
        databases: z.array(
          z.object({ name: z.string(), owner_name: z.string() }),
        ),
      }),
      await this.request("GET", `branches/${branchId}/databases`),
    );
    const existing = result.databases.find(
      (database) => database.name === name,
    );
    if (existing) {
      if (existing.owner_name !== owner) {
        throw new Error(
          "Development database owner differs from configuration",
        );
      }
      return;
    }
    const created = this.decode(
      z.object({ operations: z.array(z.object({ id: z.string() })) }),
      await this.request("POST", `branches/${branchId}/databases`, {
        database: { name, owner_name: owner },
      }),
    );
    await this.waitForOperations(created.operations);
  }

  async assertDatabaseAbsent(branchId: string, name: string) {
    const result = this.decode(
      z.object({ databases: z.array(z.object({ name: z.string() })) }),
      await this.request(
        "GET",
        `branches/${encodeURIComponent(branchId)}/databases`,
      ),
    );
    if (result.databases.some((database) => database.name === name)) {
      throw new Error(
        "Bootstrap requires a new logical database name not present on production",
      );
    }
  }

  async deleteBranch(branchId: string) {
    const result = await this.request(
      "DELETE",
      `branches/${encodeURIComponent(branchId)}`,
    );
    if (result !== undefined) {
      await this.waitForOperations(
        this.decode(
          z.object({ operations: z.array(z.object({ id: z.string() })) }),
          result,
        ).operations,
      );
    }
  }
}
