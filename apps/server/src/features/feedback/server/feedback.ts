import {
  createFeedbackInputSchema,
  type FeedbackAccess,
  type FeedbackStore,
  feedbackProjectInputSchema,
  setFeedbackStatusInputSchema,
} from "@cantiara/api/feedback";

export class FeedbackProjectNotFoundError extends Error {
  readonly code = "FEEDBACK_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "FeedbackProjectNotFoundError";
  }
}

export class FeedbackNotFoundError extends Error {
  readonly code = "FEEDBACK_NOT_FOUND" as const;

  constructor(feedbackId: string) {
    super(`Feedback ${feedbackId} was not found.`);
    this.name = "FeedbackNotFoundError";
  }
}

export class FeedbackRevisionConflictError extends Error {
  readonly code = "FEEDBACK_REVISION_CONFLICT" as const;

  constructor(feedbackId: string) {
    super(`Feedback ${feedbackId} changed since it was loaded.`);
    this.name = "FeedbackRevisionConflictError";
  }
}

export class FeedbackProjectReadOnlyError extends Error {
  readonly code = "FEEDBACK_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "FeedbackProjectReadOnlyError";
  }
}

export class FeedbackAttachmentUnavailableError extends Error {
  readonly code = "FEEDBACK_ATTACHMENT_UNAVAILABLE" as const;

  constructor() {
    super("An attachment is not an active File Attachment of this Project.");
    this.name = "FeedbackAttachmentUnavailableError";
  }
}

/**
 * Feedback seam. Inputs are parsed against the strict contract, so a command
 * can never carry a summary replacement, Contact requirement, Work status,
 * priority or Kanban membership; the store sees only Feedback fields.
 */
export function createFeedback(store: FeedbackStore): FeedbackAccess {
  return {
    async create(accountId, input) {
      const parsed = createFeedbackInputSchema.parse(input);
      const record = await store.create(accountId, parsed);
      if (!record) {
        throw new FeedbackProjectNotFoundError(parsed.projectId);
      }
      return record;
    },

    async list(accountId, projectId) {
      const parsed = feedbackProjectInputSchema.parse({ projectId });
      const list = await store.list(accountId, parsed.projectId);
      if (!list) {
        throw new FeedbackProjectNotFoundError(parsed.projectId);
      }
      return list;
    },

    async setStatus(accountId, input) {
      const parsed = setFeedbackStatusInputSchema.parse(input);
      const record = await store.setStatus(accountId, parsed);
      if (!record) {
        throw new FeedbackNotFoundError(parsed.feedbackId);
      }
      return record;
    },
  };
}
