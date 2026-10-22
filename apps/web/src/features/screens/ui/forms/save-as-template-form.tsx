// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen version and form fields.
import type { ScreenRecord } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { saveAsTemplateFormSchema } from "../../lib/screen-forms";
import type { ScreenTemplateActions } from "../../lib/screen-template-actions";

/** `Save as Template` for the Screen's chosen saved version; the Screen is untouched. */
export function SaveAsTemplate({
  actions,
  screen,
}: {
  actions: Pick<ScreenTemplateActions, "save">;
  screen: ScreenRecord;
}) {
  const versions = screen.wireframeVersions;
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const latestVersion = versions.at(-1)?.version;
  const form = useForm({
    defaultValues: { name: "", version: null as number | null },
    onSubmit: async ({ formApi, value }) => {
      setError(undefined);
      setMessage(undefined);
      const chosen = value.version ?? latestVersion;
      const parsed = saveAsTemplateFormSchema.safeParse({
        name: value.name,
        version: chosen,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      try {
        await actions.save(screen, parsed.data.version, parsed.data.name);
        setMessage(
          `Saved template ${parsed.data.name} from v${parsed.data.version}.`,
        );
        formApi.setFieldValue("name", "");
      } catch {
        setError("Template could not be saved.");
      }
    },
  });
  if (versions.length === 0 || latestVersion === undefined) {
    return null;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Save as Template"
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={submit}
    >
      <label htmlFor={`template-version-${screen.id}`}>Saved version</label>
      <form.Field name="version">
        {(field) => (
          <NativeSelect
            id={`template-version-${screen.id}`}
            name={field.name}
            onChange={(event) => field.handleChange(Number(event.target.value))}
            value={field.state.value ?? latestVersion}
          >
            {versions.map((item) => (
              <NativeSelectOption key={item.version} value={item.version}>
                {`v${item.version}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <label htmlFor={`template-name-${screen.id}`}>Template name</label>
      <form.Field name="name">
        {(field) => (
          <Input
            className="w-48"
            id={`template-name-${screen.id}`}
            maxLength={120}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button size="sm" type="submit" variant="outline">
        Save as Template
      </Button>
      {message ? <span role="status">{message}</span> : null}
      {error ? (
        <span className="text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
