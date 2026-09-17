import {
  type AccountPreferences,
  type AccountPreferencesSnapshot,
  APPEARANCE_OPTIONS,
  accountPreferencesSchema,
  DATE_FORMAT_OPTIONS,
  DEFAULT_ACCOUNT_PREFERENCES,
  FIRST_DAY_OF_WEEK_OPTIONS,
} from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Globe2, WifiOff } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { accountPreferencesQueryOptions, client } from "@/utils/orpc";
import {
  type AccountPreferencesMutationError,
  accountPreferencesMutationErrorMessage,
  parseAccountPreferencesMutationError,
} from "../account-preferences-mutation-error";
import {
  formatAccountDateTime,
  formatAccountNumber,
  getWeekDayLabels,
} from "./account-preferences-format";
import { getBrowserPreferenceSuggestion } from "./browser-preference-suggestion";

const PREVIEW_TIMESTAMP = "2026-09-16T09:00:00.000Z";
const PREVIEW_NUMBER = 1_234_567.89;
const PREVIEW_WORK_TITLE = "Ship the launch";
const LOCALE_OPTIONS = ["en-GB", "en-US", "tr-TR", "de-DE", "fr-FR"];
const TIME_ZONE_OPTIONS = ["UTC", ...Intl.supportedValuesOf("timeZone")];

function optionsWithCurrentValue(
  options: readonly string[],
  currentValue: string,
) {
  return options.includes(currentValue) ? options : [currentValue, ...options];
}

function formValues(snapshot: AccountPreferencesSnapshot): AccountPreferences {
  const {
    isSaved: _isSaved,
    revision: _revision,
    savedAt: _savedAt,
    ...values
  } = snapshot;
  return values;
}

function selectFormValues(state: { values: AccountPreferences }) {
  return state.values;
}

function selectIsDirty(state: { isDirty: boolean }) {
  return state.isDirty;
}

function saveStatusMessage(
  isOnline: boolean,
  saveError: AccountPreferencesMutationError | null,
) {
  if (!isOnline) {
    return "Disconnected";
  }
  if (saveError?.code === "STALE_BASE_REVISION") {
    return "Data was not written.";
  }
  if (!saveError) {
    return "Preferences could not be saved.";
  }
  return accountPreferencesMutationErrorMessage(saveError);
}

function saveStatusDescription(
  isOnline: boolean,
  saveError: AccountPreferencesMutationError | null,
) {
  if (!isOnline) {
    return "Reconnect to save.";
  }
  if (saveError?.code === "STALE_BASE_REVISION") {
    return "This page is out of date. Refresh to load the current value.";
  }
  return "Try Save again.";
}

function previewValues(values: AccountPreferences): AccountPreferences {
  const parsed = accountPreferencesSchema.safeParse(values);
  return parsed.success ? parsed.data : DEFAULT_ACCOUNT_PREFERENCES;
}

function getOnlineState() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function useOnlineState() {
  const [isOnline, setIsOnline] = useState(getOnlineState);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(getOnlineState());
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return isOnline;
}

