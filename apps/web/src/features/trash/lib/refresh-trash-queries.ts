import { TRASH_RECORD_KINDS, type TrashRecordKind } from "@cantiara/api/trash";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

export async function refreshTrashQueries(
  queryClient: QueryClient,
  target: {
    projectId: string;
    recordKind: TrashRecordKind;
    recordId: string;
    groupId?: string | null;
  },
) {
  const { projectId, recordId, recordKind } = target;
  const project = { input: { projectId } };
  const keys: Record<TrashRecordKind, QueryKey[]> = {
    Work: [
      orpc.projectWorks.key(project),
      orpc.projectBacklog.key(project),
      orpc.work.key({ input: { workId: recordId } }),
      orpc.dailyFocusDay.key(),
      orpc.focusPeriods.key(),
    ],
    Document: [
      orpc.documents.key(project),
      orpc.document.key({ input: { documentId: recordId } }),
    ],
    Decision: [
      orpc.projectDecisions.key(project),
      orpc.projectSourceRecords.key(project),
    ],
    Risk: [
      orpc.projectRisks.key(project),
      orpc.projectSourceRecords.key(project),
    ],
    Screen: [orpc.projectScreens.key(project)],
    "External Surface": [orpc.listExternalSurfaces.key()],
    "Custom Field": [
      orpc.customFields.key(project),
      orpc.customFieldValues.key(project),
      orpc.customFieldProjectValues.key(project),
    ],
    "Smart Collection": [orpc.smartCollectionViews.key()],
    "Automation Rule": [orpc.workAutomationRules.key(project)],
    "Work Template": [orpc.workTemplates.key(project)],
    "Document Template": [orpc.documentTemplates.key(project)],
    "Record Action": [orpc.recordActions.key(project)],
    "Prioritization Session": [orpc.prioritizationSessions.key(project)],
    "GitHub External Record": [
      orpc.projectGitHubOverview.key(project),
      orpc.projectGitHubWorkLinks.key(project),
      orpc.searchGitHubRecords.key(project),
    ],
    "Test Session": [
      orpc.projectTestSessions.key(project),
      orpc.projectSessionTests.key(project),
      orpc.projectTestSummary.key(project),
    ],
  };
  const records = target.groupId
    ? TRASH_RECORD_KINDS.flatMap((kind) => keys[kind])
    : keys[recordKind];
  const affected = [
    ...records,
    orpc.trash.key(project),
    orpc.scopeTree.key(project),
    orpc.searchRecords.key(),
    orpc.workspaceOverview.key(),
    orpc.relations.key({ input: { recordId } }),
    orpc.usedIn.key({ input: { recordId } }),
  ];
  if (recordKind !== "External Surface") {
    affected.push(orpc.listExternalSurfaces.key());
  }
  await Promise.all([
    ...affected.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ...invalidateSmartCollectionMembership(queryClient),
  ]);
}
