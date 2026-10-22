// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
  WORK_CONTEXT_CUSTOM_RELATION_OPTIONS,
  WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS,
  type WorkContextCustomSection,
  workContextCustomSectionSchema,
} from "@cantiara/api/work-context";
import { WORK_STATUS_OPTIONS } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import {
  CONDITION_KINDS,
  type CustomSectionValues,
  conditionFromDraft,
  pickOption,
} from "../../lib/work-context-custom-section-form";

const EMPTY_STATUS = "";

export function WorkContextCustomSectionForm({
  busy,
  onAdd,
  onError,
}: {
  busy: boolean;
  onAdd: (section: WorkContextCustomSection) => void;
  onError: (message: string | null) => void;
}) {
  const form = useForm({
    defaultValues: {
      conditionKind: "record-type",
      evidenceRole: "Supports",
      recordType: "Decision",
      relation: "Related",
      status: EMPTY_STATUS,
      title: "",
    } as CustomSectionValues,
    onSubmit: ({ formApi, value }) => {
      if (!value.title.trim()) {
        return;
      }
      const parsed = workContextCustomSectionSchema.safeParse({
        condition: conditionFromDraft(value),
        id: `custom-${crypto.randomUUID()}`,
        title: value.title,
      });
      if (!parsed.success) {
        onError(parsed.error.issues[0]?.message ?? "Check the custom section.");
        return;
      }
      onAdd(parsed.data);
      formApi.setFieldValue("title", "");
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const { conditionKind, title } = values;
  const statusLabel =
    pickOption(WORK_STATUS_OPTIONS, values.status) ?? "Any status";
  return (
    <form
      aria-label="Add custom section"
      className="space-y-3 border border-border/80 border-dashed p-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h5 className="font-medium text-sm">Add custom section</h5>
      <form.Field name="title">
        {(field) => (
          <label
            className="grid gap-1 text-xs"
            htmlFor="work-context-custom-section-title"
          >
            Section name
            <Input
              disabled={busy}
              id="work-context-custom-section-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field name="conditionKind">
          {(field) => (
            <label
              className="grid gap-1 text-xs"
              htmlFor="work-context-condition-kind"
            >
              Condition
              <NativeSelect
                disabled={busy}
                id="work-context-condition-kind"
                name={field.name}
                onChange={(event) => {
                  const next = pickOption(CONDITION_KINDS, event.target.value);
                  if (next) {
                    field.handleChange(next);
                  }
                }}
                value={field.state.value}
              >
                <NativeSelectOption value="record-type">
                  Record type
                </NativeSelectOption>
                <NativeSelectOption value="relation">
                  Relation
                </NativeSelectOption>
                <NativeSelectOption value="evidence-role">
                  Evidence Role
                </NativeSelectOption>
              </NativeSelect>
            </label>
          )}
        </form.Field>
        {conditionKind === "record-type" ? (
          <form.Field name="recordType">
            {(field) => (
              <label
                className="grid gap-1 text-xs"
                htmlFor="work-context-record-type"
              >
                Record type
                <NativeSelect
                  disabled={busy}
                  id="work-context-record-type"
                  name={field.name}
                  onChange={(event) => {
                    const next = pickOption(
                      WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
                      event.target.value,
                    );
                    if (next) {
                      field.handleChange(next);
                    }
                  }}
                  value={field.state.value}
                >
                  {WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </form.Field>
        ) : null}
        {conditionKind === "relation" ? (
          <form.Field name="relation">
            {(field) => (
              <label
                className="grid gap-1 text-xs"
                htmlFor="work-context-relation"
              >
                Relation
                <NativeSelect
                  disabled={busy}
                  id="work-context-relation"
                  name={field.name}
                  onChange={(event) => {
                    const next = pickOption(
                      WORK_CONTEXT_CUSTOM_RELATION_OPTIONS,
                      event.target.value,
                    );
                    if (next) {
                      field.handleChange(next);
                    }
                  }}
                  value={field.state.value}
                >
                  {WORK_CONTEXT_CUSTOM_RELATION_OPTIONS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </form.Field>
        ) : null}
        {conditionKind === "evidence-role" ? (
          <form.Field name="evidenceRole">
            {(field) => (
              <label
                className="grid gap-1 text-xs"
                htmlFor="work-context-evidence-role"
              >
                Evidence Role
                <NativeSelect
                  disabled={busy}
                  id="work-context-evidence-role"
                  name={field.name}
                  onChange={(event) => {
                    const next = pickOption(
                      WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS,
                      event.target.value,
                    );
                    if (next) {
                      field.handleChange(next);
                    }
                  }}
                  value={field.state.value}
                >
                  {WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </form.Field>
        ) : null}
      </div>
      <form.Field name="status">
        {(field) => (
          <label
            className="grid max-w-xs gap-1 text-xs"
            htmlFor="work-context-status-condition"
          >
            Status condition
            <NativeSelect
              disabled={busy}
              id="work-context-status-condition"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value={EMPTY_STATUS}>
                Any status
              </NativeSelectOption>
              {WORK_STATUS_OPTIONS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <p className="text-muted-foreground text-xs">
        Only records reachable from the open Work through the selected catalog
        condition are shown.
      </p>
      <Button disabled={busy || !title.trim()} size="xs" type="submit">
        Add custom section
      </Button>
      <p className="text-muted-foreground text-xs">
        Current status filter: {statusLabel}
      </p>
    </form>
  );
}