function AccountPreferencesSaveStatus({
  isDirty,
  isOnline,
  saveError,
  snapshot,
}: {
  isDirty: boolean;
  isOnline: boolean;
  saveError: AccountPreferencesMutationError | null;
  snapshot: AccountPreferencesSnapshot;
}) {
  if (isOnline && !saveError) {
    return null;
  }

  const StatusIcon = isOnline ? CircleAlert : WifiOff;

  return (
    <aside
      aria-live="polite"
      className="flex gap-3 border border-destructive/25 bg-destructive/5 p-4"
      role="status"
    >
      <StatusIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">
          {saveStatusMessage(isOnline, saveError)}
        </p>
        <p className="mt-1 text-muted-foreground text-xs/relaxed">
          {saveStatusDescription(isOnline, saveError)}
        </p>
        <dl className="mt-3 space-y-1 text-xs/relaxed">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Last successful save</dt>
            <dd>
              {snapshot.savedAt ? (
                <time dateTime={snapshot.savedAt}>
                  {formatAccountDateTime(snapshot.savedAt, snapshot)}
                </time>
              ) : (
                "Never"
              )}
            </dd>
          </div>
          {isDirty ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium">Unsaved risk</dt>
              <dd>
                {isOnline
                  ? "These changes are still unsaved."
                  : "These changes will be lost if you leave this page before reconnecting."}
              </dd>
            </div>
          ) : null}
        </dl>
        {saveError?.code === "STALE_BASE_REVISION" ? (
          <div className="mt-4 border-destructive/20 border-t pt-3">
            <p className="font-medium text-sm">Current value</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm/relaxed sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Revision</dt>
                <dd className="mt-0.5 font-medium">
                  {saveError.currentRevision}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Appearance</dt>
                <dd className="mt-0.5 break-words font-medium">
                  {saveError.currentValue.appearance}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Locale</dt>
                <dd className="mt-0.5 break-words font-medium">
                  {saveError.currentValue.locale}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Time zone</dt>
                <dd className="mt-0.5 break-words font-medium">
                  {saveError.currentValue.timeZone}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Date format</dt>
                <dd className="mt-0.5 break-words font-medium">
                  {saveError.currentValue.dateFormat}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">First day of week</dt>
                <dd className="mt-0.5 break-words font-medium">
                  {saveError.currentValue.firstDayOfWeek}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default function AccountPreferencesForm({
  accountId,
  snapshot,
}: {
  accountId: string;
  snapshot: AccountPreferencesSnapshot;
}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineState();
  const latestSavedAt = useRef<string | null>(null);
  const pendingSave = useRef<{
    baseRevision: number;
    clientIdempotencyKey: string;
    values: string;
  } | null>(null);
  const [saveError, setSaveError] =
    useState<AccountPreferencesMutationError | null>(null);
  const [suggestion, setSuggestion] = useState(() =>
    getBrowserPreferenceSuggestion({
      locale: DEFAULT_ACCOUNT_PREFERENCES.locale,
      timeZone: DEFAULT_ACCOUNT_PREFERENCES.timeZone,
    }),
  );
  const savePreferences = useMutation({
    mutationFn: (input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      preferences: AccountPreferences;
    }) => client.saveAccountPreferences(input),
    onError: (error) => {
      const parsedError = parseAccountPreferencesMutationError(error);
      setSaveError(parsedError);
      toast.error(accountPreferencesMutationErrorMessage(parsedError));
    },
    onSuccess: (saved) => {
      setSaveError(null);
      pendingSave.current = null;
      latestSavedAt.current = saved.savedAt;
      queryClient.setQueryData(
        accountPreferencesQueryOptions(accountId).queryKey,
        saved,
      );
      toast.success("Preferences saved.");
    },
  });
  const form = useForm({
    defaultValues: formValues(snapshot),
    onSubmit: async ({ value }) => {
      const preferences = accountPreferencesSchema.parse(value);
      const serialized = JSON.stringify(preferences);
      const attempt = pendingSave.current;
      const clientIdempotencyKey =
        attempt?.baseRevision === snapshot.revision &&
        attempt.values === serialized
          ? attempt.clientIdempotencyKey
          : crypto.randomUUID();
      pendingSave.current = {
        baseRevision: snapshot.revision,
        clientIdempotencyKey,
        values: serialized,
      };
      await savePreferences.mutateAsync({
        baseRevision: snapshot.revision,
        clientIdempotencyKey,
        preferences,
      });
    },
  });

  useEffect(() => {
    setSuggestion(getBrowserPreferenceSuggestion());
  }, []);

  useEffect(() => {
    const values = formValues(snapshot);
    if (
      latestSavedAt.current !== null &&
      latestSavedAt.current === snapshot.savedAt
    ) {
      latestSavedAt.current = null;
      form.reset(values);
    } else if (!form.state.isDirty) {
      form.reset(values);
    } else if (form.state.values.appearance !== values.appearance) {
      form.setFieldValue("appearance", values.appearance);
    }
  }, [form, snapshot]);

  function applySuggestion() {
    form.setFieldValue("locale", suggestion.locale);
    form.setFieldValue("timeZone", suggestion.timeZone);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    await form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      {snapshot.isSaved ? null : (
        <aside
          className="flex gap-3 border border-border bg-muted/35 p-4"
          role="status"
        >
          <Globe2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">Browser suggestion</p>
            <p className="mt-1 text-muted-foreground text-xs/relaxed">
              Suggested locale: <code>{suggestion.locale}</code>. Suggested time
              zone: <code>{suggestion.timeZone}</code>. These values are not
              applied until you save.
            </p>
            <Button
              className="mt-4"
              onClick={applySuggestion}
              type="button"
              variant="outline"
            >
              Use suggested locale and time zone
            </Button>
          </div>
        </aside>
      )}

      <form.Subscribe selector={selectIsDirty}>
        {(isDirty) => (
          <AccountPreferencesSaveStatus
            isDirty={isDirty}
            isOnline={isOnline}
            saveError={saveError}
            snapshot={snapshot}
          />
        )}
      </form.Subscribe>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <FieldGroup className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
          <form.Field name="locale">
            {(field) => {
              function handleLocaleChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(event.target.value);
              }

              return (
                <Field>
                  <FieldLabel htmlFor="account-preferences-locale">
                    Locale
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="account-preferences-locale"
                    name={field.name}
                    onChange={handleLocaleChange}
                    value={field.state.value}
                  >
                    {optionsWithCurrentValue(
                      LOCALE_OPTIONS,
                      field.state.value,
                    ).map((locale) => (
                      <NativeSelectOption key={locale} value={locale}>
                        {locale}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Locale changes date, time, and number formatting. Product
                    copy and your content stay as written.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="timeZone">
            {(field) => {
              function handleTimeZoneChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(event.target.value);
              }

              return (
                <Field>
                  <FieldLabel htmlFor="account-preferences-time-zone">
                    Time zone
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="account-preferences-time-zone"
                    name={field.name}
                    onChange={handleTimeZoneChange}
                    value={field.state.value}
                  >
                    {optionsWithCurrentValue(
                      TIME_ZONE_OPTIONS,
                      field.state.value,
                    ).map((timeZone) => (
                      <NativeSelectOption key={timeZone} value={timeZone}>
                        {timeZone}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Changes future date entry, day boundaries, and historical
                    display without rewriting stored timestamps.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="dateFormat">
            {(field) => {
              function handleDateFormatChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(
                  event.target.value as AccountPreferences["dateFormat"],
                );
              }

              return (
                <Field>
                  <FieldLabel htmlFor="account-preferences-date-format">
                    Date format
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="account-preferences-date-format"
                    name={field.name}
                    onChange={handleDateFormatChange}
                    value={field.state.value}
                  >
                    {DATE_FORMAT_OPTIONS.map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Choose a saved date shape or follow the Locale default.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="firstDayOfWeek">
            {(field) => {
              function handleFirstDayChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(
                  event.target.value as AccountPreferences["firstDayOfWeek"],
                );
              }

              return (
                <Field>
                  <FieldLabel htmlFor="account-preferences-first-day">
                    First day of week
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="account-preferences-first-day"
                    name={field.name}
                    onChange={handleFirstDayChange}
                    value={field.state.value}
                  >
                    {FIRST_DAY_OF_WEEK_OPTIONS.map((day) => (
                      <NativeSelectOption key={day} value={day}>
                        {day}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Week grids and week boundaries start on this day.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="appearance">
            {(field) => {
              function handleAppearanceChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(
                  event.target.value as AccountPreferences["appearance"],
                );
              }

              return (
                <Field>
                  <FieldLabel htmlFor="account-preferences-appearance">
                    Appearance
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="account-preferences-appearance"
                    name={field.name}
                    onChange={handleAppearanceChange}
                    value={field.state.value}
                  >
                    {APPEARANCE_OPTIONS.map((appearance) => (
                      <NativeSelectOption key={appearance} value={appearance}>
                        {appearance}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Light or Dark is shared by the web and macOS product shells.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>

        <form.Subscribe selector={selectFormValues}>
          {(values) => {
            const preview = previewValues(values);

            return (
              <section
                aria-labelledby="account-preferences-preview"
                className="border bg-muted/20 p-5 lg:sticky lg:top-4 lg:row-span-2"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2
                    className="font-medium text-sm"
                    id="account-preferences-preview"
                  >
                    Preview
                  </h2>
                  <span className="text-muted-foreground text-xs">
                    Before saving
                  </span>
                </div>
                <dl className="mt-6 space-y-4">
                  <div className="border-b pb-3">
                    <dt className="text-muted-foreground text-xs">Date</dt>
                    <dd className="mt-1 font-medium text-base tracking-tight">
                      <time dateTime={PREVIEW_TIMESTAMP}>
                        {formatAccountDateTime(PREVIEW_TIMESTAMP, preview)}
                      </time>
                    </dd>
                  </div>
                  <div className="border-b pb-3">
                    <dt className="text-muted-foreground text-xs">
                      Example number
                    </dt>
                    <dd className="mt-1 font-medium text-base tracking-tight">
                      {formatAccountNumber(PREVIEW_NUMBER, preview)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Work title
                    </dt>
                    <dd className="mt-1 font-medium text-base tracking-tight">
                      {PREVIEW_WORK_TITLE}
                    </dd>
                  </div>
                </dl>
                <fieldset className="mt-6 border-t pt-4">
                  <legend className="text-muted-foreground text-xs">
                    Week
                  </legend>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
                    {getWeekDayLabels(preview).map((day) => (
                      <span className="min-w-0 bg-muted/35 px-1 py-2" key={day}>
                        {day}
                      </span>
                    ))}
                  </div>
                </fieldset>
              </section>
            );
          }}
        </form.Subscribe>

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-start-1">
          <div className="min-h-5">
            {savePreferences.isSuccess ? (
              <p
                aria-live="polite"
                className="flex items-center gap-1.5 text-muted-foreground text-xs"
              >
                <Check aria-hidden="true" className="size-3.5 text-primary" />
                Preferences saved.
              </p>
            ) : null}
          </div>
          <Button
            disabled={savePreferences.isPending || !isOnline}
            type="submit"
          >
            {savePreferences.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
