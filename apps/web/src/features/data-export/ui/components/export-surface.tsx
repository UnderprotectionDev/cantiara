import { EXPORT_LABEL } from "@cantiara/api/data-export";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  useExportPreview,
  useExportProduce,
} from "../../hooks/use-export-requests";
import { ExportView } from "../views/export-view";

/** Loads the closed catalog and the Projects an Export can be scoped to. */
export default function ExportSurface() {
  const catalog = useQuery(orpc.exportCatalog.queryOptions({ input: {} }));
  const projects = useQuery(orpc.projects.queryOptions());
  const preview = useExportPreview();
  const produce = useExportProduce();

  if (catalog.isPending || projects.isPending) {
    return <p role="status">Loading {EXPORT_LABEL}…</p>;
  }
  if (catalog.isError || projects.isError || !catalog.data || !projects.data) {
    return <p role="alert">{EXPORT_LABEL} is unavailable.</p>;
  }
  return (
    <ExportView
      catalog={catalog.data}
      onPreview={preview}
      onProduce={produce}
      projects={projects.data.map(({ id, name }) => ({ id, name }))}
    />
  );
}
