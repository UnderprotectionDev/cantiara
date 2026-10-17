import {
  buildFeedbackWorkPlan,
  convertFeedbackToWorkInputSchema,
  createFeedbackInputSchema,
  type FeedbackAccess,
  type FeedbackStore,
  feedbackProjectInputSchema,
  isSameFeedbackWorkPlan,
  previewFeedbackWorkInputSchema,
  setFeedbackIdentityInputSchema,
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

export class FeedbackIdentityUnavailableError extends Error {
  readonly code = "FEEDBACK_IDENTITY_UNAVAILABLE" as const;

  constructor() {
    super("The Contact or Company is not available in this Workspace.");
    this.name = "FeedbackIdentityUnavailableError";
  }
}

/** The previewed plan no longer matches the Feedback; reopen the preview. */
export class FeedbackConversionStaleError extends Error {
  readonly code = "FEEDBACK_CONVERSION_STALE" as const;

  constructor(feedbackId: string) {
    super(`The Convert to Work preview of Feedback ${feedbackId} is stale.`);
    this.name = "FeedbackConversionStaleError";
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

    async setIdentity(accountId, input) {
      const parsed = setFeedbackIdentityInputSchema.parse(input);
      const record = await store.setIdentity(accountId, parsed);
      if (!record) {
        throw new FeedbackNotFoundError(parsed.feedbackId);
      }
      return record;
    },

    async previewConvertToWork(accountId, input) {
      const parsed = previewFeedbackWorkInputSchema.parse(input);
      const source = await store.readConversionSource(
        accountId,
        parsed.projectId,
        parsed.feedbackId,
      );
      if (!source) {
        throw new FeedbackNotFoundError(parsed.feedbackId);
      }
      return buildFeedbackWorkPlan(source, parsed.workType);
    },

    async convertToWork(accountId, input) {
      const parsed = convertFeedbackToWorkInputSchema.parse(input);
      const { plan } = parsed;
      const source = await store.readConversionSource(
        accountId,
        parsed.projectId,
        parsed.feedbackId,
      );
      if (!source) {
        throw new FeedbackNotFoundError(parsed.feedbackId);
      }
      // Only the exact previewed plan may be confirmed; a changed record is refused.
      if (
        plan.feedbackId !== parsed.feedbackId ||
        plan.projectId !== parsed.projectId ||
        !isSameFeedbackWorkPlan(
          plan,
          buildFeedbackWorkPlan(source, plan.work.type),
        )
      ) {
        throw new FeedbackConversionStaleError(parsed.feedbackId);
      }
      const conversion = await store.convertToWork(accountId, parsed);
      if (!conversion) {
        throw new FeedbackNotFoundError(parsed.feedbackId);
      }
      return conversion;
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
