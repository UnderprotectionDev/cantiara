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
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  createPopoverHandle,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import {
  type CustomFieldDraftValues,
  useCustomFields,
  useCustomFieldValues,
} from "@/features/custom-fields/hooks/use-custom-fields";
import { CustomFieldScalarForm } from "../forms/custom-field-scalar-form";

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
  const [popoverHandle] = useState(createPopoverHandle);
  const currentDate = current?.kind === "date" ? parseISO(current.date) : null;
  const selectedDate =
    currentDate && !Number.isNaN(currentDate.getTime())
      ? currentDate
      : undefined;

  return (
    <Popover handle={popoverHandle}>
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
            popoverHandle.close();
          }}
          selected={selectedDate}
        />
        {selectedDate ? (
          <Button
            className="w-full"
            onClick={() => {
              onCommit(null);
              popoverHandle.close();
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
  const failedWrite = values.setValue.isError
    ? values.setValue
    : values.clearValue;

  if (
    definitionsQuery.status === "pending" ||
    (recordId && recordItems === undefined && values.query.isPending)
  ) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading Custom field…
      </p>
    );
  }
  if (
    definitionsQuery.isError ||
    (recordId && recordItems === undefined && values.query.isError)
  ) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Custom field values could not be loaded. Try loading this page again.
      </p>
    );
  }

  const items = availableCustomFieldItems(
    recordId,
    recordItems,
    values.query.data,
    definitionsQuery.data,
    recordType,
  );
  const failedType = items.find(
    (item) => item.definition.id === failedWrite.variables?.definitionId,
  )?.definition.type;
  const writeError =
    failedType === "Text" || failedType === "Number" ? null : failedWrite.error;
  if (items.length === 0) {
    return null;
  }

  const busy =
    disabled || values.setValue.isPending || values.clearValue.isPending;

  async function commit(
    item: CustomFieldValueListItem,
    nextValue: ParsedCustomFieldValuePayload | null,
    baseRevision = valueRevision(item),
  ) {
    if (!recordId) {
      onDraftValuesChange?.({
        ...draftValues,
        [item.definition.id]: nextValue,
      });
      return;
    }

    if (nextValue === null) {
      values.setValue.reset();
      await values.clearValue.mutateAsync({
        baseRevision,
        definitionId: item.definition.id,
      });
    } else {
      values.clearValue.reset();
      await values.setValue.mutateAsync({
        baseRevision,
        definitionId: item.definition.id,
        payload: nextValue,
      });
    }
  }

  return (
    <section aria-label="Custom field" className="space-y-4">
      <h4 className="text-sm font-medium">Custom field</h4>
      <CustomFieldValueInputs
        busy={busy}
        commit={commit}
        draftValues={draftValues}
        formattingPreferences={formattingPreferences}
        items={items}
        recordId={recordId}
      />
      {writeError ? (
        <p className="text-sm text-destructive" role="alert">
          {writeError.message || "Custom field values could not be saved."}
        </p>
      ) : null}
    </section>
  );
}

function CustomFieldValueInputs({
  items,
  draftValues,
  recordId,
  busy,
  commit,
  formattingPreferences,
}: {
  items: CustomFieldValueListItem[];
  draftValues: CustomFieldDraftValues;
  recordId: string | undefined;
  busy: boolean;
  commit: (
    item: CustomFieldValueListItem,
    nextValue: ParsedCustomFieldValuePayload | null,
    baseRevision?: number,
  ) => Promise<void>;
  formattingPreferences: AccountPreferences;
}) {
  return (
    <FieldGroup>
      <VirtualList
        as="div"
        estimateSize={120}
        gap={16}
        getKey={(item) => item.definition.id}
        rows={items}
      >
        {(item, rowProps) => {
          const current = customFieldValue(item, draftValues, recordId);
          const id = valueInputId(item.definition, recordId);
          return (
            <Field {...rowProps}>
              <FieldLabel htmlFor={id}>{item.definition.name}</FieldLabel>
              {item.definition.type === "Text" ||
              item.definition.type === "Number" ? (
                <CustomFieldScalarForm
                  current={current}
                  disabled={busy}
                  id={id}
                  kind={item.definition.type === "Text" ? "text" : "number"}
                  onCommit={(nextValue, baseRevision) =>
                    commit(item, nextValue, baseRevision)
                  }
                  revision={valueRevision(item)}
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
        }}
      </VirtualList>
    </FieldGroup>
  );
}

function availableCustomFieldItems(
  recordId: string | undefined,
  recordItems: CustomFieldValueListItem[] | undefined,
  storedItems: CustomFieldValueListItem[] | undefined,
  definitions: CustomFieldDefinition[] | undefined,
  recordType: CustomFieldRecordType,
): CustomFieldValueListItem[] {
  if (recordId) {
    return (recordItems ?? storedItems ?? []).filter((item) =>
      isAvailableOnRecord(item.definition, recordType),
    );
  }
  return (definitions ?? [])
    .filter((definition) => isAvailableOnRecord(definition, recordType))
    .map((definition) => ({ definition, value: null }));
}
