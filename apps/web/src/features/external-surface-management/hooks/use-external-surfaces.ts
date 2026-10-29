import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** The `Shares and Publications` directory of the Çalışma Alanı or one Project. */
export function useExternalSurfaces(projectId?: string) {
  return useQuery(
    orpc.listExternalSurfaces.queryOptions({ input: { projectId } }),
  );
}
