// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen Screen versions.
import type { ScreenRecord } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

export const EXPORT_FORMATS = ["PNG", "SVG", "PDF", "HTML"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ChosenVersion {
  screenId: string;
  version: number;
}

function latestVersionOf(screen: ScreenRecord): number {
  return Math.max(0, ...screen.wireframeVersions.map(({ version }) => version));
}

/**
 * Chooses Screens and the exact Wireframe version of each, then starts
 * Presentation Mode or an export. Choosing never edits a Screen or Wireframe.
 */
export function ScreensOutputPanel({
  busy,
  error,
  onExport,
  onPresent,
  screens,
}: {
  busy: boolean;
  error?: string;
  onExport: (format: ExportFormat, chosen: ChosenVersion[]) => void;
  onPresent: (chosen: ChosenVersion[], startScreenId: string) => void;
  screens: ScreenRecord[];
}) {
  const candidates = screens.filter(
    (screen) =>
      screen.lifecycle !== "In Trash" && screen.wireframeVersions.length > 0,
  );
  const [picked, setPicked] = useState<Record<string, number>>({});
  const chosen = candidates
    .filter((screen) => picked[screen.id] !== undefined)
    .map((screen) => ({
      screenId: screen.id,
      version: picked[screen.id] as number,
    }));

  function toggle(screen: ScreenRecord, checked: boolean) {
    setPicked((previous) => {
      const next = { ...previous };
      if (checked) {
        next[screen.id] = latestVersionOf(screen);
      } else {
        delete next[screen.id];
      }
      return next;
    });
  }

  if (candidates.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Presentation and Export"
      className="space-y-3 rounded-lg border border-border/70 p-4"
    >
      <h3 className="font-medium">Presentation and Export</h3>
      <ul className="space-y-1 text-sm">
        {candidates.map((screen) => (
          <li className="flex flex-wrap items-center gap-2" key={screen.id}>
            <label className="flex items-center gap-2">
              <input
                checked={picked[screen.id] !== undefined}
                onChange={(event) => toggle(screen, event.target.checked)}
                type="checkbox"
              />
              {screen.title}
            </label>
            {picked[screen.id] === undefined ? null : (
              <select
                aria-label={`Wireframe version of ${screen.title}`}
                onChange={(event) =>
                  setPicked((previous) => ({
                    ...previous,
                    [screen.id]: Number(event.target.value),
                  }))
                }
                value={picked[screen.id]}
              >
                {screen.wireframeVersions.map(({ version }) => (
                  <option key={version} value={version}>
                    v{version}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || chosen.length === 0}
          onClick={() => onPresent(chosen, chosen[0]?.screenId ?? "")}
          size="sm"
          type="button"
        >
          Presentation Mode
        </Button>
        <span className="text-muted-foreground text-xs">Export</span>
        {EXPORT_FORMATS.map((format) => (
          <Button
            disabled={busy || chosen.length === 0}
            key={format}
            onClick={() => onExport(format, chosen)}
            size="sm"
            type="button"
            variant="outline"
          >
            {format}
          </Button>
        ))}
      </div>
    </section>
  );
}
