import type { DocumentInlineTag } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { useMemo } from "react";

export default function DocumentInlineTags({
  body,
  onSelect,
  savedBody,
  tags,
}: {
  body: string;
  onSelect: (tag: DocumentInlineTag) => void;
  savedBody: string;
  tags: readonly DocumentInlineTag[];
}) {
  const handleTagSelection = useMemo(
    () => tags.map((tag) => () => onSelect(tag)),
    [onSelect, tags],
  );

  return (
    <fieldset aria-label="Tags" className="flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <Button
          data-tag-id={tag.tagId}
          disabled={body !== savedBody}
          key={`${tag.tagId}:${tag.start}`}
          onClick={handleTagSelection[index]}
          type="button"
          variant="secondary"
        >
          #{tag.name}
        </Button>
      ))}
    </fieldset>
  );
}
