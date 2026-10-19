// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Screen and form field.
import {
  SCREEN_LIFECYCLE_ACTION_LABELS,
  type ScreenLifecycle,
  type ScreenLifecycleAction,
  type ScreenRecord,
} from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, type ReactNode, useState } from "react";

export type CreateScreen = (title: string) => Promise<unknown>;
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

function CreateScreenForm({ onCreate }: { onCreate: CreateScreen }) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      if (!value.title.trim()) {
        setError("Title is required.");
        return;
      }
      try {
        await onCreate(value.title);
        formApi.reset();
      } catch {
        setError("Screen could not be created.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Create Screen</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="title">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="screen-title">Title</label>
                  <Input
                    disabled={pending}
                    id="screen-title"
                    maxLength={255}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              Create Screen
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export type RenderWireframe = (screen: ScreenRecord) => ReactNode;

function ScreenItem({
  onSetLifecycle,
  readOnly,
  renderWireframe,
  screen,
}: {
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screen: ScreenRecord;
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
}: {
  onCreate: CreateScreen;
  onSetLifecycle: SetScreenLifecycle;
  readOnly: boolean;
  renderWireframe?: RenderWireframe;
  screens: ScreenRecord[];
}) {
  return (
    <section aria-label="Screens" className="space-y-6" id="screens">
      <h2 className="font-semibold text-lg">Screens</h2>
      {readOnly ? null : <CreateScreenForm onCreate={onCreate} />}
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
