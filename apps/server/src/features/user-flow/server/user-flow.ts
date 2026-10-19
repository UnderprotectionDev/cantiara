import {
  buildUserFlowView,
  createUserFlowInputSchema,
  type ParsedUserFlowDocumentInput,
  placeUserFlowNodeInputSchema,
  type ScreenLookup,
  saveUserFlowVersionInputSchema,
  type UserFlowAccess,
  type UserFlowDocument,
  type UserFlowRecord,
  type UserFlowStore,
  userFlowInputSchema,
  userFlowProjectInputSchema,
} from "@cantiara/api/user-flow";

export class UserFlowProjectNotFoundError extends Error {
  readonly code = "USER_FLOW_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "UserFlowProjectNotFoundError";
  }
}

export class UserFlowNotFoundError extends Error {
  readonly code = "USER_FLOW_NOT_FOUND" as const;

  constructor(userFlowId: string) {
    super(`User Flow ${userFlowId} was not found.`);
    this.name = "UserFlowNotFoundError";
  }
}

export class UserFlowVersionConflictError extends Error {
  readonly code = "USER_FLOW_VERSION_CONFLICT" as const;

  constructor(userFlowId: string) {
    super(`User Flow ${userFlowId} changed since it was loaded.`);
    this.name = "UserFlowVersionConflictError";
  }
}

export class UserFlowProjectReadOnlyError extends Error {
  readonly code = "USER_FLOW_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "UserFlowProjectReadOnlyError";
  }
}

/** A newly referenced Screen must be an active Screen of the same Project. */
export class UserFlowScreenUnavailableError extends Error {
  readonly code = "USER_FLOW_SCREEN_UNAVAILABLE" as const;

  constructor() {
    super("The Screen is not an active Screen of this Project.");
    this.name = "UserFlowScreenUnavailableError";
  }
}

export interface UserFlowOptions {
  generateId?: () => string;
  now?: () => Date;
}

function isActiveScreenOf(projectId: string, lookup: ScreenLookup | undefined) {
  return (
    lookup?.kind === "found" &&
    lookup.projectId === projectId &&
    !(lookup.archivedAt || lookup.trashedAt || lookup.redactedAt)
  );
}

/**
 * User Flow seam. A Screen node holds a live Screen id and flow-local text;
 * every read resolves that id through the common broken-reference presentation
 * and never retargets it. Inputs are strict, so a node cannot carry a copied
 * Screen title or body, an extra semantic type, or a Screen id on a non-Screen
 * node.
 */
export function createUserFlow(
  store: UserFlowStore,
  options: UserFlowOptions = {},
): UserFlowAccess {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  async function view(accountId: string, record: UserFlowRecord) {
    const screenIds = [
      ...new Set(
        record.document.nodes.flatMap(({ screenId }) =>
          screenId ? [screenId] : [],
        ),
      ),
    ];
    const lookups =
      screenIds.length === 0
        ? new Map<string, ScreenLookup>()
        : await store.lookupScreens(accountId, screenIds);
    return buildUserFlowView(record, lookups);
  }

  /**
   * Stored form of an input document. An unchanged live reference keeps the
   * time it was established; a new or repointed one is stamped now, and must
   * resolve to an active Screen of the Project.
   */
  async function toStoredDocument(
    accountId: string,
    projectId: string,
    previous: UserFlowDocument,
    input: ParsedUserFlowDocumentInput,
  ): Promise<UserFlowDocument> {
    const before = new Map(previous.nodes.map((node) => [node.id, node]));
    const placedAt = now().toISOString();
    const fresh = input.nodes.flatMap((node) =>
      node.screenId && before.get(node.id)?.screenId !== node.screenId
        ? [node.screenId]
        : [],
    );
    if (fresh.length > 0) {
      const lookups = await store.lookupScreens(accountId, [...new Set(fresh)]);
      if (!fresh.every((id) => isActiveScreenOf(projectId, lookups.get(id)))) {
        throw new UserFlowScreenUnavailableError();
      }
    }
    return {
      links: input.links,
      nodes: input.nodes.map((node) => {
        const existing = before.get(node.id);
        const unchanged =
          existing !== undefined && existing.screenId === node.screenId;
        return {
          id: node.id,
          kind: node.kind,
          placedAt: unchanged ? existing.placedAt : placedAt,
          position: node.position,
          screenId: node.screenId,
          text: node.text,
        };
      }),
    };
  }

  async function load(
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) {
    const record = await store.find(accountId, projectId, userFlowId);
    if (!record) {
      throw new UserFlowNotFoundError(userFlowId);
    }
    return record;
  }

  return {
    async create(accountId, input) {
      const parsed = createUserFlowInputSchema.parse(input);
      const record = await store.create(accountId, {
        document: { links: [], nodes: [] },
        id: parsed.id ?? generateId(),
        projectId: parsed.projectId,
        title: parsed.title,
      });
      if (!record) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return view(accountId, record);
    },

    async get(accountId, projectId, userFlowId) {
      const parsed = userFlowInputSchema.parse({ projectId, userFlowId });
      return view(
        accountId,
        await load(accountId, parsed.projectId, parsed.userFlowId),
      );
    },

    async list(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const records = await store.list(accountId, parsed.projectId);
      if (!records) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return records.map((record) => ({
        id: record.id,
        projectId: record.projectId,
        title: record.title,
        updatedAt: record.updatedAt,
        version: record.version,
      }));
    },

    async save(accountId, input) {
      const parsed = saveUserFlowVersionInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (current.version !== parsed.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const document = await toStoredDocument(
        accountId,
        parsed.projectId,
        current.document,
        parsed.document,
      );
      const saved = await store.appendVersion(accountId, {
        document,
        expectedVersion: parsed.expectedVersion,
        projectId: parsed.projectId,
        userFlowId: parsed.userFlowId,
      });
      if (!saved) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      return view(accountId, saved);
    },

    async placeNode(accountId, input) {
      const parsed = placeUserFlowNodeInputSchema.parse(input);
      const current = await load(
        accountId,
        parsed.projectId,
        parsed.userFlowId,
      );
      if (current.version !== parsed.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const nodeId = parsed.nodeId ?? generateId();
      const document = await toStoredDocument(
        accountId,
        parsed.projectId,
        current.document,
        {
          links: current.document.links,
          nodes: [
            ...current.document.nodes,
            {
              id: nodeId,
              kind: parsed.kind,
              position: parsed.position,
              screenId: parsed.screenId,
              text: parsed.text,
            },
          ],
        },
      );
      const saved = await store.appendVersion(accountId, {
        document,
        expectedVersion: parsed.expectedVersion,
        projectId: parsed.projectId,
        userFlowId: parsed.userFlowId,
      });
      if (!saved) {
        throw new UserFlowNotFoundError(parsed.userFlowId);
      }
      return view(accountId, saved);
    },

    async screens(accountId, projectId) {
      const parsed = userFlowProjectInputSchema.parse({ projectId });
      const screens = await store.listScreens(accountId, parsed.projectId);
      if (!screens) {
        throw new UserFlowProjectNotFoundError(parsed.projectId);
      }
      return screens;
    },
  };
}
