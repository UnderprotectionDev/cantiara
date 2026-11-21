import type { QueryClient } from "@tanstack/react-query";

export function isPopupCommandPending(
  queryClient: QueryClient,
  popupId: string,
) {
  return (
    queryClient.isMutating({
      predicate: (mutation) => mutation.meta?.popupId === popupId,
    }) > 0
  );
}
