import { useQuery } from "@tanstack/react-query";

import { accountPreferencesQueryOptions, orpc } from "@/utils/orpc";

export function useProjectShellData(
  accountId: string | undefined,
  projectId: string,
) {
  const projectQuery = useQuery(
    orpc.project.queryOptions({ input: { projectId } }),
  );
  const scopeTreeQuery = useQuery(
    orpc.scopeTree.queryOptions({ input: { projectId } }),
  );
  const accountPreferencesQuery = useQuery(
    accountPreferencesQueryOptions(accountId),
  );

  return { accountPreferencesQuery, projectQuery, scopeTreeQuery };
}
