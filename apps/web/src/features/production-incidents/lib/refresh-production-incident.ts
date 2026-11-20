import type { QueryClient } from "@tanstack/react-query";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";

export async function refreshProductionIncident(
  queryClient: QueryClient,
  projectId: string,
  incidentId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: orpc.productionIncidents.key({ input: { projectId } }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.productionIncidentDetail.key({
        input: { projectId, incidentId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.projectSourceRecord.key({
        input: { sourceId: incidentId, sourceType: "Production Incident" },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.projectSourceRecords.key({ input: { projectId } }),
    }),
    ...invalidateSmartCollectionMembership(queryClient),
  ]);
}
