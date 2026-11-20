// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import { LINK_PASSWORD_LABEL } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
import { linkSharingRefusalMessage } from "../../lib/link-sharing-refusal";
import { sharePasswordFormSchema } from "../../lib/share-access";

/**
 * Add or change the optional Link password, or remove it. The password is a
 * Secret: it is sent once, never shown again and never read back.
 */
export function SharePasswordForm({
  onRemove,
  onSave,
  passwordProtected,
}: {
  onRemove: () => Promise<unknown>;
  onSave: (password: string) => Promise<unknown>;
  passwordProtected: boolean;
}) {
  const form = useForm({
    defaultValues: { password: "", result: null as string | null },
    onSubmitMeta: { action: "save" } as { action: "save" | "remove" },
    onSubmit: async ({ formApi, meta, value }) => {
      formApi.setFieldValue("result", null);
      if (meta.action === "remove") {
        await remove();
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      const parsed = sharePasswordFormSchema.safeParse({
        password: value.password,
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Enter a password.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onSave(parsed.data.password);
        formApi.reset();
        formApi.setFieldValue(
          "result",
          "Password saved. Every open visit ended.",
        );
      } catch (failure) {
        form.setErrorMap({
          onSubmit: {
            form:
              linkSharingRefusalMessage(failure) ??
              "The password could not be saved. Try again.",
            fields: {},
          },
        });
      }
    },
  });
  const saved = useSelector(form.store, (state) => state.values.result);
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  async function remove() {
    form.setErrorMap({ onSubmit: undefined });
    try {
      await onRemove();
      form.setFieldValue("result", "Password removed. Every open visit ended.");
    } catch (failure) {
      form.setErrorMap({
        onSubmit: {
          form:
            linkSharingRefusalMessage(failure) ??
            "The password could not be removed. Try again.",
          fields: {},
        },
      });
    }
  }
  return (
    <form
      aria-label={LINK_PASSWORD_LABEL}
      className="grid gap-2"
      onSubmit={submit}
    >
      <form.Field name="password">
        {(field) => (
          <label className="grid gap-1 text-sm" htmlFor="share-link-password">
            {LINK_PASSWORD_LABEL}
            <Input
              aria-describedby={error ? "share-link-password-error" : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="new-password"
              id="share-link-password"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="password"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      {error ? (
        <p
          className="text-sm text-destructive"
          id="share-link-password-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{saved}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit">
              {passwordProtected ? "Change password" : "Add password"}
            </Button>
            {passwordProtected ? (
              <Button
                disabled={isSubmitting}
                onClick={() =>
                  submitForm(form, { action: "remove" }).catch(() => undefined)
                }
                type="button"
                variant="outline"
              >
                Remove password
              </Button>
            ) : null}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
