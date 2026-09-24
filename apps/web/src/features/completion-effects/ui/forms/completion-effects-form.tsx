import {
  COMPLETION_EFFECT_CATALOG,
  type CompletionEffectsPreferences,
  type CompletionEffectsPreferencesSnapshot,
  type CompletionEffectTheme,
  completionEffectsPreferencesSchema,
} from "@cantiara/api/completion-effects";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@cantiara/ui/components/field";
import { Switch } from "@cantiara/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { STALE_BASE_REVISION_MESSAGE } from "@/lib/mutation-messages";
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

function selectPreferences(state: { values: CompletionEffectsPreferences }) {
  return state.values;
}

function selectFormSaveState(state: {
  isDirty: boolean;
  isSubmitting: boolean;
}) {
  return { isDirty: state.isDirty, isSubmitting: state.isSubmitting };
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
    return STALE_BASE_REVISION_MESSAGE;
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
  const formBaseRevision = useRef(snapshot.revision);
  const latestSavedAt = useRef<string | null>(null);
  const pendingSave = useRef<{
    baseRevision: number;
    clientIdempotencyKey: string;
    values: string;
  } | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePreferences = useMutation({
    mutationFn: (input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      preferences: CompletionEffectsPreferences;
    }) => client.saveCompletionEffectsPreferences(input),
    onError(error) {
      setHasSaved(false);
      setSaveError(getSaveErrorMessage(error));
    },
    onSuccess(savedSnapshot) {
      formBaseRevision.current = savedSnapshot.revision;
      latestSavedAt.current = savedSnapshot.savedAt;
      pendingSave.current = null;
      setHasSaved(true);
      setSaveError(null);
      queryClient.setQueryData(
        completionEffectsPreferencesQueryOptions(accountId).queryKey,
        savedSnapshot,
      );
    },
  });

  const form = useForm({
    defaultValues: valuesFromSnapshot(snapshot),
    onSubmit: async ({ value }) => {
      const preferences = completionEffectsPreferencesSchema.parse(value);
      const serialized = JSON.stringify(preferences);
      const baseRevision = formBaseRevision.current;
      const attempt = pendingSave.current;
      const clientIdempotencyKey =
        attempt?.baseRevision === baseRevision && attempt.values === serialized
          ? attempt.clientIdempotencyKey
          : crypto.randomUUID();
      pendingSave.current = {
        baseRevision,
        clientIdempotencyKey,
        values: serialized,
      };
      const savedSnapshot = await savePreferences.mutateAsync({
        baseRevision,
        clientIdempotencyKey,
        preferences,
      });
      latestSavedAt.current = null;
      formBaseRevision.current = savedSnapshot.revision;
      form.reset(valuesFromSnapshot(savedSnapshot));
    },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const values = valuesFromSnapshot(snapshot);
    if (
      latestSavedAt.current !== null &&
      latestSavedAt.current === snapshot.savedAt
    ) {
      latestSavedAt.current = null;
      formBaseRevision.current = snapshot.revision;
      form.reset(values);
    } else if (!form.state.isDirty) {
      formBaseRevision.current = snapshot.revision;
      form.reset(values);
    }
  }, [form, snapshot]);

  useEffect(
    () => () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    },
    [],
  );

  function stopPreview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewing(false);
    setPreviewStatus(null);
  }

  function selectTheme(event: MouseEvent<HTMLButtonElement>) {
    const theme = event.currentTarget.value as CompletionEffectTheme;
    stopPreview();
    if (theme !== form.state.values.theme) {
      form.setFieldValue("palette", COMPLETION_EFFECT_CATALOG[theme][0]);
    }
    form.setFieldValue("theme", theme);
    savePreferences.reset();
    setHasSaved(false);
    setSaveError(null);
  }

  function selectPalette(event: MouseEvent<HTMLButtonElement>) {
    const palette = event.currentTarget
      .value as CompletionEffectsPreferences["palette"];
    stopPreview();
    form.setFieldValue("palette", palette);
    savePreferences.reset();
    setHasSaved(false);
    setSaveError(null);
  }

  function setEnabled(enabled: boolean) {
    form.setFieldValue("enabled", enabled);
    savePreferences.reset();
    setHasSaved(false);
    setSaveError(null);
  }

  function preview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewStatus(null);
    if (prefersReducedMotion) {
      setPreviewing(false);
      setPreviewStatus(
        `Static sample shown. ${COMPLETION_EFFECT_MOTION_DESCRIPTIONS[form.state.values.theme]}`,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    await form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)]"
      noValidate
      onSubmit={handleSubmit}
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
            <form.Field name="enabled">
              {(field) => (
                <Switch
                  aria-label="Enable"
                  checked={field.state.value}
                  disabled={savePreferences.isPending}
                  onCheckedChange={setEnabled}
                />
              )}
            </form.Field>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Theme</FieldLegend>
            <FieldDescription>
              Choose one original theme for all of your Projects.
            </FieldDescription>
            <form.Field name="theme">
              {(field) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.keys(COMPLETION_EFFECT_CATALOG).map((themeName) => {
                    const theme = themeName as CompletionEffectTheme;
                    const selected = field.state.value === theme;
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
              )}
            </form.Field>
          </FieldSet>
        </section>

        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Palette</FieldLegend>
            <form.Subscribe selector={selectPreferences}>
              {(preferences) => (
                <>
                  <FieldDescription>
                    Choose from the four {preferences.theme} palettes.
                  </FieldDescription>
                  <form.Field name="palette">
                    {(field) => (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {COMPLETION_EFFECT_CATALOG[preferences.theme].map(
                          (palette) => {
                            const selected = field.state.value === palette;
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
                                <span className="font-medium text-sm">
                                  {palette}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="flex shrink-0 -space-x-1"
                                >
                                  {COMPLETION_EFFECT_PALETTE_COLORS[
                                    palette
                                  ].map((color) => (
                                    <span
                                      className="size-4 rounded-full border border-background"
                                      key={color}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                  </form.Field>
                </>
              )}
            </form.Subscribe>
          </FieldSet>
        </section>
      </div>

      <form.Subscribe selector={selectPreferences}>
        {(preferences) => (
          <section
            aria-labelledby="completion-effects-preview-heading"
            className="space-y-4 rounded-lg border bg-card p-5 sm:p-6 xl:sticky xl:top-6 xl:self-start"
          >
            <header className="flex items-center justify-between gap-3">
              <div>
                <h2
                  className="font-medium text-base"
                  id="completion-effects-preview-heading"
                >
                  Preview
                </h2>
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
        )}
      </form.Subscribe>

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
        <form.Subscribe selector={selectFormSaveState}>
          {({ isDirty, isSubmitting }) => (
            <Button
              className="min-h-11"
              disabled={!isDirty || isSubmitting || savePreferences.isPending}
              type="submit"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </footer>
    </form>
  );
}
