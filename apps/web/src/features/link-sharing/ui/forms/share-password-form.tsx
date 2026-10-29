// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import { LINK_PASSWORD_LABEL } from "@cantiara/api/link-sharing";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ formApi, value }) => {
      setError(null);
      setSaved(null);
      const parsed = sharePasswordFormSchema.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Enter a password.");
        return;
      }
      try {
        await onSave(parsed.data.password);
        formApi.reset();
        setSaved("Password saved. Every open visit ended.");
      } catch {
        setError("The password could not be saved. Try again.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  async function remove() {
    setError(null);
    setSaved(null);
    try {
      await onRemove();
      setSaved("Password removed. Every open visit ended.");
    } catch {
      setError("The password could not be removed. Try again.");
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
          className="text-destructive text-sm"
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
                onClick={remove}
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
