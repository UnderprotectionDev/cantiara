// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen Screen versions.
import type { ScreenRecord } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { screensOutputFormSchema } from "../../lib/screen-forms";

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
  function chosenFrom(picked: Record<string, number>): ChosenVersion[] {
    const parsed = screensOutputFormSchema.safeParse({ picked });
    if (!parsed.success) {
      return [];
    }
    return candidates
      .filter((screen) => parsed.data.picked[screen.id] !== undefined)
      .map((screen) => ({
        screenId: screen.id,
        version: parsed.data.picked[screen.id] as number,
      }));
  }
  const form = useForm({
    defaultValues: { picked: {} as Record<string, number> },
    onSubmit: ({ value }) => {
      const chosen = chosenFrom(value.picked);
      if (chosen.length > 0) {
        onPresent(chosen, chosen[0]?.screenId ?? "");
      }
    },
  });

  if (candidates.length === 0) {
    return null;
  }
  return (
    <form
      aria-label="Presentation and Export"
      className="space-y-3 rounded-lg border border-border/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">Presentation and Export</h3>
      <form.Field name="picked">
        {(field) => {
          const picked = field.state.value;
          return (
            <ul className="space-y-1 text-sm">
              {candidates.map((screen) => (
                <li
                  className="flex flex-wrap items-center gap-2"
                  key={screen.id}
                >
                  <label
                    className="flex items-center gap-2"
                    htmlFor={`screens-output-${screen.id}`}
                  >
                    <Checkbox
                      checked={picked[screen.id] !== undefined}
                      id={`screens-output-${screen.id}`}
                      onCheckedChange={(checked) => {
                        const next = { ...picked };
                        if (checked) {
                          next[screen.id] = latestVersionOf(screen);
                        } else {
                          delete next[screen.id];
                        }
                        field.handleChange(next);
                      }}
                    />
                    {screen.title}
                  </label>
                  {picked[screen.id] === undefined ? null : (
                    <NativeSelect
                      aria-label={`Wireframe version of ${screen.title}`}
                      onChange={(event) =>
                        field.handleChange({
                          ...picked,
                          [screen.id]: Number(event.target.value),
                        })
                      }
                      value={picked[screen.id]}
                    >
                      {screen.wireframeVersions.map(({ version }) => (
                        <NativeSelectOption key={version} value={version}>
                          v{version}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.values.picked}>
        {(picked) => {
          const none = busy || chosenFrom(picked).length === 0;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={none} size="sm" type="submit">
                Presentation Mode
              </Button>
              <span className="text-muted-foreground text-xs">Export</span>
              {EXPORT_FORMATS.map((format) => (
                <Button
                  disabled={none}
                  key={format}
                  onClick={() => onExport(format, chosenFrom(picked))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {format}
                </Button>
              ))}
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
