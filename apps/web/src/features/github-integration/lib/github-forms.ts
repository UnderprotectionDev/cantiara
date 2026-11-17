import {
  GITHUB_REPOSITORY_LABEL,
  gitHubLinkRepositoryInputSchema,
  gitHubSearchRecordsInputSchema,
} from "@cantiara/api/github-integration";
import {
  GITHUB_ROLE_CONTEXTUAL_LABEL,
  gitHubCreateWorkInputSchema,
  gitHubCreateWorkPreviewInputSchema,
  gitHubLinkWorkInputSchema,
} from "@cantiara/api/github-work-links";

/** The Link Work form value: a record pick, or a Commit or Branch reference. */
export type LinkWorkValues =
  | { recordId: string; role: string; target: "record"; workId: string }
  | {
      linkId: string;
      reference: string;
      role: string;
      target: "Branch" | "Commit";
      workId: string;
    };

export function linkWorkTargetOf(values: LinkWorkValues) {
  if (values.target === "record") {
    return { kind: "record" as const, recordId: values.recordId };
  }
  if (values.target === "Commit") {
    return {
      kind: "Commit" as const,
      linkId: values.linkId,
      sha: values.reference,
    };
  }
  return {
    kind: "Branch" as const,
    linkId: values.linkId,
    name: values.reference,
  };
}

const linkRepositoryFormSchema = gitHubLinkRepositoryInputSchema.omit({
  projectId: true,
});
const linkWorkFormSchema = gitHubLinkWorkInputSchema.omit({ projectId: true });
const createWorkFormSchema = gitHubCreateWorkInputSchema.omit({
  projectId: true,
});
const previewCreateWorkFormSchema = gitHubCreateWorkPreviewInputSchema.omit({
  projectId: true,
});
const searchFormSchema = gitHubSearchRecordsInputSchema.omit({
  projectId: true,
});

type Parsed<T> = { data: T; ok: true } | { message: string; ok: false };

/** Link Repository: validated with the procedure's input schema (minus the Project). */
export function parseLinkRepository(value: {
  installationId: string;
  repositoryId: string;
}): Parsed<{ installationId: number; repositoryId: number }> {
  const result = linkRepositoryFormSchema.safeParse(
    {
      installationId: Number(value.installationId),
      repositoryId: Number(value.repositoryId),
    },
    { error: () => `Choose a ${GITHUB_REPOSITORY_LABEL}.` },
  );
  return result.success
    ? { data: result.data, ok: true }
    : {
        message:
          result.error.issues[0]?.message ??
          `Choose a ${GITHUB_REPOSITORY_LABEL}.`,
        ok: false,
      };
}

/** Link Work: the shown message names what is missing for the chosen target. */
export function parseLinkWork(values: LinkWorkValues): Parsed<LinkWorkValues> {
  const result = linkWorkFormSchema.safeParse(
    {
      role: values.role,
      target: linkWorkTargetOf(values),
      workId: values.workId,
    },
    {
      error: (issue) => {
        const path = issue.path ?? [];
        if (path[0] === "workId") {
          return "Choose a Work.";
        }
        if (path[0] === "target" && values.target === "record") {
          return "Choose a GitHub record.";
        }
        if (path[0] === "target") {
          return `Enter the ${values.target.toLowerCase()}.`;
        }
      },
    },
  );
  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "The link was not made.",
      ok: false,
    };
  }
  return {
    data:
      values.target === "record"
        ? values
        : {
            ...values,
            reference: values.reference.trim(),
            role: GITHUB_ROLE_CONTEXTUAL_LABEL,
          },
    ok: true,
  };
}

/** `Create work and link` draft: trimmed title is required. */
export function parseCreateWork(value: {
  description: string;
  recordId: string;
  title: string;
  type: string;
}): Parsed<{
  description: string;
  recordId: string;
  title: string;
  type: (typeof createWorkFormSchema)["_output"]["type"];
}> {
  const result = createWorkFormSchema.safeParse(value, {
    error: (issue) =>
      issue.path?.[0] === "title" ? "Enter a title." : undefined,
  });
  return result.success
    ? { data: result.data, ok: true }
    : {
        message: result.error.issues[0]?.message ?? "Enter a title.",
        ok: false,
      };
}

/**
 * Record search: the query is trimmed and capped by the procedure's schema.
 * The input carries the same cap (`GITHUB_SEARCH_QUERY_MAX_LENGTH`), so a
 * failure here is unreachable from the UI and has no copy.
 */
export function parseSearchGitHubRecords(value: {
  query: string;
}): { data: { query: string }; ok: true } | { ok: false } {
  const result = searchFormSchema.safeParse(value);
  return result.success ? { data: result.data, ok: true } : { ok: false };
}

export const GITHUB_SEARCH_QUERY_MAX_LENGTH = 200;

/** Preview Work draft: an Issue must be picked. */
export function parsePreviewCreateWork(value: {
  recordId: string;
}): Parsed<{ recordId: string }> {
  const result = previewCreateWorkFormSchema.safeParse(value, {
    error: () => "Choose an Issue.",
  });
  return result.success
    ? { data: result.data, ok: true }
    : {
        message: result.error.issues[0]?.message ?? "Choose an Issue.",
        ok: false,
      };
}
