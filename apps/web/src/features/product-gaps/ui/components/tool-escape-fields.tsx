// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import {
  PRODUCT_GAP_LINK_TARGET_TYPES,
  type ProductGapLinkTarget,
  type ProductGapLinkTargetType,
  TOOL_ESCAPE_LABEL,
  TOOL_ESCAPE_REASONS,
  TOOL_ESCAPE_TOOL_MAX,
  type ToolEscapeReason,
} from "@cantiara/api/product-gaps";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useEffect, useState } from "react";
import type { EscapeFormValues } from "../../lib/product-gap-form";
import type { LoadProductGapTargets } from "./product-gap-links-field";

/**
 * The Tool Escape half of `Record Product Gap`: when it happened, the Project
 * or record it left, the job, the external tool, one or more closed reasons
 * and an optional note. There is no severity, impact flag or content field.
 */
export function ToolEscapeFields({
  disabled,
  idPrefix,
  loadTargets,
  onChange,
  value,
}: {
  disabled: boolean;
  idPrefix: string;
  loadTargets: LoadProductGapTargets;
  onChange: (value: EscapeFormValues) => void;
  value: EscapeFormValues;
}) {
  const [sourceType, setSourceType] =
    useState<ProductGapLinkTargetType>("Project");
  const [targets, setTargets] = useState<ProductGapLinkTarget[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let current = true;
    setTargets([]);
    setLoadError(false);
    loadTargets(sourceType)
      .then((loaded) => {
        if (current) {
          setTargets(loaded);
        }
      })
      .catch(() => {
        if (current) {
          setLoadError(true);
        }
      });
    return () => {
      current = false;
    };
  }, [loadTargets, sourceType]);

  function toggle(reason: ToolEscapeReason, checked: boolean) {
    onChange({
      ...value,
      reasons: checked
        ? [...value.reasons, reason]
        : value.reasons.filter((item) => item !== reason),
    });
  }

  return (
    <FieldSet className="gap-3 rounded-md border border-border/70 p-3">
      <FieldLegend className="mb-0 px-1 text-sm" variant="label">
        {TOOL_ESCAPE_LABEL}
      </FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="gap-1 text-sm">
          <FieldLabel htmlFor={`${idPrefix}-occurred`}>Occurred at</FieldLabel>
          <Input
            disabled={disabled}
            id={`${idPrefix}-occurred`}
            onChange={(event) =>
              onChange({ ...value, occurredAt: event.target.value })
            }
            required
            type="datetime-local"
            value={value.occurredAt}
          />
        </Field>
        <Field className="gap-1 text-sm">
          <FieldLabel htmlFor={`${idPrefix}-tool`}>External tool</FieldLabel>
          <Input
            disabled={disabled}
            id={`${idPrefix}-tool`}
            maxLength={TOOL_ESCAPE_TOOL_MAX}
            onChange={(event) =>
              onChange({ ...value, tool: event.target.value })
            }
            required
            value={value.tool}
          />
        </Field>
        <Field className="gap-1 text-sm">
          <FieldLabel htmlFor={`${idPrefix}-source-type`}>
            Source type
          </FieldLabel>
          <NativeSelect
            disabled={disabled}
            id={`${idPrefix}-source-type`}
            onChange={(event) => {
              setSourceType(event.target.value as ProductGapLinkTargetType);
              onChange({ ...value, source: null });
            }}
            value={sourceType}
          >
            {PRODUCT_GAP_LINK_TARGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field className="gap-1 text-sm">
          <FieldLabel htmlFor={`${idPrefix}-source`}>Source</FieldLabel>
          <NativeSelect
            disabled={disabled}
            id={`${idPrefix}-source`}
            onChange={(event) => {
              const target = targets.find(
                (item) => item.targetId === event.target.value,
              );
              onChange({
                ...value,
                source: target
                  ? {
                      label: `${target.targetType}: ${target.label}`,
                      targetId: target.targetId,
                      targetType: target.targetType,
                    }
                  : null,
              });
            }}
            required
            value={value.source?.targetId ?? ""}
          >
            <option value="">Choose a {sourceType}</option>
            {targets.map((target) => (
              <option key={target.targetId} value={target.targetId}>
                {target.label}
              </option>
            ))}
          </NativeSelect>
          {loadError ? (
            <span role="alert">{sourceType} records could not be loaded.</span>
          ) : null}
        </Field>
      </div>
      <Field className="gap-1 text-sm">
        <FieldLabel htmlFor={`${idPrefix}-job`}>Intended job</FieldLabel>
        <Textarea
          disabled={disabled}
          id={`${idPrefix}-job`}
          onChange={(event) =>
            onChange({ ...value, intendedJob: event.target.value })
          }
          required
          rows={2}
          value={value.intendedJob}
        />
      </Field>
      <FieldSet className="gap-1 text-sm">
        <FieldLegend className="mb-0 text-sm" variant="label">
          Reasons (choose at least one)
        </FieldLegend>
        {TOOL_ESCAPE_REASONS.map((reason) => (
          <FieldLabel
            className="items-center text-sm"
            htmlFor={`${idPrefix}-reason-${reason}`}
            key={reason}
          >
            <Checkbox
              checked={value.reasons.includes(reason)}
              disabled={disabled}
              id={`${idPrefix}-reason-${reason}`}
              onCheckedChange={(checked) => toggle(reason, checked)}
            />
            {reason}
          </FieldLabel>
        ))}
      </FieldSet>
      <Field className="gap-1 text-sm">
        <FieldLabel htmlFor={`${idPrefix}-note`}>Note (optional)</FieldLabel>
        <Textarea
          disabled={disabled}
          id={`${idPrefix}-note`}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          rows={2}
          value={value.note}
        />
      </Field>
    </FieldSet>
  );
}
