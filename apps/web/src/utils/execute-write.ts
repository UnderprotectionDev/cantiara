import type { QueryClient } from "@tanstack/react-query";

/** Runs an imperative write under the same Query policy as a form mutation. */
export function executeWrite<T, Variables>(
  queryClient: QueryClient,
  variables: Variables,
  write: (variables: Variables) => Promise<T>,
  onSettled: (
    data: T | undefined,
    error: unknown,
    variables: Variables,
  ) => Promise<unknown>,
  meta?: { presentsSupportFailure?: boolean; retryInSurface?: boolean },
) {
  const options = queryClient.defaultMutationOptions({
    meta: { ...meta, onlineWrite: true },
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
