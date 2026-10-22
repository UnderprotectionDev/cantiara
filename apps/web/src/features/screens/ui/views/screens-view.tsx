// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Screen and form field.
import {
  SCREEN_LIFECYCLE_ACTION_LABELS,
  type ScreenLifecycle,
  type ScreenLifecycleAction,
  type ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useState } from "react";
import type { ScreenTemplateActions } from "../../lib/screen-template-actions";
import type { CreateScreen } from "../forms/create-screen-form";
import { CreateScreenForm } from "../forms/create-screen-form";
import { CreateScreenFromTemplate } from "../forms/create-screen-from-template-form";
import { SaveAsTemplate } from "../forms/save-as-template-form";

export type SetScreenLifecycle = (
  screen: ScreenRecord,
  action: ScreenLifecycleAction,
) => Promise<unknown>;

const LIFECYCLE_ACTIONS: Record<ScreenLifecycle, ScreenLifecycleAction[]> = {
  Active: ["archive", "trash"],
  Archived: ["unarchive", "trash"],
  "In Trash": ["restore"],
};

const LIFECYCLE_SECTIONS: ScreenLifecycle[] = [
  "Active",
  "Archived",
  "In Trash",
];

export type RenderWireframe = (screen: ScreenRecord) => ReactNode;

function ScreenItem({
  onSetLifecycle,
  readOnly,
  renderWireframe,
  screen,
  templates,
}: {
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screen: ScreenRecord;
  templates?: ScreenTemplateActions;
}) {
  const [error, setError] = useState<string>();
  const [wireframeOpen, setWireframeOpen] = useState(false);
  async function run(action: ScreenLifecycleAction) {
    setError(undefined);
    try {
      await onSetLifecycle(screen, action);
    } catch {
      setError("Screen could not be updated. Reload and try again.");
    }
  }
  return (
    <li
      className="space-y-2 rounded-lg border border-border/70 p-4"
      id={`screen-${screen.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{screen.title}</h4>
        <span className="text-muted-foreground text-xs">
          {screen.lifecycle}
        </span>
      </div>
      {screen.wireframeVersions.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Wireframe:{" "}
          {screen.wireframeVersions
            .map(({ version }) => `v${version}`)
            .join(", ")}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {LIFECYCLE_ACTIONS[screen.lifecycle].map((action) => (
            <Button
              key={action}
              onClick={() => run(action)}
              size="sm"
              type="button"
              variant="outline"
            >
              {SCREEN_LIFECYCLE_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      )}
      {templates && !readOnly && screen.lifecycle !== "In Trash" ? (
        <SaveAsTemplate actions={templates} screen={screen} />
      ) : null}
      {renderWireframe && screen.lifecycle !== "In Trash" ? (
        <div className="space-y-3">
          <Button
            aria-expanded={wireframeOpen}
            onClick={() => setWireframeOpen((open) => !open)}
            size="sm"
            type="button"
            variant="outline"
          >
            {wireframeOpen ? "Close Wireframe" : "Open Wireframe"}
          </Button>
          {wireframeOpen ? renderWireframe(screen) : null}
        </div>
      ) : null}
    </li>
  );
}

export function ScreensView({
  onCreate,
  onSetLifecycle,
  readOnly,
  renderWireframe,
  screens,
  templates,
}: {
  onCreate: CreateScreen;
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screens: ScreenRecord[];
  templates?: ScreenTemplateActions;
}) {
  return (
    <section aria-label="Screens" className="space-y-6" id="screens">
      <h2 className="font-semibold text-lg">Screens</h2>
      {readOnly ? null : <CreateScreenForm onCreate={onCreate} />}
      {templates && !readOnly ? (
        <CreateScreenFromTemplate actions={templates} />
      ) : null}
      {LIFECYCLE_SECTIONS.map((lifecycle) => {
        const items = screens.filter((item) => item.lifecycle === lifecycle);
        if (lifecycle === "Archived" && items.length === 0) {
          return null;
        }
        const empty =
          lifecycle === "In Trash" ? "No Screens in Trash." : "No Screens yet.";
        return (
          <div className="space-y-3" key={lifecycle}>
            {lifecycle === "Active" ? null : (
              <h3 className="font-medium text-sm">{lifecycle}</h3>
            )}
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{empty}</p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <ScreenItem
                    key={item.id}
                    onSetLifecycle={onSetLifecycle}
                    readOnly={readOnly}
                    renderWireframe={renderWireframe}
                    screen={item}
                    templates={templates}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
