import {
  COMPLETION_EFFECT_CATALOG,
  type CompletionEffectsPreferences,
  type CompletionEffectsPreferencesSnapshot,
  type CompletionEffectTheme,
} from "@cantiara/api/completion-effects";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@cantiara/ui/components/field";
import { Switch } from "@cantiara/ui/components/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { client, completionEffectsPreferencesQueryOptions } from "@/utils/orpc";
import {
  COMPLETION_EFFECT_MOTION_DESCRIPTIONS,
  COMPLETION_EFFECT_PALETTE_COLORS,
  COMPLETION_EFFECT_PREVIEW_DURATION_MS,
  COMPLETION_EFFECT_THEME_DESCRIPTIONS,
} from "../../lib/completion-effects-presentation";
import CompletionEffectSpecimen from "../components/completion-effect-specimen";

function valuesFromSnapshot(
  snapshot: CompletionEffectsPreferencesSnapshot,
): CompletionEffectsPreferences {
  return {
    enabled: snapshot.enabled,
    palette: snapshot.palette,
    theme: snapshot.theme,
  };
}

function preferencesEqual(
  left: CompletionEffectsPreferences,
  right: CompletionEffectsPreferences,
) {
  return (
    left.enabled === right.enabled &&
    left.palette === right.palette &&
    left.theme === right.theme
  );
}

function getSaveErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data &&
    error.data.code === "STALE_BASE_REVISION"
  ) {
    return "This page is out of date. Refresh to load the current value.";
  }
  return "Completion effects could not be saved. Refresh to try again.";
}

