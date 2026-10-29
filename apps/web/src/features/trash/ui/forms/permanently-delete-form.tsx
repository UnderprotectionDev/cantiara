// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  CONFIRM_GITHUB_IDENTITY_LABEL,
  PERMANENTLY_DELETE_LABEL,
  permanentlyDeleteFromTrashInputSchema,
  TRASH_DELETE_BLOCKER_COPY,
  type TrashEarlyDeletePreview,
} from "@cantiara/api/trash-early-delete";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef, useState } from "react";

/**
 * The early `Permanently Delete` review: what will be removed (a Project
 * delete group as one unit), why it is blocked if it is, the consumed
 * `Confirm GitHub Identity` step and the typed Project name. They are two
 * distinct steps; this is not a password, MFA or session-refresh prompt.
 * Focus lands on the heading and Escape cancels.
 */
export function PermanentlyDeleteForm({
  busy,
  error,
  grant,
  identityPending,
  onCancel,
  onConfirmIdentity,
  onSubmit,
  preview,
}: {
  busy: boolean;
  error: string | null;
  grant: string | null;
  identityPending: boolean;
  onCancel: () => void;
  onConfirmIdentity: () => void;
  onSubmit: (typedName: string) => void;
  preview: TrashEarlyDeletePreview;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm({
    defaultValues: { typedName: "" },
    onSubmit: ({ value }) => {
      // The same field rules the server enforces: a refused value never
      // reaches the delete request.
      const typed =
        permanentlyDeleteFromTrashInputSchema.shape.typedName.safeParse(
          value.typedName,
        );
      const grantCheck =
        permanentlyDeleteFromTrashInputSchema.shape.grant.safeParse(grant);
      if (!(typed.success && grantCheck.success)) {
        setInvalid(
          "Check the Project name and Confirm GitHub Identity, then try again.",
        );
        return;
      }
      setInvalid(null);
      onSubmit(value.typedName);
    },
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const blocked = preview.blockers.length > 0;
  const { name } = preview.typedNameTarget;

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
      aria-labelledby="permanently-delete-title"
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      onSubmit={submit}
    >
      <h4
        className="font-medium"
        id="permanently-delete-title"
        ref={heading}
        tabIndex={-1}
      >
        {PERMANENTLY_DELETE_LABEL}
      </h4>
      <p className="text-sm">
        {preview.groupId
          ? "This Project delete group is removed as one unit and cannot be restored:"
          : "This record is removed and cannot be restored:"}
      </p>
      <ul aria-label="Records to be removed" className="space-y-1">
        {preview.members.map((member) => (
          <li className="text-sm" key={member.entryId}>
            {member.recordKind}: {member.recordLabel}
          </li>
        ))}
      </ul>
      {blocked ? (
        <ul aria-label="Why it is blocked" className="space-y-1" role="alert">
          {preview.blockers.map((blocker) => (
            <li className="text-sm" key={blocker}>
              {TRASH_DELETE_BLOCKER_COPY[blocker]}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={blocked || busy || identityPending || Boolean(grant)}
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
            htmlFor="permanently-delete-typed-name"
          >
            <span>Type the Project name {name} to confirm</span>
            <Input
              autoComplete="off"
              disabled={blocked || busy}
              id="permanently-delete-typed-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      {error || invalid ? <p role="alert">{error ?? invalid}</p> : null}
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.values.typedName}>
          {(typedName) => (
            <Button
              disabled={blocked || busy || !grant || typedName !== name}
              type="submit"
              variant="destructive"
            >
              {PERMANENTLY_DELETE_LABEL}
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
