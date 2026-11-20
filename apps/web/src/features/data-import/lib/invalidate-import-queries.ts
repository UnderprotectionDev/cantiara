import type { ImportReceipt, ImportScope } from "@cantiara/api/data-import";
import type { Document } from "@cantiara/api/documents";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

export async function invalidateImportQueries(
  queryClient: QueryClient,
  receipt: ImportReceipt,
  scope: ImportScope,
) {
  if (!(receipt.counts.created || receipt.counts.updated)) {
    return;
  }
  const projectId = scope.kind === "project" ? scope.projectId : null;
  const project = { input: { projectId: projectId ?? "" } };
  const work: (readonly unknown[])[] = [
    orpc.projectWorks.queryKey(project),
    orpc.projectBacklog.queryKey(project),
  ];
  if (receipt.counts.updated > 0 && projectId) {
    work.push(
      ...queryClient
        .getQueriesData<WorkProfile>({ queryKey: orpc.work.key() })
        .filter(([, record]) => record?.projectId === projectId)
        .map(([queryKey]) => queryKey),
    );
  }
  const source = orpc.projectSourceRecords.queryKey(project);
  const catalog = {
    Assumption: [source, orpc.projectAssumptions.queryKey(project)],
    Bug: work,
    Company: [orpc.companies.key(), orpc.contacts.key()],
    Contact: [orpc.contacts.key()],
    Decision: [source, orpc.projectDecisions.queryKey(project)],
    "Experiment/Validation": [orpc.projectValidationRecords.queryKey(project)],
    Feature: work,
    Feedback: [orpc.projectFeedback.queryKey(project)],
    Improvement: work,
    Milestone: [orpc.projectMilestones.queryKey(project)],
    "Open Question": [orpc.openQuestions.queryKey(project)],
    "Product Gap": [orpc.productGaps.key()],
    "Production Incident": [orpc.productionIncidents.queryKey(project)],
    "Project Goal": [orpc.projectGoals.queryKey(project)],
    "Project Release": [orpc.projectReleases.queryKey(project)],
    Research: work,
    Risk: [source, orpc.projectRisks.queryKey(project)],
    "Source metadata only": [orpc.projectSources.queryKey(project)],
    Task: work,
    "User Research Session": [orpc.projectResearchSessions.queryKey(project)],
  };
  const records = receipt.catalogType
    ? catalog[receipt.catalogType]
    : [orpc.documents.queryKey({ input: { projectId } })];
  const updatedDocuments =
    !receipt.catalogType && receipt.counts.updated > 0
      ? queryClient
          .getQueriesData<Document>({ queryKey: orpc.document.key() })
          .flatMap(([queryKey, document]) =>
            document?.projectId === projectId
              ? [
                  queryKey,
                  orpc.documentVersions.queryKey({
                    input: { documentId: document.id },
                  }),
                ]
              : [],
          )
      : [];

  await Promise.all([
    ...[...records, ...updatedDocuments].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
    queryClient.invalidateQueries({ queryKey: orpc.searchRecords.key() }),
    ...(projectId
      ? [
          queryClient.invalidateQueries({
            queryKey: orpc.scopeTree.queryKey({ input: { projectId } }),
          }),
        ]
      : []),
    ...invalidateSmartCollectionMembership(queryClient),
  ]);
}
