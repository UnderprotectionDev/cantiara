// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  ERASE_PERSONAL_DATA_LABEL,
  erasePersonalDataInputSchema,
  type PersonalDataErasePreview,
} from "@cantiara/api/personal-data-rights";
import {
  CONFIRM_GITHUB_IDENTITY_LABEL,
  SECURITY_REDACTION_LOCATOR_LABELS,
} from "@cantiara/api/security-redaction";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef } from "react";

/**
 * The `Erase Personal Data` review: the impact first, then the distinct
 * `Confirm GitHub Identity` step and the typed Account name. The GitHub step is
 * an identity check, not a password or MFA prompt, and there is no second
 * confirmation card. Focus lands on the heading; Escape cancels.
 */
export function PersonalDataEraseForm({
  busy,
  grant,
  identityPending,
  onCancel,
  onConfirmIdentity,
  onErase,
  preview,
}: {
  busy: boolean;
  grant: string | null;
  identityPending: boolean;
  onCancel: () => void;
  onConfirmIdentity: () => void;
  onErase: (typedName: string) => void;
  preview: PersonalDataErasePreview;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const {
    typedNameTarget: { name },
  } = preview;
  const form = useForm({
    defaultValues: { typedName: "" },
    onSubmit: ({ value }) => {
      const parsed = erasePersonalDataInputSchema.shape.typedName.safeParse(
        value.typedName,
      );
      if (parsed.success) {
        onErase(parsed.data);
      }
    },
  });
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
      aria-labelledby="personal-data-erase-title"
      className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      onSubmit={submit}
    >
      <h3
        className="font-medium"
        id="personal-data-erase-title"
        ref={heading}
        tabIndex={-1}
      >
        {ERASE_PERSONAL_DATA_LABEL}: {preview.contactLabel}
      </h3>
      <ul aria-label="What erasing means" className="space-y-1 text-sm">
        {preview.notices.map((notice) => (
          <li key={notice}>{notice}</li>
        ))}
      </ul>
      <section className="space-y-1">
        <h4 className="font-medium text-sm">Records that are erased</h4>
        <ul aria-label="Records that are erased" className="space-y-2 text-sm">
          {preview.sources.map((source) => (
            <li key={source.kind}>
              {source.kind}: {source.items.length}
              {source.items.length > 0 ? (
                <ul aria-label={`${source.kind} in this erase`}>
                  {source.items.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-1">
        <h4 className="font-medium text-sm">Copies elsewhere</h4>
        <ul aria-label="Copies elsewhere" className="space-y-1 text-sm">
          {preview.copies.length === 0 ? (
            <li>No other copies found.</li>
          ) : (
            preview.copies.map((copy) => (
              <li key={`${copy.kind}:${copy.recordId}:${copy.location}`}>
                {SECURITY_REDACTION_LOCATOR_LABELS[copy.kind]}:{" "}
                {copy.recordKind} {copy.recordId}, {copy.location}
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
      </section>
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
            htmlFor="personal-data-erase-typed-name"
          >
            <span>Type the Account name {name} to confirm</span>
            <Input
              autoComplete="off"
              disabled={busy}
              id="personal-data-erase-typed-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.values.typedName}>
          {(typedName) => (
            <Button
              disabled={busy || !grant || typedName !== name}
              type="submit"
              variant="destructive"
            >
              {ERASE_PERSONAL_DATA_LABEL}
            </Button>
          )}
        </form.Subscribe>
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
