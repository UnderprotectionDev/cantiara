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
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@/utils/orpc";
import {
  formatAccountDateTime,
  formatAccountNumber,
  getWeekDayLabels,
} from "./account-preferences-format";
import { getBrowserPreferenceSuggestion } from "./browser-preference-suggestion";

const PREVIEW_TIMESTAMP = "2026-09-16T09:00:00.000Z";
const PREVIEW_NUMBER = 1_234_567.89;
const PREVIEW_WORK_TITLE = "Ship the launch";

function formValues(snapshot: AccountPreferencesSnapshot): AccountPreferences {
  const { isSaved: _isSaved, savedAt: _savedAt, ...values } = snapshot;
  return values;
}

function selectFormValues(state: { values: AccountPreferences }) {
  return state.values;
}

function selectIsDirty(state: { isDirty: boolean }) {
  return state.isDirty;
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
  saveError: boolean;
  snapshot: AccountPreferencesSnapshot;
}) {
  if (isOnline && !saveError) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className="border border-dashed bg-muted/30 p-4"
      role="status"
    >
      <p className="font-medium text-sm">
        {isOnline ? "Preferences could not be saved." : "Disconnected"}
      </p>
      <p className="mt-1 text-muted-foreground text-xs/relaxed">
        {isOnline ? "Try Save again." : "Reconnect to save."}
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
    </aside>
  );
}

export default function AccountPreferencesForm({
  snapshot,
}: {
  snapshot: AccountPreferencesSnapshot;
}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineState();
  const [saveError, setSaveError] = useState(false);
  const [suggestion, setSuggestion] = useState(() =>
    getBrowserPreferenceSuggestion({
      locale: DEFAULT_ACCOUNT_PREFERENCES.locale,
      timeZone: DEFAULT_ACCOUNT_PREFERENCES.timeZone,
    }),
  );
  const savePreferences = useMutation({
    mutationFn: (values: AccountPreferences) =>
      client.saveAccountPreferences(values),
    onError: () => {
      setSaveError(true);
      toast.error("Preferences could not be saved.");
    },
    onSuccess: (saved) => {
      setSaveError(false);
      queryClient.setQueryData(
        orpc.accountPreferences.queryOptions().queryKey,
        saved,
      );
      toast.success("Preferences saved.");
    },
  });
  const form = useForm({
    defaultValues: formValues(snapshot),
    onSubmit: async ({ value }) => {
      await savePreferences.mutateAsync(accountPreferencesSchema.parse(value));
    },
  });

  useEffect(() => {
    setSuggestion(getBrowserPreferenceSuggestion());
  }, []);

  useEffect(() => {
    form.reset(formValues(snapshot));
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
    <form className="space-y-8" noValidate onSubmit={handleSubmit}>
      {snapshot.isSaved ? null : (
        <aside className="border bg-muted/30 p-4" role="status">
          <p className="font-medium text-sm">Browser suggestion</p>
          <p className="mt-1 text-muted-foreground text-xs/relaxed">
            Suggested locale: <code>{suggestion.locale}</code>. Suggested time
            zone: <code>{suggestion.timeZone}</code>. These values are not
            applied until you save.
          </p>
          <Button
            className="mt-3"
            onClick={applySuggestion}
            type="button"
            variant="outline"
          >
            Use suggested locale and time zone
          </Button>
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

      <FieldGroup>
        <form.Field name="locale">
          {(field) => {
            function handleLocaleChange(event: ChangeEvent<HTMLInputElement>) {
              field.handleChange(event.target.value);
            }

            return (
              <Field>
                <FieldLabel htmlFor="account-preferences-locale">
                  Locale
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id="account-preferences-locale"
                  list="account-preferences-locale-options"
                  name={field.name}
                  onChange={handleLocaleChange}
                  value={field.state.value}
                />
                <datalist id="account-preferences-locale-options">
                  <option value="en-GB" />
                  <option value="en-US" />
                  <option value="tr-TR" />
                  <option value="de-DE" />
                  <option value="fr-FR" />
                </datalist>
                <FieldDescription>
                  Locale changes date, time, and number formatting. Product copy
                  and your content stay as written.
                </FieldDescription>
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="timeZone">
          {(field) => {
            function handleTimeZoneChange(
              event: ChangeEvent<HTMLInputElement>,
            ) {
              field.handleChange(event.target.value);
            }

            return (
              <Field>
                <FieldLabel htmlFor="account-preferences-time-zone">
                  Time zone
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id="account-preferences-time-zone"
                  name={field.name}
                  onChange={handleTimeZoneChange}
                  value={field.state.value}
                />
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
                  id="account-preferences-date-format"
                  name={field.name}
                  onChange={handleDateFormatChange}
                  value={field.state.value}
                >
                  {DATE_FORMAT_OPTIONS.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
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
              className="border-t pt-6"
            >
              <h2
                className="font-medium text-sm"
                id="account-preferences-preview"
              >
                Preview
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">Date</dt>
                  <dd className="mt-1 font-medium text-sm">
                    <time dateTime={PREVIEW_TIMESTAMP}>
                      {formatAccountDateTime(PREVIEW_TIMESTAMP, preview)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Number</dt>
                  <dd className="mt-1 font-medium text-sm">
                    {formatAccountNumber(PREVIEW_NUMBER, preview)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Work title</dt>
                  <dd className="mt-1 font-medium text-sm">
                    {PREVIEW_WORK_TITLE}
                  </dd>
                </div>
              </dl>
              <fieldset className="mt-5">
                <legend className="text-muted-foreground text-xs">Week</legend>
                <div className="mt-2 grid grid-cols-7 border-y text-center text-xs">
                  {getWeekDayLabels(preview).map((day) => (
                    <span
                      className="border-r px-2 py-2 last:border-r-0"
                      key={day}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </fieldset>
            </section>
          );
        }}
      </form.Subscribe>

      <div className="flex items-center gap-3 border-t pt-6">
        <Button disabled={savePreferences.isPending || !isOnline} type="submit">
          {savePreferences.isPending ? "Saving…" : "Save"}
        </Button>
        {savePreferences.isSuccess ? (
          <p aria-live="polite" className="text-muted-foreground text-xs">
            Preferences saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
