// biome-ignore-all lint/performance/noJsxPropsBind: Value controls close over their current Custom field and Mutation Contract handler.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type {
  CustomFieldDefinition,
  CustomFieldRecordType,
  CustomFieldValueListItem,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import {
  type CustomFieldDraftValues,
  useCustomFields,
  useCustomFieldValues,
} from "@/features/custom-fields/hooks/use-custom-fields";

function valueInputId(
  definition: CustomFieldDefinition,
  recordId: string | undefined,
) {
  return `custom-field-value-${recordId ?? "new-record"}-${definition.id}`;
}

function valueSummary(value: ParsedCustomFieldValuePayload | null) {
  if (!value) {
    return "Not evaluated";
  }
  switch (value.kind) {
    case "boolean":
      return value.boolean ? "True" : "False";
    case "date":
      return value.date;
    case "number":
      return String(value.number);
    case "option":
      return value.option;
    case "options":
      return value.options.join(", ");
    case "text":
      return value.text;
    default:
      return "Not evaluated";
  }
}

function customFieldValue(
  item: CustomFieldValueListItem | undefined,
  draftValues: CustomFieldDraftValues,
  recordId: string | undefined,
) {
  if (recordId) {
    return item?.value?.value ?? null;
  }
  return draftValues[item?.definition.id ?? ""] ?? null;
}

function valueRevision(item: CustomFieldValueListItem | undefined) {
  return item?.value?.revision ?? 0;
}

function isAvailableOnRecord(
  definition: CustomFieldDefinition,
  recordType: CustomFieldRecordType,
) {
  return (
    definition.trashedAt === null && definition.recordTypes.includes(recordType)
  );
}

function TextValueInput({
  current,
  disabled,
  id,
  onCommit,
}: {
  current: ParsedCustomFieldValuePayload | null;
  disabled: boolean;
  id: string;
  onCommit: (value: ParsedCustomFieldValuePayload | null) => void;
}) {
  const [value, setValue] = useState(
    current?.kind === "text" ? current.text : "",
  );

  useEffect(() => {
    setValue(current?.kind === "text" ? current.text : "");
  }, [current]);

  return (
    <Input
      disabled={disabled}
      id={id}
      onBlur={() =>
        onCommit(value.trim() ? { kind: "text", text: value } : null)
      }
      onChange={(event) => setValue(event.target.value)}
      placeholder="Not evaluated"
      value={value}
    />
  );
}

function NumberValueInput({
  current,
  disabled,
  id,
  onCommit,
}: {
  current: ParsedCustomFieldValuePayload | null;
  disabled: boolean;
  id: string;
  onCommit: (value: ParsedCustomFieldValuePayload | null) => void;
}) {
  const [value, setValue] = useState(
    current?.kind === "number" ? String(current.number) : "",
  );

  useEffect(() => {
    setValue(current?.kind === "number" ? String(current.number) : "");
  }, [current]);

  return (
    <Input
      disabled={disabled}
      id={id}
      onBlur={() => {
        const parsed = Number(value);
        onCommit(
          value.trim() && Number.isFinite(parsed)
            ? { kind: "number", number: parsed }
            : null,
        );
      }}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Not evaluated"
      step="any"
      type="number"
      value={value}
    />
  );
}

