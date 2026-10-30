// biome-ignore-all lint/performance/noJsxPropsBind: The click handler closes over this list's describe().

import { EXPORT_LABEL } from "@cantiara/api/data-export";
import { Button } from "@cantiara/ui/components/button";
import {
  type ExportHandoff,
  setExportHandoff,
} from "@/features/data-export/lib/export-handoff";

/**
 * The `Export` action of a supported list screen. It opens the Export surface
 * with the exact on-screen scope; the founder still reviews the preview before
 * anything is produced.
 */
export function ExportListAction({
  describe,
  label,
}: {
  /** Builds the handoff at click time so it reflects the current screen. */
  describe: () => ExportHandoff;
  /** Names the list for assistive technology, for example "Backlog". */
  label: string;
}) {
  return (
    <Button
      aria-label={`${EXPORT_LABEL} ${label}`}
      onClick={() => {
        setExportHandoff(describe());
        // A page load keeps this action independent of any router context; the
        // handoff survives it in session storage.
        window.location.assign("/export");
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {EXPORT_LABEL}
    </Button>
  );
}
