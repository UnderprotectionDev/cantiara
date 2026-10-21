// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker's local selection.
import {
  PRODUCT_GAP_LABEL,
  PRODUCT_GAP_LINK_MAX,
  PRODUCT_GAP_LINK_TARGET_TYPES,
  type ProductGapLinkTarget,
  type ProductGapLinkTargetType,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useCallback, useEffect, useId, useState } from "react";
import type { LinkDraft } from "../lib/product-gap-form";

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
  value,
}: {
  idPrefix: string;
  /** Names the group; the close form names it for the restored records. */
  legend?: string;
  loadTargets: LoadProductGapTargets;
  onChange: (links: LinkDraft[]) => void;
  value: LinkDraft[];
}) {
  const statusId = useId();
  const [targetType, setTargetType] =
    useState<ProductGapLinkTargetType>("Project");
  const [targets, setTargets] = useState<ProductGapLinkTarget[] | null>(null);
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");

  const selected = targets?.find((target) => target.targetId === targetId);

  const chooseType = useCallback(
    async (next: ProductGapLinkTargetType) => {
      setTargetType(next);
      setTargets(null);
      setTargetId("");
      setMessage("");
      try {
        const loaded = await loadTargets(next);
        setTargets(loaded);
        if (loaded.length === 0) {
          setMessage(`This Workspace has no ${next} to relate yet.`);
        }
      } catch {
        setMessage(`${next} records could not be loaded.`);
      }
    },
    [loadTargets],
  );

  useEffect(() => {
    chooseType("Project").catch(() => undefined);
  }, [chooseType]);

  function add() {
    if (!selected) {
      return;
    }
    const duplicate = value.some(
      (item) =>
        item.targetType === selected.targetType &&
        item.targetId === selected.targetId,
    );
    if (duplicate) {
      setMessage(`${selected.label} is already related.`);
      return;
    }
    onChange([
      ...value,
      {
        label: `${selected.targetType}: ${selected.label}`,
        targetId: selected.targetId,
        targetType: selected.targetType,
      },
    ]);
    setTargetId("");
    setMessage(`${selected.label} added to related records.`);
  }

  function remove(index: number) {
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(removed ? `${removed.label} removed from related records.` : "");
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-sm">{legend}</legend>
      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm">No related records.</p>
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
        <p className="text-muted-foreground text-sm">
          A {PRODUCT_GAP_LABEL} has at most {PRODUCT_GAP_LINK_MAX} related
          records.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-link-type`}>Related record type</label>
            <NativeSelect
              id={`${idPrefix}-link-type`}
              onChange={(event) =>
                chooseType(
                  event.target.value as ProductGapLinkTargetType,
                ).catch(() => undefined)
              }
              value={targetType}
            >
              {PRODUCT_GAP_LINK_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-link-target`}>Related record</label>
            <NativeSelect
              aria-describedby={statusId}
              id={`${idPrefix}-link-target`}
              onChange={(event) => setTargetId(event.target.value)}
              value={targetId}
            >
              <option value="">Choose a {targetType}</option>
              {(targets ?? []).map((target) => (
                <option key={target.targetId} value={target.targetId}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={!selected}
              onClick={add}
              size="sm"
              type="button"
              variant="outline"
            >
              Add related record
            </Button>
          </div>
        </div>
      )}
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm"
        id={statusId}
        role="status"
      >
        {message}
      </p>
    </fieldset>
  );
}
