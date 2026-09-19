// biome-ignore-all lint/performance/noJsxPropsBind: Project area controls close over their current area state.
import {
  isProjectCoreArea,
  type ProjectArea,
  type ProjectShellConfigurationChange,
} from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Check } from "lucide-react";
import { useCallback } from "react";

export function projectAreaAvailabilityLabel(
  enabled: boolean,
  hidden: boolean,
) {
  if (!enabled) {
    return "Available";
  }
  return hidden ? "Hidden" : "Enabled";
}

export function ProjectAreaAvailability({
  area,
  configurationMode,
  disabled,
  enabled,
  hidden,
  onChange,
  onEnable,
  onReorder,
  pinned,
  pinnedCount,
  pinnedIndex,
}: {
  area: ProjectArea;
  configurationMode: boolean;
  disabled: boolean;
  enabled: boolean;
  hidden: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnable: (area: ProjectArea) => void;
  onReorder: (area: ProjectArea, direction: -1 | 1) => void;
  pinned: boolean;
  pinnedCount: number;
  pinnedIndex: number;
}) {
  if (!enabled && configurationMode) {
    return (
      <EnableProjectAreaButton
        area={area}
        disabled={disabled}
        onEnable={onEnable}
      />
    );
  }

  if (!enabled) {
    return (
      <span className="text-muted-foreground text-xs">Configuration Mode</span>
    );
  }

  if (!configurationMode) {
    return hidden ? (
      <span className="text-muted-foreground text-xs">Hidden</span>
    ) : (
      <Check aria-hidden="true" className="size-3" />
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {pinned ? (
        <>
          <Button
            aria-label={`Move ${area} up`}
            disabled={disabled || pinnedIndex <= 0}
            onClick={() => onReorder(area, -1)}
            size="xs"
            type="button"
            variant="ghost"
          >
            ↑
          </Button>
          <Button
            aria-label={`Move ${area} down`}
            disabled={disabled || pinnedIndex >= pinnedCount - 1}
            onClick={() => onReorder(area, 1)}
            size="xs"
            type="button"
            variant="ghost"
          >
            ↓
          </Button>
        </>
      ) : null}
      <Button
        aria-label={`${hidden ? "Show" : "Hide"} ${area}`}
        disabled={disabled}
        onClick={() =>
          onChange({ area, kind: "set-area-visibility", visible: hidden })
        }
        size="xs"
        type="button"
        variant="outline"
      >
        {hidden ? "Show" : "Hide"}
      </Button>
      {isProjectCoreArea(area) ? null : (
        <Button
          aria-label={
            pinned ? `Remove ${area} from navigation` : "Pin to navigation"
          }
          disabled={disabled}
          onClick={() =>
            onChange({ kind: pinned ? "unpin-area" : "pin-area", area })
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          {pinned ? "Remove pin" : "Pin to navigation"}
        </Button>
      )}
    </div>
  );
}

function EnableProjectAreaButton({
  area,
  disabled,
  onEnable,
}: {
  area: ProjectArea;
  disabled: boolean;
  onEnable: (area: ProjectArea) => void;
}) {
  const handleClick = useCallback(() => onEnable(area), [area, onEnable]);

  return (
    <Button
      aria-label={`Enable ${area}`}
      disabled={disabled}
      onClick={handleClick}
      size="xs"
      type="button"
      variant="outline"
    >
      Enable
    </Button>
  );
}
