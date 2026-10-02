import { expect, it } from "vitest";
import { NeonApi } from "./neon-api";

it.each([true, false])(
  "uses the account's default compute policy when schema-only is %s",
  async (schemaOnly) => {
    const client = new NeonApi(
      "project-one",
      "private-key",
      (_url, options) => {
        if (options.method === "POST") {
          const body = JSON.parse(String(options.body));
          if ("suspend_timeout_seconds" in body.endpoints[0]) {
            return Promise.resolve(
              Response.json(
                { message: "modifying the suspend interval is not permitted" },
                { status: 412 },
              ),
            );
          }
          expect(body.endpoints).toEqual([{ type: "read_write" }]);
        }
        return Promise.resolve(
          Response.json({
            branch: {
              id: "br-child",
              project_id: "project-one",
              name: "isolated",
              default: false,
              protected: false,
              current_state: "ready",
            },
            operations: [],
          }),
        );
      },
    );
    await expect(
      client.createBranch("isolated", "br-source", schemaOnly),
    ).resolves.toMatchObject({ id: "br-child" });
  },
);

it("sends an explicit schema source while accepting the resulting independent root", async () => {
  const branch = {
    id: "br-root",
    project_id: "project-one",
    name: "isolated",
    default: false,
    protected: false,
    current_state: "ready",
    init_source: "parent-schema",
  };
  const requests: RequestInit[] = [];
  const client = new NeonApi("project-one", "private-key", (_url, options) => {
    requests.push(options);
    return Promise.resolve(Response.json({ branch, operations: [] }));
  });
  const root = await client.createBranch("isolated", "br-production", true);
  expect(JSON.parse(String(requests[0]?.body)).branch).toEqual({
    name: "isolated",
    parent_id: "br-production",
    init_source: "schema-only",
  });
  expect(root.parent_id).toBeUndefined();
  expect(root.init_source).toBe("parent-schema");
});

it("does not expose management credentials or server error bodies", async () => {
  const client = new NeonApi(
    "project-one",
    "private-management-key",
    async () =>
      new Response("postgresql://owner:private-password@database", {
        status: 403,
      }),
  );
  await expect(client.getBranch("br-child")).rejects.toThrow(
    "Neon API GET failed (403)",
  );
});

it("waits for branch operations before returning a usable branch", async () => {
  const responses = [
    {
      branch: {
        id: "br-child",
        project_id: "project-one",
        name: "isolated",
        default: false,
        protected: false,
        current_state: "ready",
      },
      operations: [{ id: "operation-one" }],
    },
    { operation: { status: "finished" } },
    {
      branch: {
        id: "br-child",
        project_id: "project-one",
        name: "isolated",
        default: false,
        protected: false,
        current_state: "ready",
      },
    },
  ];
  const client = new NeonApi("project-one", "private-key", async () =>
    Response.json(responses.shift()),
  );
  await expect(
    client.createBranch("isolated", "br-base"),
  ).resolves.toMatchObject({
    id: "br-child",
  });
  expect(responses).toHaveLength(0);
});

it("refuses absent default or protection metadata", async () => {
  const client = new NeonApi("project-one", "private-key", () =>
    Promise.resolve(
      Response.json({
        branch: { id: "br-child", project_id: "project-one", name: "isolated" },
      }),
    ),
  );
  await expect(client.getBranch("br-child")).rejects.toThrow(
    "Unexpected Neon API response",
  );
});

it("finds an exact branch across pages without reclaiming a different name", async () => {
  const requests: string[] = [];
  const client = new NeonApi("project-one", "private-key", (url) => {
    requests.push(url);
    return Promise.resolve(
      Response.json({
        branches: [
          {
            id: requests.length === 1 ? "br-other" : "br-child",
            project_id: "project-one",
            name: requests.length === 1 ? "other" : "owned",
            default: false,
            protected: false,
            current_state: "ready",
          },
        ],
        pagination: requests.length === 1 ? { cursor: "next" } : {},
      }),
    );
  });
  await expect(client.findBranch("owned")).resolves.toMatchObject({
    id: "br-child",
  });
  expect(requests[1]).toContain("cursor=next");
});

it("does not retry a POST with an uncertain result and redacts transport errors", async () => {
  let attempts = 0;
  const client = new NeonApi("project-one", "private-key", () => {
    attempts += 1;
    return Promise.reject(
      new Error("private-key postgresql://owner:secret@host"),
    );
  });
  await expect(client.createBranch("owned", "br-base")).rejects.toThrow(
    "reconcile saved ownership",
  );
  expect(attempts).toBe(1);
});

it.each(["failed", "error", "cancelled"])(
  "does not publish a branch after a terminal %s operation",
  async (status) => {
    const responses = [
      {
        branch: {
          id: "br-child",
          project_id: "project-one",
          name: "owned",
          default: false,
          protected: false,
          current_state: "ready",
        },
        operations: [{ id: "operation-one" }],
      },
      { operation: { status } },
    ];
    const client = new NeonApi("project-one", "private-key", () =>
      Promise.resolve(Response.json(responses.shift())),
    );
    await expect(client.createBranch("owned", "br-base")).rejects.toThrow(
      "operation failed",
    );
  },
);

it("waits for a reclaimed branch rather than using a still-initializing endpoint", async () => {
  const responses = [
    {
      branches: [
        {
          id: "br-child",
          project_id: "project-one",
          name: "owned",
          default: false,
          protected: false,
          current_state: "init",
        },
      ],
    },
    {
      branch: {
        id: "br-child",
        project_id: "project-one",
        name: "owned",
        default: false,
        protected: false,
        current_state: "ready",
      },
    },
  ];
  const client = new NeonApi("project-one", "private-key", () =>
    Promise.resolve(Response.json(responses.shift())),
  );
  await expect(client.findBranch("owned")).resolves.toMatchObject({
    current_state: "ready",
  });
  expect(responses).toHaveLength(0);
});

it("rejects a production logical database collision without writing anything", async () => {
  const methods: (string | undefined)[] = [];
  const client = new NeonApi("project-one", "private-key", (_url, options) => {
    methods.push(options.method);
    return Promise.resolve(
      Response.json({ databases: [{ name: "development" }] }),
    );
  });
  await expect(
    client.assertDatabaseAbsent("br-production", "development"),
  ).rejects.toThrow("new logical database name");
  expect(methods).toEqual(["GET"]);
});

it("requests the recorded direct endpoint, database and role", async () => {
  let requested = "";
  const client = new NeonApi("project-one", "private-key", (url) => {
    requested = url;
    return Promise.resolve(
      Response.json({
        uri: "postgresql://owner:secret@ep-child.eu.neon.tech/development",
      }),
    );
  });
  await client.connection("br-child", "ep-child", "development", "owner");
  expect(new URL(requested).searchParams).toEqual(
    new URLSearchParams({
      branch_id: "br-child",
      endpoint_id: "ep-child",
      database_name: "development",
      role_name: "owner",
      pooled: "false",
    }),
  );
});
