import {
  type MutateOptions,
  type UseMutationOptions,
  useMutation,
} from "@tanstack/react-query";
import { commandVariables } from "./command-variables";

/** Prepare the complete RPC input at submission, including any captured revision. */
export function usePreparedMutation<
  TData,
  TError,
  TVariables extends { clientIdempotencyKey: string },
  TContext,
  TInput,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  prepare: (input: TInput) => Omit<TVariables, "clientIdempotencyKey">,
) {
  const mutation = useMutation({
    ...options,
    meta: { ...options.meta, onlineWrite: true },
  });

  function variables(input: TInput) {
    return commandVariables(
      prepare(input),
      mutation.isError ? mutation.variables : undefined,
    ) as TVariables;
  }

  return {
    ...mutation,
    mutate(
      input: TInput,
      callbacks?: MutateOptions<TData, TError, TVariables, TContext>,
    ) {
      mutation.mutate(
        ...([variables(input), callbacks] as Parameters<
          typeof mutation.mutate
        >),
      );
    },
    async mutateAsync(
      input: TInput,
      callbacks?: MutateOptions<TData, TError, TVariables, TContext>,
    ) {
      return await mutation.mutateAsync(
        ...([variables(input), callbacks] as Parameters<
          typeof mutation.mutateAsync
        >),
      );
    },
  };
}
