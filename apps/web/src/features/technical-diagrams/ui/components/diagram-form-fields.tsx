// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import type { FormEvent, ReactNode } from "react";
import { useId } from "react";

/** The slice of a TanStack Form field API that the shared controls bind. */
export interface FieldLike<T> {
  handleChange: (value: T) => void;
  state: { value: T };
}

export interface FieldOption {
  label: string;
  value: string;
}

export function SelectField({
  field,
  label,
  onValueChange,
  options,
}: {
  field: FieldLike<string>;
  label: string;
  onValueChange?: (value: string) => void;
  options: readonly (FieldOption | string)[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        onChange={(event) => {
          field.handleChange(event.target.value);
          onValueChange?.(event.target.value);
        }}
        value={field.state.value}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function TextField({
  field,
  label,
}: {
  field: FieldLike<string>;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => field.handleChange(event.target.value)}
        value={field.state.value}
      />
    </div>
  );
}

export function CheckField({
  field,
  label,
}: {
  field: FieldLike<boolean>;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <input
        checked={field.state.value}
        onChange={(event) => field.handleChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

/** Submits through TanStack Form's `handleSubmit` and keeps the page from reloading. */
export function submitForm(form: { handleSubmit: () => Promise<unknown> }) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  };
}

export function EditForm({
  children,
  label,
  onSubmit,
}: {
  children: ReactNode;
  label: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      aria-label={label}
      className="flex flex-wrap items-end gap-2 rounded-md border p-2"
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}

export function EditSubmit({
  describedBy,
  disabled,
  label,
}: {
  describedBy?: string;
  disabled: boolean;
  label: string;
}) {
  return (
    <Button
      aria-describedby={describedBy}
      disabled={disabled}
      size="sm"
      type="submit"
    >
      {label}
    </Button>
  );
}
