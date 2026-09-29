import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { diffLines } from "diff";

type ComparedDocument = Pick<Document, "body" | "revision" | "title" | "type">;

interface DocumentVersionCompareProps {
  current: ComparedDocument;
  onRestore: () => void;
  pending: boolean;
  selected: ComparedDocument;
  unsavedChanges: boolean;
}

function formatPart(part: {
  value: string;
  added?: boolean;
  removed?: boolean;
}) {
  let presentation: { className?: string; prefix: string } = { prefix: "  " };
  if (part.added) {
    presentation = {
      className:
        "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
      prefix: "+ ",
    };
  } else if (part.removed) {
    presentation = {
      className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
      prefix: "- ",
    };
  }
  return {
    className: presentation.className,
    text: part.value.replace(/^(.+)/gm, `${presentation.prefix}$1`),
  };
}

export default function DocumentVersionCompare({
  current,
  selected,
  onRestore,
  pending,
  unsavedChanges,
}: DocumentVersionCompareProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h4 className="font-medium">Compare</h4>
      <p>
        Version {selected.revision} → Version {current.revision}
      </p>
      <p>
        {selected.title} → {current.title}
      </p>
      <p>
        {selected.type} → {current.type}
      </p>
      <section aria-label="Compare">
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm">
          {diffLines(selected.body, current.body).map((part, index) => {
            const formatted = formatPart(part);
            return (
              <span
                className={formatted.className}
                // biome-ignore lint/suspicious/noArrayIndexKey: Diff chunks have no stable identity and are read-only.
                key={index}
              >
                {formatted.text}
              </span>
            );
          })}
        </pre>
      </section>
      {selected.revision === current.revision ? null : (
        <Button
          disabled={pending || unsavedChanges}
          onClick={onRestore}
          type="button"
        >
          Restore
        </Button>
      )}
      {unsavedChanges ? (
        <p>Save your current changes before restoring a version.</p>
      ) : null}
    </div>
  );
}
