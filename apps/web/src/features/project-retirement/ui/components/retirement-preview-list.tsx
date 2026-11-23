// biome-ignore-all lint/performance/noJsxPropsBind: Rows render the preview labels provided by the caller.
import { VirtualList } from "@cantiara/ui/components/virtual-list";

export function RetirementPreviewList({
  items,
  title,
}: {
  items: readonly (string | { id: string; label: string })[];
  title: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <section
          aria-label={title}
          className="max-h-64 overflow-y-auto pl-5"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users can scroll large read-only previews.
          tabIndex={0}
        >
          <VirtualList
            className="list-disc space-y-0.5 text-sm"
            estimateSize={20}
            gap={2}
            getKey={(item) => (typeof item === "string" ? item : item.id)}
            rows={items}
          >
            {(item, rowProps) => (
              <li {...rowProps}>
                {typeof item === "string" ? item : item.label}
              </li>
            )}
          </VirtualList>
        </section>
      )}
    </div>
  );
}
