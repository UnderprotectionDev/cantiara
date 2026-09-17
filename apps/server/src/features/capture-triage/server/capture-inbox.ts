import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  type CaptureInboxAccess,
  type CaptureInboxGroup,
  type CaptureInboxItem,
  type CaptureInboxSnapshot,
  type CaptureInput,
  captureInboxItemSchema,
  captureInputSchema,
  type DirectBugCreateInput,
  type DirectBugCreateReceipt,
  type NormalizedCaptureInput,
} from "@cantiara/api/capture-triage";

export interface CaptureInboxStore {
  insert: (
    accountId: string,
    input: NormalizedCaptureInput,
  ) => Promise<CaptureInboxItem>;
  list: (accountId: string) => Promise<CaptureInboxItem[]>;
}

export interface CaptureInboxWorkCreate {
  createBug: (input: DirectBugCreateInput) => Promise<DirectBugCreateReceipt>;
}

export class CaptureInboxError extends Error {
  readonly code: CaptureInboxErrorCode;

  constructor(code: CaptureInboxErrorCode, message: string) {
    super(message);
    this.name = "CaptureInboxError";
    this.code = code;
  }
}

export type CaptureInboxErrorCode =
  | "CREATE_BUG_TEMPLATE_UNSUPPORTED"
  | "CAPTURE_IDEMPOTENCY_CONFLICT"
  | "PROJECT_REQUIRED_FOR_CREATE_BUG"
  | "UNKNOWN_CAPTURE_FIELD";

function normalizeCaptureInput(input: CaptureInput): NormalizedCaptureInput {
  const parsed = captureInputSchema.parse(input);
  const allowedFields: readonly string[] = parsed.template
    ? CAPTURE_TEMPLATE_FIELD_LABELS[parsed.template]
    : [];

  for (const field of Object.keys(parsed.fields)) {
    if (!allowedFields.includes(field)) {
      throw new CaptureInboxError(
        "UNKNOWN_CAPTURE_FIELD",
        `${field} is not a field in ${parsed.template ?? "freeform capture"}.`,
      );
    }
  }

  return parsed;
}

function groupCaptureInboxItems(items: CaptureInboxItem[]) {
  const groups = new Map<string, CaptureInboxGroup>();

  for (const item of items) {
    const projectKey = item.projectId?.toLocaleLowerCase("en-US");
    const groupKey = projectKey ? `project:${projectKey}` : "workspace";
    const existing = groups.get(groupKey);
    if (existing) {
      existing.itemIds.push(item.id);
      existing.items.push(item);
      continue;
    }

    groups.set(
      groupKey,
      projectKey
        ? {
            itemIds: [item.id],
            items: [item],
            kind: "project",
            label: "Project Capture Inbox",
            projectId: item.projectId ?? undefined,
          }
        : {
            itemIds: [item.id],
            items: [item],
            kind: "workspace",
            label: "Workspace Capture Inbox",
          },
    );
  }

  return [...groups.values()];
}

export function createCaptureInbox({
  store,
  workCreate,
}: {
  store: CaptureInboxStore;
  workCreate: CaptureInboxWorkCreate;
}): CaptureInboxAccess {
  return {
    async create(accountId, input) {
      return await store.insert(accountId, normalizeCaptureInput(input));
    },

    async createBug(accountId, input) {
      const normalized = normalizeCaptureInput(input);
      if (!normalized.projectId) {
        throw new CaptureInboxError(
          "PROJECT_REQUIRED_FOR_CREATE_BUG",
          "Create Bug requires a Project.",
        );
      }
      if (
        normalized.template !== null &&
        normalized.template !== "Bug Capture"
      ) {
        throw new CaptureInboxError(
          "CREATE_BUG_TEMPLATE_UNSUPPORTED",
          "Create Bug is available for Bug Capture or an unspecified type.",
        );
      }

      return await workCreate.createBug({
        ...normalized,
        accountId,
      });
    },

    async list(accountId): Promise<CaptureInboxSnapshot> {
      const items = (await store.list(accountId))
        .map((item) => captureInboxItemSchema.parse(item))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return {
        groups: groupCaptureInboxItems(items),
        items,
      };
    },
  };
}
