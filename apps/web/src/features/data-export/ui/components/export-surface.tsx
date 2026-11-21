import { EXPORT_LABEL } from "@cantiara/api/data-export";
import { useQuery } from "@tanstack/react-query";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect } from "react";
import { orpc } from "@/utils/orpc";
import {
  useExportPreview,
  useExportProduce,
} from "../../hooks/use-export-requests";
import { takeExportHandoff } from "../../lib/export-handoff";
import { ExportView } from "../views/export-view";

/** Loads the closed catalog and the Projects an Export can be scoped to. */
export default function ExportSurface() {
  const catalog = useQuery(orpc.exportCatalog.queryOptions({ input: {} }));
  const projects = useQuery(orpc.projects.queryOptions());
  const preview = useExportPreview();
  const produce = useExportProduce();
  // A list screen's exact view, handed over once for this visit.
  const exportSession = useCreateStore<
    ReturnType<typeof takeExportHandoff> | undefined
  >(undefined);
  const handoff = useSelector(exportSession);
  useEffect(() => {
    if (exportSession.get() === undefined) {
      exportSession.setState(() => takeExportHandoff());
    }
  }, [exportSession]);

  if (
    catalog.status === "pending" ||
    projects.isPending ||
    handoff === undefined
  ) {
    return <p role="status">Loading {EXPORT_LABEL}…</p>;
  }
  if (catalog.isError || projects.isError || !catalog.data || !projects.data) {
    return <p role="alert">{EXPORT_LABEL} is unavailable.</p>;
  }
  return (
    <ExportView
      catalog={catalog.data}
      handoff={handoff}
      onPreview={preview}
      onProduce={produce}
      projects={projects.data.map(({ id, name }) => ({ id, name }))}
    />
  );
}
