import {
  createScreenInputSchema,
  resolveScreenInputSchema,
  resolveScreenTarget,
  type ScreenStore,
  type ScreensAccess,
  screenProjectInputSchema,
  setScreenLifecycleInputSchema,
} from "@cantiara/api/screens";

export class ScreenProjectNotFoundError extends Error {
  readonly code = "SCREEN_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ScreenProjectNotFoundError";
  }
}

export class ScreenNotFoundError extends Error {
  readonly code = "SCREEN_NOT_FOUND" as const;

  constructor(screenId: string) {
    super(`Screen ${screenId} was not found.`);
    this.name = "ScreenNotFoundError";
  }
}

export class ScreenRevisionConflictError extends Error {
  readonly code = "SCREEN_REVISION_CONFLICT" as const;

  constructor(screenId: string) {
    super(`Screen ${screenId} changed since it was loaded.`);
    this.name = "ScreenRevisionConflictError";
  }
}

export class ScreenProjectReadOnlyError extends Error {
  readonly code = "SCREEN_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "ScreenProjectReadOnlyError";
  }
}

/** The lifecycle action does not apply to the Screen's current visibility. */
export class ScreenLifecycleInvalidError extends Error {
  readonly code = "SCREEN_LIFECYCLE_INVALID" as const;

  constructor(screenId: string, action: string) {
    super(`Screen ${screenId} cannot ${action} from its current visibility.`);
    this.name = "ScreenLifecycleInvalidError";
  }
}

/**
 * Screens and Wireframes seam. Commands address a Screen only; inputs are
 * strict, so a Wireframe id, visual design or independent Wireframe lifecycle
 * can never be named, and a target is resolved by its exact id or reported broken.
 */
export function createScreens(store: ScreenStore): ScreensAccess {
  return {
    async attachWireframeVersion(accountId, projectId, screenId) {
      const parsed = resolveScreenInputSchema.parse({ projectId, screenId });
      const record = await store.attachWireframeVersion(
        accountId,
        parsed.projectId,
        parsed.screenId,
      );
      if (!record) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return record;
    },

    async create(accountId, input) {
      const parsed = createScreenInputSchema.parse(input);
      const record = await store.create(accountId, parsed);
      if (!record) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return record;
    },

    async list(accountId, projectId) {
      const parsed = screenProjectInputSchema.parse({ projectId });
      const list = await store.list(accountId, parsed.projectId);
      if (!list) {
        throw new ScreenProjectNotFoundError(parsed.projectId);
      }
      return list;
    },

    async resolveTarget(accountId, input) {
      const parsed = resolveScreenInputSchema.parse(input);
      const record = await store.find(
        accountId,
        parsed.projectId,
        parsed.screenId,
      );
      return resolveScreenTarget(parsed.screenId, record);
    },

    async setLifecycle(accountId, input) {
      const parsed = setScreenLifecycleInputSchema.parse(input);
      const record = await store.setLifecycle(accountId, parsed);
      if (!record) {
        throw new ScreenNotFoundError(parsed.screenId);
      }
      return record;
    },
  };
}
