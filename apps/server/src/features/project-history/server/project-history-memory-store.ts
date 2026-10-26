import type { StoryTimelineFacts } from "@cantiara/api/project-history";

import type { ProjectHistorySources } from "./project-history";

/** Every story kind read and empty; tests override the kinds they care about. */
export function emptyStorySources(): StoryTimelineFacts["sources"] {
  const none = () => ({ available: true as const, value: [] });
  return {
    "Code change": none(),
    Decision: none(),
    Design: none(),
    Document: none(),
    "Lifecycle change": none(),
    Milestone: none(),
    "Production Incident": none(),
    "Project Release": none(),
    "Validation result": none(),
    Work: none(),
  };
}

/**
 * In-memory harness for the Project History seam. It holds one account's
 * Projects, their Work (to tell a Feature from other Work) and a fixture of
 * owner-record facts per Project and per Feature. Tests drive the real
 * behavior through it without a database.
 */
export function createMemoryProjectHistory(options: {
  accountId: string;
  features: Map<string, StoryTimelineFacts["sources"]>;
  projects: Map<
    string,
    {
      sources: StoryTimelineFacts["sources"];
      works: { id: string; key: string; title: string; type: string }[];
    }
  >;
}) {
  const sources: ProjectHistorySources = {
    read: (_accountId, scope) => {
      const facts =
        scope.kind === "Feature"
          ? options.features.get(scope.workId)
          : options.projects.get(scope.projectId)?.sources;
      if (!facts) {
        throw new Error("No fixture facts for this scope.");
      }
      return Promise.resolve(facts);
    },
    resolveScope: (accountId, input) => {
      const project = options.projects.get(input.projectId);
      if (accountId !== options.accountId || !project) {
        return Promise.resolve({ status: "project-not-found" });
      }
      if (input.scope === "Project") {
        return Promise.resolve({
          scope: { kind: "Project", projectId: input.projectId },
          status: "found",
        });
      }
      const work = project.works.find(
        (candidate) => candidate.id === input.workId,
      );
      if (!work) {
        return Promise.resolve({ status: "work-not-found" });
      }
      if (work.type !== "Feature") {
        return Promise.resolve({ status: "work-not-feature" });
      }
      return Promise.resolve({
        scope: {
          key: work.key,
          kind: "Feature",
          projectId: input.projectId,
          title: work.title,
          workId: work.id,
        },
        status: "found",
      });
    },
  };

  return { sources };
}
