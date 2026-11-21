// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker's local selection.

import {
  PRODUCT_GAP_LABEL,
  PRODUCT_GAP_LINK_MAX,
  PRODUCT_GAP_LINK_TARGET_TYPES,
  type ProductGapLinkTarget,
  type ProductGapLinkTargetType,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@cantiara/ui/components/field";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { type Ref, useId, useImperativeHandle } from "react";
import { submitForm } from "@/lib/submit-form";
import { useProductGapLinkTargets } from "../../hooks/use-product-gap-link-targets";
import type { LinkDraft } from "../../lib/product-gap-form";

export type LoadProductGapTargets = (
  targetType: ProductGapLinkTargetType,
) => Promise<ProductGapLinkTarget[]>;

/**
 * Related records are chosen from the live owner records of the Workspace,
 * never typed as a title. Every control is a native labelled form control, so
 * the field is fully operable from the keyboard and read by a screen reader.
 */
export function ProductGapLinksField({
  idPrefix,
  legend = "Related records",
  loadTargets,
  onChange,
  resetRef,
  value,
}: {
  idPrefix: string;
  /** Names the group; the close form names it for the restored records. */
  legend?: string;
  loadTargets: LoadProductGapTargets;
  onChange: (links: LinkDraft[]) => void;
  resetRef?: Ref<() => void>;
  value: LinkDraft[];
}) {
  const statusId = useId();
  const announcement = useCreateStore("", ({ setState }) => ({
    setMessage: (text: string) => setState(() => text),
  }));
  const message = useSelector(announcement);
  const { setMessage } = announcement.actions;
  const picker = useForm({
    defaultValues: {
      targetType: "Project" as ProductGapLinkTargetType,
      targetId: "",
    },
    onSubmit: ({ formApi }) => {
      setMessage("");
      const error = add();
      if (error) {
        formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      }
    },
  });
  useImperativeHandle(
    resetRef,
    () => () => {
      picker.reset();
      setMessage("");
    },
    [picker, setMessage],
  );
  const { targetType, targetId } = useSelector(
    picker.store,
    (state) => state.values,
  );
  const targetsQuery = useProductGapLinkTargets(loadTargets, targetType);
  const targets = targetsQuery.data;

  const selected = targets?.find((target) => target.targetId === targetId);

  function chooseType(next: ProductGapLinkTargetType) {
    picker.reset(
      { targetType: next, targetId: "" },
      { keepDefaultValues: true },
    );
    setMessage("");
  }

  let loadMessage = "";
  if (targetsQuery.isError) {
    loadMessage = `${targetType} records could not be loaded.`;
  } else if (targets?.length === 0) {
    loadMessage = `This Workspace has no ${targetType} to relate yet.`;
  }

  function add(): string | undefined {
    if (!selected) {
      return undefined;
    }
    const duplicate = value.some(
      (item) =>
        item.targetType === selected.targetType &&
        item.targetId === selected.targetId,
    );
    if (duplicate) {
      return `${selected.label} is already related.`;
    }
    onChange([
      ...value,
      {
        label: `${selected.targetType}: ${selected.label}`,
        targetId: selected.targetId,
        targetType: selected.targetType,
      },
    ]);
    picker.setFieldValue("targetId", "");
    setMessage(`${selected.label} added to related records.`);
    return undefined;
  }

  function remove(index: number) {
    picker.setErrorMap({ onSubmit: undefined });
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(removed ? `${removed.label} removed from related records.` : "");
  }

  return (
    <FieldSet className="gap-3 rounded-md border border-border/70 p-3">
      <FieldLegend className="mb-0 px-1 text-sm" variant="label">
        {legend}
      </FieldLegend>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No related records.</p>
      ) : (
        <ul aria-label="Selected related records" className="space-y-1 text-sm">
          {value.map((link, index) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={`${link.targetType}:${link.targetId}`}
            >
              <span>{link.label}</span>
              <Button
                aria-label={`Remove related record ${link.label}`}
                onClick={() => remove(index)}
                size="sm"
                type="button"
                variant="outline"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {value.length >= PRODUCT_GAP_LINK_MAX ? (
        <p className="text-sm text-muted-foreground">
          A {PRODUCT_GAP_LABEL} has at most {PRODUCT_GAP_LINK_MAX} related
          records.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="gap-1 text-sm">
            <FieldLabel htmlFor={`${idPrefix}-link-type`}>
              Related record type
            </FieldLabel>
            <NativeSelect
              id={`${idPrefix}-link-type`}
              onChange={(event) =>
                chooseType(event.target.value as ProductGapLinkTargetType)
              }
              value={targetType}
            >
              {PRODUCT_GAP_LINK_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="gap-1 text-sm">
            <FieldLabel htmlFor={`${idPrefix}-link-target`}>
              Related record
            </FieldLabel>
            <NativeSelect
              aria-describedby={statusId}
              id={`${idPrefix}-link-target`}
              onChange={(event) => {
                picker.setErrorMap({ onSubmit: undefined });
                picker.setFieldValue("targetId", event.target.value);
              }}
              value={targetId}
            >
              <option value="">Choose a {targetType}</option>
              {(targets ?? []).map((target) => (
                <option key={target.targetId} value={target.targetId}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <Button
              disabled={!selected}
              onClick={() => submitForm(picker).catch(() => undefined)}
              size="sm"
              type="button"
              variant="outline"
            >
              Add related record
            </Button>
          </div>
        </div>
      )}
      <picker.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
        {(error) =>
          typeof error === "string" ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null
        }
      </picker.Subscribe>
      <p
        aria-live="polite"
        className="text-sm text-muted-foreground"
        id={statusId}
        role="status"
      >
        {message || loadMessage}
      </p>
    </FieldSet>
  );
}
