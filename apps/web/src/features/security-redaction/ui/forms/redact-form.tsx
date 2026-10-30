// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  CONFIRM_GITHUB_IDENTITY_LABEL,
  REDACT_LABEL,
  SECURITY_REDACTION_LOCATOR_LABELS,
  type SecurityRedactionPreview,
} from "@cantiara/api/security-redaction";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef } from "react";

/**
 * The `Redact` review: the value to remove, the preview of every place that
 * holds it, the consumed `Confirm GitHub Identity` step and the typed Account
 * or Project name. The GitHub step is a distinct identity check, not a
 * password, MFA or session-refresh prompt. Focus lands on the heading and
 * Escape cancels.
 */
export function RedactForm({
  busy,
  error,
  grant,
  identityPending,
  onCancel,
  onConfirmIdentity,
  onPreview,
  onSubmit,
  preview,
}: {
  busy: boolean;
  error: string | null;
  grant: string | null;
  identityPending: boolean;
  onCancel: () => void;
  onConfirmIdentity: () => void;
  onPreview: (sensitiveValue: string) => void;
  /** Receives the typed name and the audit reason. */
  onSubmit: (typedName: string, reason: string) => void;
  preview: SecurityRedactionPreview | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm({
    defaultValues: { reason: "", sensitiveValue: "", typedName: "" },
    onSubmit: ({ value }) => onSubmit(value.typedName, value.reason),
  });
  const name = preview?.typedNameTarget.name;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape cancels the review for keyboard users.
    <form
      aria-labelledby="redact-title"
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      onSubmit={submit}
    >
      <h4 className="font-medium" id="redact-title" ref={heading} tabIndex={-1}>
        {REDACT_LABEL}
      </h4>
      <form.Field name="sensitiveValue">
        {(field) => (
          <label className="block space-y-1 text-sm" htmlFor="redact-value">
            <span>Value to remove</span>
            <Input
              autoComplete="off"
              disabled={busy || Boolean(preview)}
              id="redact-value"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              type="password"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      {preview ? null : (
        <form.Subscribe selector={(state) => state.values.sensitiveValue}>
          {(sensitiveValue) => (
            <Button
              disabled={busy || sensitiveValue.length === 0}
              onClick={() => onPreview(sensitiveValue)}
              type="button"
              variant="outline"
            >
              Preview
            </Button>
          )}
        </form.Subscribe>
      )}
      {preview ? (
        <>
          <p className="text-sm">{preview.detectionLimit}</p>
          <ul aria-label="Places that hold the value" className="space-y-1">
            {preview.locators.length === 0 ? (
              <li className="text-sm">No places found.</li>
            ) : (
              preview.locators.map((locator) => (
                <li
                  className="text-sm"
                  key={`${locator.kind}:${locator.recordId}:${locator.location}`}
                >
                  {SECURITY_REDACTION_LOCATOR_LABELS[locator.kind]}:{" "}
                  {locator.recordKind} {locator.recordId}, {locator.location}
                </li>
              ))
            )}
          </ul>
          {preview.notSearched.length > 0 ? (
            <p className="text-sm" role="status">
              Not searched yet:{" "}
              {preview.notSearched
                .map((kind) => SECURITY_REDACTION_LOCATOR_LABELS[kind])
                .join(", ")}
              .
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy || identityPending || Boolean(grant)}
              onClick={onConfirmIdentity}
              type="button"
              variant="outline"
            >
              {CONFIRM_GITHUB_IDENTITY_LABEL}
            </Button>
            {grant ? (
              <span className="text-muted-foreground text-sm" role="status">
                GitHub identity confirmed.
              </span>
            ) : null}
          </div>
          <form.Field name="typedName">
            {(field) => (
              <label
                className="block space-y-1 text-sm"
                htmlFor="redact-typed-name"
              >
                <span>
                  Type the {preview.typedNameTarget.kind} name {name} to confirm
                </span>
                <Input
                  autoComplete="off"
                  disabled={busy}
                  id="redact-typed-name"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="reason">
            {(field) => (
              <label
                className="block space-y-1 text-sm"
                htmlFor="redact-reason"
              >
                <span>Reason</span>
                <Textarea
                  className="min-h-16"
                  disabled={busy}
                  id="redact-reason"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex gap-2">
        {preview ? (
          <form.Subscribe selector={(state) => state.values}>
            {({ reason, typedName }) => (
              <Button
                disabled={
                  busy ||
                  !grant ||
                  typedName !== name ||
                  reason.trim().length === 0
                }
                type="submit"
                variant="destructive"
              >
                {REDACT_LABEL}
              </Button>
            )}
          </form.Subscribe>
        ) : null}
        <Button
          disabled={busy}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
