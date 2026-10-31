// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  EXPORT_PERSONAL_DATA_LABEL,
  PERSONAL_DATA_FORMATS,
  type PersonalDataArtifact,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { Button } from "@cantiara/ui/components/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useEffect, useMemo, useRef, useState } from "react";

function Download({ artifact }: { artifact: PersonalDataArtifact }) {
  const url = useMemo(
    () =>
      URL.createObjectURL(
        new Blob([artifact.bytes], { type: artifact.mediaType }),
      ),
    [artifact],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <a
      className="font-medium text-sm underline"
      download={artifact.fileName}
      href={url}
    >
      Download {artifact.fileName}
    </a>
  );
}

/**
 * The closed-world review shown before the person package is produced: every
 * source that goes in, and what never does. Focus lands on the heading;
 * Escape cancels.
 */
export function PersonalDataPreviewPanel({
  disabled,
  onCancel,
  onConfirm,
  preview,
  produced,
}: {
  disabled: boolean;
  onCancel: () => void;
  onConfirm: (format: PersonalDataFormat) => void;
  preview: PersonalDataPreview;
  produced: PersonalDataArtifact | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [format, setFormat] = useState<PersonalDataFormat>("JSON");
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape cancels the review for keyboard users.
    <section
      aria-labelledby="personal-data-preview-title"
      className="space-y-4 rounded-lg border border-border/70 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    >
      <h3
        className="font-medium"
        id="personal-data-preview-title"
        ref={heading}
        tabIndex={-1}
      >
        {EXPORT_PERSONAL_DATA_LABEL}: {preview.contactLabel}
      </h3>
      <p className="text-sm" role="note">
        {preview.notice}
      </p>
      <section className="space-y-1">
        <h4 className="font-medium text-sm">Included sources</h4>
        <ul aria-label="Sources in this package" className="space-y-2 text-sm">
          {preview.sources.map((source) => (
            <li key={source.kind}>
              {source.kind}: {source.items.length}
              {source.items.length > 0 ? (
                <ul aria-label={`${source.kind} in this package`}>
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
        <h4 className="font-medium text-sm">Never included</h4>
        <ul aria-label="Left out of this package" className="text-sm">
          {preview.excluded.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <fieldset className="space-y-2">
        <legend className="font-medium text-sm">Format</legend>
        <RadioGroup
          className="flex gap-4"
          disabled={disabled}
          name="personal-data-format"
          onValueChange={(value) => setFormat(value as PersonalDataFormat)}
          value={format}
        >
          {PERSONAL_DATA_FORMATS.map((option) => (
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor={`personal-data-format-${option}`}
              key={option}
            >
              <RadioGroupItem
                id={`personal-data-format-${option}`}
                value={option}
              />
              {option}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="flex gap-2">
        <Button
          disabled={disabled}
          onClick={() => onConfirm(format)}
          type="button"
        >
          Create package
        </Button>
        <Button
          disabled={disabled}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      {produced ? <Download artifact={produced} /> : null}
    </section>
  );
}
