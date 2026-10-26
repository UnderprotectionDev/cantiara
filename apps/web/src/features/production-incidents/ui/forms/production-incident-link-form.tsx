// biome-ignore-all lint/performance/noJsxPropsBind: The select binds to its own form state.

import type { ProductionIncidentLinkTarget } from "@cantiara/api/production-incidents";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { PRODUCTION_INCIDENT_LINK_GROUPS } from "../../lib/production-incident-form";

const linkFormSchema = z.object({ target: z.string().trim().min(1) });

/** Key of a selectable record: its type and id never collide across types. */
export function linkTargetKey(target: ProductionIncidentLinkTarget) {
  return JSON.stringify([target.type, target.id]);
}

/**
 * `Link record`: one Bug, GitHub PR, Project Release, Risk or Decision of this
 * Project at a time. Linking is context only; it changes no linked record.
 */
export function ProductionIncidentLinkForm({
  candidates,
  onAdd,
}: {
  candidates: readonly ProductionIncidentLinkTarget[];
  onAdd: (target: ProductionIncidentLinkTarget) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { target: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      const parsed = linkFormSchema.safeParse(value);
      const target = candidates.find(
        (candidate) => linkTargetKey(candidate) === parsed.data?.target,
      );
      if (!target) {
        setError("Choose a record to link.");
        return;
      }
      try {
        await onAdd(target);
        formApi.reset();
      } catch {
        setError("Record could not be linked. Reload and try again.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  if (!candidates.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Every Bug, GitHub PR, Project Release, Risk and Decision of this Project
        is already linked.
      </p>
    );
  }
  return (
    <form
      aria-label="Link record"
      className="flex flex-wrap items-end gap-3"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="target">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="production-incident-link-target"
                >
                  Record
                  <NativeSelect
                    disabled={isSubmitting}
                    id="production-incident-link-target"
                    name="target"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Choose a record
                    </NativeSelectOption>
                    {PRODUCTION_INCIDENT_LINK_GROUPS.map(({ label, type }) => {
                      const group = candidates.filter(
                        (candidate) => candidate.type === type,
                      );
                      return group.length ? (
                        <optgroup key={type} label={label}>
                          {group.map((candidate) => (
                            <NativeSelectOption
                              key={linkTargetKey(candidate)}
                              value={linkTargetKey(candidate)}
                            >
                              {candidate.label}
                            </NativeSelectOption>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <Button disabled={isSubmitting} type="submit" variant="outline">
              Link record
            </Button>
          </>
        )}
      </form.Subscribe>
      {error ? (
        <p className="w-full text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