export default function CompletionEffectsForm({
  accountId,
  snapshot,
}: {
  accountId: string;
  snapshot: CompletionEffectsPreferencesSnapshot;
}) {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState(() =>
    valuesFromSnapshot(snapshot),
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePreferences = useMutation({
    mutationFn: (nextPreferences: CompletionEffectsPreferences) =>
      client.saveCompletionEffectsPreferences({
        baseRevision: snapshot.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        preferences: nextPreferences,
      }),
    onError(error) {
      setSaveError(getSaveErrorMessage(error));
    },
    onSuccess(savedSnapshot) {
      setPreferences(valuesFromSnapshot(savedSnapshot));
      setSaveError(null);
      queryClient.setQueryData(
        completionEffectsPreferencesQueryOptions(accountId).queryKey,
        savedSnapshot,
      );
    },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(
    () => () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    },
    [],
  );

  const isDirty = !preferencesEqual(preferences, valuesFromSnapshot(snapshot));

  function setEnabled(enabled: boolean) {
    setPreferences((current) => ({ ...current, enabled }));
    setSaveError(null);
  }

  function selectTheme(event: MouseEvent<HTMLButtonElement>) {
    const theme = event.currentTarget.value as CompletionEffectTheme;
    setPreferences((current) => ({
      ...current,
      palette:
        theme === current.theme
          ? current.palette
          : COMPLETION_EFFECT_CATALOG[theme][0],
      theme,
    }));
    setSaveError(null);
  }

  function selectPalette(event: MouseEvent<HTMLButtonElement>) {
    const palette = event.currentTarget
      .value as CompletionEffectsPreferences["palette"];
    setPreferences((current) => ({ ...current, palette }));
    setSaveError(null);
  }

  function preview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }
    setPreviewStatus(null);
    if (prefersReducedMotion) {
      setPreviewing(false);
      setPreviewStatus(
        `Static sample shown. ${COMPLETION_EFFECT_MOTION_DESCRIPTIONS[preferences.theme]}`,
      );
      return;
    }

    setPreviewing(true);
    previewTimer.current = setTimeout(() => {
      setPreviewing(false);
      setPreviewStatus("Preview finished.");
      previewTimer.current = null;
    }, COMPLETION_EFFECT_PREVIEW_DURATION_MS);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDirty && !savePreferences.isPending) {
      savePreferences.mutate(preferences);
    }
  }

  const hasSaved = !isDirty && savePreferences.isSuccess;

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)]"
      onSubmit={save}
    >
      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-5">
            <div className="max-w-lg">
              <h2 className="font-medium text-base">Enable</h2>
              <p className="mt-1 text-muted-foreground text-sm/6">
                Show a brief celebration when you complete Work. This choice
                applies across every Project.
              </p>
            </div>
            <Switch
              aria-label="Enable"
              checked={preferences.enabled}
              disabled={savePreferences.isPending}
              onCheckedChange={setEnabled}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Theme</FieldLegend>
            <FieldDescription>
              Choose one original theme for all of your Projects.
            </FieldDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.keys(COMPLETION_EFFECT_CATALOG).map((themeName) => {
                const theme = themeName as CompletionEffectTheme;
                const selected = preferences.theme === theme;
                return (
                  <button
                    aria-pressed={selected}
                    className={`group min-h-24 rounded-md border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${
                      selected
                        ? "border-foreground/50 bg-muted/70"
                        : "border-border/70 bg-background hover:border-foreground/25 hover:bg-muted/35"
                    }`}
                    disabled={savePreferences.isPending}
                    key={theme}
                    onClick={selectTheme}
                    type="button"
                    value={theme}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{theme}</span>
                      {selected ? (
                        <Check
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 block text-muted-foreground text-xs/5">
                      {COMPLETION_EFFECT_THEME_DESCRIPTIONS[theme]}
                    </span>
                  </button>
                );
              })}
            </div>
          </FieldSet>
        </section>

        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Palette</FieldLegend>
            <FieldDescription>
              Select one of the four palettes made for {preferences.theme}.
            </FieldDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMPLETION_EFFECT_CATALOG[preferences.theme].map((palette) => {
                const selected = preferences.palette === palette;
                return (
                  <button
                    aria-pressed={selected}
                    className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${
                      selected
                        ? "border-foreground/50 bg-muted/70"
                        : "border-border/70 bg-background hover:border-foreground/25 hover:bg-muted/35"
                    }`}
                    disabled={savePreferences.isPending}
                    key={palette}
                    onClick={selectPalette}
                    type="button"
                    value={palette}
                  >
                    <span className="font-medium text-sm">{palette}</span>
                    <span
                      aria-hidden="true"
                      className="flex shrink-0 -space-x-1"
                    >
                      {COMPLETION_EFFECT_PALETTE_COLORS[palette].map(
                        (color) => (
                          <span
                            className="size-4 rounded-full border border-background"
                            key={color}
                            style={{ backgroundColor: color }}
                          />
                        ),
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </FieldSet>
        </section>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-5 sm:p-6 xl:sticky xl:top-6 xl:self-start">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-base">Example</h2>
            <p className="mt-1 text-muted-foreground text-xs">
              {preferences.theme} · {preferences.palette}
            </p>
          </div>
          <Badge variant="outline">Experimental</Badge>
        </header>
        <CompletionEffectSpecimen
          palette={preferences.palette}
          previewing={previewing}
          theme={preferences.theme}
        />
        <p className="min-h-10 text-muted-foreground text-sm/5">
          Samples stay still while you browse. Motion starts only when you
          choose Preview.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={preview} type="button" variant="outline">
            <Sparkles aria-hidden="true" />
            Preview
          </Button>
          {prefersReducedMotion ? (
            <span className="max-w-52 text-muted-foreground text-xs/5">
              Reduce Motion is on. Preview stays still.
            </span>
          ) : null}
        </div>
        <div
          aria-live="polite"
          className="min-h-5 text-muted-foreground text-xs"
          role="status"
        >
          {previewStatus}
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between xl:col-start-1">
        <div className="min-h-5">
          {saveError ? (
            <p className="text-destructive text-sm" role="alert">
              {saveError}
            </p>
          ) : null}
          {!saveError && hasSaved ? (
            <p
              className="flex items-center gap-1.5 text-muted-foreground text-xs"
              role="status"
            >
              <Check aria-hidden="true" className="size-3.5 text-primary" />
              Completion effects saved.
            </p>
          ) : null}
        </div>
        <Button disabled={!isDirty || savePreferences.isPending} type="submit">
          {savePreferences.isPending ? "Saving…" : "Save"}
        </Button>
      </footer>
    </form>
  );
}
