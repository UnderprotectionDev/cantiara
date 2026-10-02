import { describe, expect, it } from "vitest";
import {
  applicationEnvironment,
  type DatabaseConfig,
  newWorkspaceState,
  parseDatabaseConfig,
  workspaceBranchName,
  workspaceEnvironment,
} from "./workspace-database";

const config: DatabaseConfig = {
  version: 1,
  primary: {
    projectId: "project-primary",
    productionBranchId: "br-prod-primary",
    developmentBranchId: "br-dev-primary",
    databaseName: "development",
    roleName: "primary_owner",
  },
  security: {
    projectId: "project-security",
    productionBranchId: "br-prod-security",
    developmentBranchId: "br-dev-security",
    databaseName: "development",
    roleName: "security_owner",
  },
};
function ownedState() {
  const state = newWorkspaceState("workspace-one", "c".repeat(40), {
    primary: "a".repeat(64),
    security: "b".repeat(64),
  });
  for (const kind of ["primary", "security"] as const) {
    state[kind] = {
      projectId: config[kind].projectId,
      branchId: `br-child-${kind}`,
      parentId: `br-base-${kind}`,
      endpointId: `ep-child-${kind}`,
      name: workspaceBranchName(state, kind),
      verified: true,
      connection: `postgresql://${config[kind].roleName}:password@ep-child-${kind}.eu.neon.tech/development`,
    };
  }
  return state;
}

describe("workspace database environment", () => {
  it("refuses a Conductor workspace without its own databases", () => {
    expect(() =>
      workspaceEnvironment(
        { CONDUCTOR_WORKSPACE_ID: "workspace-one", DATABASE_URL: "shared" },
        undefined,
      ),
    ).toThrow("db:workspace:setup");
  });

  it("keeps disposable local fixtures outside the Neon lifecycle", () => {
    const environment = {
      CONDUCTOR_WORKSPACE_ID: "workspace-one",
      NEON_LOCAL: "true",
      DATABASE_URL: "postgresql://localhost/fixture",
    };
    expect(workspaceEnvironment(environment, undefined)).toEqual(environment);
  });

  it("removes management credentials from local and non-Conductor child environments", () => {
    for (const mode of [{ NEON_LOCAL: "true" }, {}]) {
      const result = applicationEnvironment({
        ...mode,
        NEON_API_KEY: "management",
        NEON_SECURITY_API_KEY: "security",
      });
      expect(result.NEON_API_KEY).toBeUndefined();
      expect(result.NEON_SECURITY_API_KEY).toBeUndefined();
    }
  });

  it("never falls back to inherited remote URLs when workspace identity is absent", () => {
    expect(() =>
      workspaceEnvironment(
        {
          DATABASE_URL:
            "postgresql://owner:secret@ep-shared.neon.tech/development",
        },
        undefined,
      ),
    ).toThrow("db:workspace:setup");
  });

  it("uses the same owned direct targets for the app and migrations instead of copied URLs", () => {
    const result = workspaceEnvironment(
      {
        CONDUCTOR_WORKSPACE_ID: "workspace-one",
        DATABASE_URL: "shared-primary",
        DATABASE_URL_UNPOOLED: "shared-unpooled",
        SECURITY_EVENT_DATABASE_URL: "shared-security",
        NEON_API_KEY: "private-key",
        NEON_SECURITY_API_KEY: "private-security-key",
        BETTER_AUTH_SECRET: "application-secret",
        SECURITY_EVENT_LOCAL: "true",
      },
      ownedState(),
      config,
    );
    expect(result.DATABASE_URL).toBe(
      "postgresql://primary_owner:password@ep-child-primary.eu.neon.tech/development",
    );
    expect(result.DATABASE_URL_UNPOOLED).toBe(result.DATABASE_URL);
    expect(result.SECURITY_EVENT_DATABASE_URL_UNPOOLED).toBe(
      result.SECURITY_EVENT_DATABASE_URL,
    );
    expect(result.BETTER_AUTH_SECRET).toBe("application-secret");
    expect(result.NEON_API_KEY).toBeUndefined();
    expect(result.NEON_SECURITY_API_KEY).toBeUndefined();
    expect(result.SECURITY_EVENT_LOCAL).toBe("false");
  });

  it("refuses copied, archived, incomplete and production-owned state", () => {
    for (const change of [
      (state: ReturnType<typeof ownedState>) => {
        state.workspaceId = "another-workspace";
      },
      (state: ReturnType<typeof ownedState>) => {
        state.archived = true;
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.verified = false;
        }
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.branchId = config.primary.productionBranchId;
        }
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.connection =
            "postgresql://owner:secret@ep-production.eu.neon.tech/development";
        }
      },
    ]) {
      const state = ownedState();
      change(state);
      expect(() =>
        workspaceEnvironment(
          { CONDUCTOR_WORKSPACE_ID: "workspace-one" },
          state,
          config,
        ),
      ).toThrow();
    }
  });

  it("refuses a shared project or production as the canonical development target", () => {
    expect(() =>
      parseDatabaseConfig({ ...config, security: config.primary }),
    ).toThrow("separate projects");
    expect(() =>
      parseDatabaseConfig({
        ...config,
        primary: {
          ...config.primary,
          developmentBranchId: config.primary.productionBranchId,
        },
      }),
    ).toThrow("must not be production");
  });
});
