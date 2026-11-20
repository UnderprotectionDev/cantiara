import {
  isSupportWriteOutcome,
  SUPPORT_FAILURE_MESSAGES,
  type SupportWriteOutcome,
} from "@cantiara/api/support-reference";
import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { defaultClientShell } from "../store/client-shell";

export interface SupportReferenceFailurePresenterOptions {
  kind: "mutation" | "query";
  retry?: () => Promise<unknown> | unknown;
  retryCount?: number;
  writeOutcome?: SupportWriteOutcome;
}

export type SupportReferenceFailurePresenter = (
  error: unknown,
  options: SupportReferenceFailurePresenterOptions,
) => unknown;

export function createClientShellQueryClient(
  presentSupportReferenceFailure: SupportReferenceFailurePresenter,
) {
  const mutationRetryCounts = new WeakMap<object, number>();

  return new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: "always",
        retry: false,
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
        defaultClientShell.assertWriteAllowed();
      },
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.presentsSupportFailure === true) {
          return;
        }
        const retryCount = mutationRetryCounts.get(mutation) ?? 0;
        const writeOutcome = isSupportWriteOutcome(mutation.meta?.writeOutcome)
          ? mutation.meta.writeOutcome
          : undefined;

        presentSupportReferenceFailure(error, {
          kind: "mutation",
          retry:
            retryCount > 0 || mutation.meta?.privateInput === true
              ? undefined
              : () => {
                  if (
                    mutation.state.status !== "error" ||
                    (mutationRetryCounts.get(mutation) ?? 0) !== retryCount
                  ) {
                    return;
                  }
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