function DateValueInput({
  current,
  disabled,
  formattingPreferences,
  id,
  label,
  onCommit,
}: {
  current: ParsedCustomFieldValuePayload | null;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  id: string;
  label: string;
  onCommit: (value: ParsedCustomFieldValuePayload | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentDate = current?.kind === "date" ? parseISO(current.date) : null;
  const selectedDate =
    currentDate && !Number.isNaN(currentDate.getTime())
      ? currentDate
      : undefined;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            aria-label={label}
            className="w-full justify-between font-normal"
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        {selectedDate
          ? formatAccountDate(
              current && current.kind === "date" ? current.date : "",
              formattingPreferences,
            )
          : "Not evaluated"}
        <CalendarDays aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-72">
        <PopoverDescription>Choose a calendar date.</PopoverDescription>
        <Calendar
          defaultMonth={selectedDate}
          mode="single"
          onSelect={(date) => {
            onCommit(
              date ? { date: format(date, "yyyy-MM-dd"), kind: "date" } : null,
            );
            setOpen(false);
          }}
          selected={selectedDate}
        />
        {selectedDate ? (
          <Button
            className="w-full"
            onClick={() => {
              onCommit(null);
              setOpen(false);
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            Clear date
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectValueInput({
  current,
  definition,
  disabled,
  id,
  onCommit,
}: {
  current: ParsedCustomFieldValuePayload | null;
  definition: CustomFieldDefinition;
  disabled: boolean;
  id: string;
  onCommit: (value: ParsedCustomFieldValuePayload | null) => void;
}) {
  const selected = current?.kind === "options" ? current.options : [];
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">{definition.name}</legend>
      {definition.options.map((option) => (
        <label
          className="flex items-start gap-2 text-sm"
          htmlFor={`${id}-${option}`}
          key={option}
        >
          <Checkbox
            checked={selected.includes(option)}
            id={`${id}-${option}`}
            onCheckedChange={(checked) => {
              const next = checked
                ? [...selected, option]
                : selected.filter((value) => value !== option);
              onCommit(
                next.length > 0 ? { kind: "options", options: next } : null,
              );
            }}
          />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function CustomFieldValuesForm({
  disabled = false,
  draftValues = {},
  formattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
  onDraftValuesChange,
  projectId,
  recordId,
  recordItems,
  recordType,
}: {
  disabled?: boolean;
  draftValues?: CustomFieldDraftValues;
  formattingPreferences?: AccountPreferences;
  onDraftValuesChange?: (values: CustomFieldDraftValues) => void;
  projectId: string;
  recordId?: string;
  /** Prefetched values for this record; suppresses the per-record query. */
  recordItems?: CustomFieldValueListItem[];
  recordType: CustomFieldRecordType;
}) {
  const definitionsQuery = useCustomFields(projectId).query;
  const values = useCustomFieldValues(projectId, recordType, recordId, {
    enabled: recordItems === undefined,
  });
  const [actionError, setActionError] = useState<string | null>(null);

  if (
    definitionsQuery.isPending ||
    (recordId && recordItems === undefined && values.query.isPending)
  ) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading Custom field…
      </p>
    );
  }
  if (
    definitionsQuery.isError ||
    (recordId && recordItems === undefined && values.query.isError)
  ) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Custom field values could not be loaded. Try loading this page again.
      </p>
    );
  }

  const items = recordId
    ? (recordItems ?? values.query.data ?? []).filter((item) =>
        isAvailableOnRecord(item.definition, recordType),
      )
    : (definitionsQuery.data ?? [])
        .filter((definition) => isAvailableOnRecord(definition, recordType))
        .map((definition) => ({ definition, value: null }));
  if (items.length === 0) {
    return null;
  }

  const busy =
    disabled || values.setValue.isPending || values.clearValue.isPending;

  async function commit(
    item: CustomFieldValueListItem,
    nextValue: ParsedCustomFieldValuePayload | null,
  ) {
    setActionError(null);
    if (!recordId) {
      onDraftValuesChange?.({
        ...draftValues,
        [item.definition.id]: nextValue,
      });
      return;
    }

    try {
      if (nextValue === null) {
        await values.clearValue.mutateAsync({
          baseRevision: valueRevision(item),
          definitionId: item.definition.id,
        });
      } else {
        await values.setValue.mutateAsync({
          baseRevision: valueRevision(item),
          definitionId: item.definition.id,
          payload: nextValue,
        });
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Custom field values could not be saved.",
      );
    }
  }

  return (
    <section aria-label="Custom field" className="space-y-4">
      <h4 className="font-medium text-sm">Custom field</h4>
      <FieldGroup>
        {items.map((item) => {
          const current = customFieldValue(item, draftValues, recordId);
          const id = valueInputId(item.definition, recordId);
          return (
            <Field key={item.definition.id}>
              <FieldLabel htmlFor={id}>{item.definition.name}</FieldLabel>
              {item.definition.type === "Text" ? (
                <TextValueInput
                  current={current}
                  disabled={busy}
                  id={id}
                  onCommit={(nextValue) =>
                    commit(item, nextValue).catch(() => undefined)
                  }
                />
              ) : null}
              {item.definition.type === "Number" ? (
                <NumberValueInput
                  current={current}
                  disabled={busy}
                  id={id}
                  onCommit={(nextValue) =>
                    commit(item, nextValue).catch(() => undefined)
                  }
                />
              ) : null}
              {item.definition.type === "Boolean" ? (
                <NativeSelect
                  disabled={busy}
                  id={id}
                  onChange={(event) =>
                    commit(
                      item,
                      event.target.value === ""
                        ? null
                        : {
                            boolean: event.target.value === "true",
                            kind: "boolean",
                          },
                    ).catch(() => undefined)
                  }
                  value={
                    current?.kind === "boolean" ? String(current.boolean) : ""
                  }
                >
                  <NativeSelectOption value="">
                    Not evaluated
                  </NativeSelectOption>
                  <NativeSelectOption value="true">True</NativeSelectOption>
                  <NativeSelectOption value="false">False</NativeSelectOption>
                </NativeSelect>
              ) : null}
              {item.definition.type === "Date" ? (
                <DateValueInput
                  current={current}
                  disabled={busy}
                  formattingPreferences={formattingPreferences}
                  id={id}
                  label={item.definition.name}
                  onCommit={(nextValue) =>
                    commit(item, nextValue).catch(() => undefined)
                  }
                />
              ) : null}
              {item.definition.type === "Single select" ? (
                <NativeSelect
                  disabled={busy}
                  id={id}
                  onChange={(event) =>
                    commit(
                      item,
                      event.target.value
                        ? { kind: "option", option: event.target.value }
                        : null,
                    ).catch(() => undefined)
                  }
                  value={current?.kind === "option" ? current.option : ""}
                >
                  <NativeSelectOption value="">
                    Not evaluated
                  </NativeSelectOption>
                  {item.definition.options.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : null}
              {item.definition.type === "Multi select" ? (
                <MultiSelectValueInput
                  current={current}
                  definition={item.definition}
                  disabled={busy}
                  id={id}
                  onCommit={(nextValue) =>
                    commit(item, nextValue).catch(() => undefined)
                  }
                />
              ) : null}
              <FieldDescription>{valueSummary(current)}</FieldDescription>
            </Field>
          );
        })}
      </FieldGroup>
      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
