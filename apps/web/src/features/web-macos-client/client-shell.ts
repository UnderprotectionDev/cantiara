import {
  isSupportWriteOutcome,
  SUPPORT_FAILURE_MESSAGES,
} from "@cantiara/api/support-reference";
import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";

import { presentSupportReferenceFailure } from "./views/support-reference";

export function createClientShellQueryClient() {
  const mutationRetryCounts = new WeakMap<object, number>();

  return new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: "always",
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        presentSupportReferenceFailure(error, {
          kind: "query",
        });
      },
    }),
    mutationCache: new MutationCache({
      onMutate: () => {
        if (!onlineManager.isOnline()) {
          throw new Error(SUPPORT_FAILURE_MESSAGES.offline);
        }
      },
      onError: (error, _variables, _onMutateResult, mutation) => {
        const retryCount = mutationRetryCounts.get(mutation) ?? 0;
        const writeOutcome = isSupportWriteOutcome(mutation.meta?.writeOutcome)
          ? mutation.meta.writeOutcome
          : undefined;

        presentSupportReferenceFailure(error, {
          kind: "mutation",
          retry: () => {
            mutationRetryCounts.set(mutation, retryCount + 1);
            return mutation.execute(mutation.state.variables);
          },
          retryCount,
          writeOutcome,
        });
      },
      onSuccess: (_data, _variables, _onMutateResult, mutation) => {
        mutationRetryCounts.delete(mutation);
      },
    }),
  });
}
