import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

const HEALTH_CHECK_RETRY_COUNT = 8;
const HEALTH_CHECK_RETRY_DELAY_BASE_MS = 250;
const HEALTH_CHECK_RETRY_DELAY_MAX_MS = 2000;

function healthCheckRetryDelay(attemptIndex: number) {
  return Math.min(
    HEALTH_CHECK_RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
    HEALTH_CHECK_RETRY_DELAY_MAX_MS,
  );
}

export function useClientShellHealthCheck() {
  return useQuery({
    ...orpc.healthCheck.queryOptions(),
    retry: HEALTH_CHECK_RETRY_COUNT,
    retryDelay: healthCheckRetryDelay,
  });
}
