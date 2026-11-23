// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Screen and form field.

import {
  SCREEN_LIFECYCLE_ACTION_LABELS,
  type ScreenLifecycle,
  type ScreenLifecycleAction,
  type ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
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

interface LifecycleWriteState {
  failed: boolean;
  pending: boolean;
  screenId?: string;
}

function ScreenItem({
  lifecycleWrite,
  onWireframeOpenChange,
  onSetLifecycle,
  readOnly,
  renderWireframe,
  screen,
  templates,
  rowProps,
}: {
  lifecycleWrite?: LifecycleWriteState;
  onWireframeOpenChange: (id: string, open: boolean) => void;
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screen: ScreenRecord;
  templates?: ScreenTemplateActions;
  rowProps?: VirtualRowProps;
}) {
  return (
    <li
      {...rowProps}
      className="space-y-2 rounded-lg border border-border/70 p-4"
      id={`screen-${screen.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{screen.title}</h4>
        <span className="text-xs text-muted-foreground">
          {screen.lifecycle}
        </span>
      </div>
      {screen.wireframeVersions.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Wireframe:{" "}
          {screen.wireframeVersions
            .map(({ version }) => `v${version}`)
            .join(", ")}
        </p>
      ) : null}
      {lifecycleWrite?.failed && lifecycleWrite.screenId === screen.id ? (
        <p className="text-sm text-destructive" role="alert">
          Screen could not be updated. Reload and try again.
        </p>
      ) : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {LIFECYCLE_ACTIONS[screen.lifecycle].map((action) => (
            <Button
              disabled={lifecycleWrite?.pending}
              key={action}
              onClick={() =>
                onSetLifecycle(screen, action).catch(() => undefined)
              }
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
        <Collapsible
          className="space-y-3"
          onOpenChange={(open) => onWireframeOpenChange(screen.id, open)}
        >
          <CollapsibleTrigger
            render={(props, { open }) => (
              <Button {...props} size="sm" variant="outline">
                {open ? "Close Wireframe" : "Open Wireframe"}
              </Button>
            )}
          />
          <CollapsibleContent>{renderWireframe(screen)}</CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  );
}

export function ScreensView({
  lifecycleWrite,
  onCreate,
  onSetLifecycle,
  readOnly,
  renderWireframe,
  screens,
  templates,
}: {
  lifecycleWrite?: LifecycleWriteState;
  onCreate: CreateScreen;
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screens: ScreenRecord[];
  templates?: ScreenTemplateActions;
}) {
  const wireframePanels = useCreateStore<readonly string[]>([]);
  const openWireframes = useSelector(wireframePanels);
  function onWireframeOpenChange(id: string, open: boolean) {
    wireframePanels.setState((current) =>
      open
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  }
  return (
    <section aria-label="Screens" className="space-y-6" id="screens">
      <h2 className="text-lg font-semibold">Screens</h2>
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
              <h3 className="text-sm font-medium">{lifecycle}</h3>
            )}
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{empty}</p>
            ) : (
              <VirtualList
                className="space-y-3"
                estimateSize={110}
                gap={8}
                getKey={virtualRowId}
                keepMounted={openWireframes}
                rows={items}
              >
                {(item, rowProps) => (
                  <ScreenItem
                    lifecycleWrite={lifecycleWrite}
                    onSetLifecycle={onSetLifecycle}
                    onWireframeOpenChange={onWireframeOpenChange}
                    readOnly={readOnly}
                    renderWireframe={renderWireframe}
                    rowProps={rowProps}
                    screen={item}
                    templates={templates}
                  />
                )}
              </VirtualList>
            )}
          </div>
        );
      })}
    </section>
  );
}
