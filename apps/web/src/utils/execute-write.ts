import type { QueryClient } from "@tanstack/react-query";

/** Runs an imperative write under the same Query policy as a form mutation. */
export function executeWrite<T, Variables>(
  queryClient: QueryClient,
  variables: Variables,
  write: (variables: Variables) => Promise<T>,
  onSettled: () => Promise<unknown>,
  retryInSurface = false,
) {
  const options = queryClient.defaultMutationOptions({
    meta: { onlineWrite: true, retryInSurface },
    mutationFn: write,
    onSettled,
    networkMode: "always",
    retry: false,
  });
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
