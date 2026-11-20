import type {
  DefaultError,
  QueryClient,
  QueryExecuteOptions,
  QueryKey,
} from "@tanstack/react-query";

/** Read current server data on demand while keeping the caller's cache retention. */
export function fetchFresh<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never,
>(
  client: QueryClient,
  options: QueryExecuteOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey,
    TPageParam
  >,
): Promise<TData> {
  return client.query({ ...options, staleTime: 0 });
}
