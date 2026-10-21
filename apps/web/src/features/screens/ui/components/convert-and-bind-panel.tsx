// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block.
import {
  CONVERT_AND_BIND_TARGET_TYPES,
  type ConvertAndBindPlan,
  type ConvertAndBindTargetType,
  type ScreenBlockOriginView,
} from "@cantiara/api/screen-origins";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";

const WORK_TYPES = ["Task", "Bug", "Research", "Improvement"] as const;

export interface ConvertPreviewRequest {
  blockId: string;
  targetType: ConvertAndBindTargetType;
  title?: string;
  workType?: (typeof WORK_TYPES)[number];
}

export interface ConvertAndBindActions {
  /** Confirms the exact previewed plan; creates exactly one record. */
  confirm: (plan: ConvertAndBindPlan) => Promise<ScreenBlockOriginView>;
  /** Read-only: nothing exists until `confirm`. */
  preview: (input: ConvertPreviewRequest) => Promise<ConvertAndBindPlan>;
}

/**
 * `Convert and Bind` on the selected block, mounted in the inspector area
 * beside the compact outline. It previews one target, creates nothing until
 * `Confirm`, and never touches the block or the canvas.
 */
export function ConvertAndBindPanel({
  actions,
  blockId,
}: {
  actions: ConvertAndBindActions;
  blockId: string;
}) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] =
    useState<ConvertAndBindTargetType>("Decision");
  const [workType, setWorkType] = useState<(typeof WORK_TYPES)[number]>("Task");
  const [title, setTitle] = useState("");
  const [plan, setPlan] = useState<ConvertAndBindPlan>();
  const [created, setCreated] = useState<ScreenBlockOriginView>();
  const [error, setError] = useState<string>();

  function close() {
    setOpen(false);
    setPlan(undefined);
    setError(undefined);
  }

  async function run(action: () => Promise<void>, message: string) {
    setError(undefined);
    try {
      await action();
    } catch {
      setError(message);
    }
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <Button
          onClick={() => {
            setCreated(undefined);
            setOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Convert and Bind
        </Button>
        {created ? (
          <p className="text-xs" role="status">
            Created {created.target.type}: {created.target.title}. Origin
            Location: Wireframe version {created.location.wireframeVersion}.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <fieldset
      aria-label="Convert and Bind"
      className="space-y-2 rounded-lg border border-border/70 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs" htmlFor="convert-target-type">
          Target type
        </label>
        <NativeSelect
          id="convert-target-type"
          onChange={(event) => {
            setTargetType(event.target.value as ConvertAndBindTargetType);
            setPlan(undefined);
          }}
          value={targetType}
        >
          {CONVERT_AND_BIND_TARGET_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {type}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {targetType === "Work" ? (
          <>
            <label className="text-xs" htmlFor="convert-work-type">
              Work type
            </label>
            <NativeSelect
              id="convert-work-type"
              onChange={(event) => {
                setWorkType(event.target.value as (typeof WORK_TYPES)[number]);
                setPlan(undefined);
              }}
              value={workType}
            >
              {WORK_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        ) : null}
        <label className="text-xs" htmlFor="convert-title">
          Title
        </label>
        <Input
          className="w-56"
          id="convert-title"
          onChange={(event) => {
            setTitle(event.target.value);
            setPlan(undefined);
          }}
          placeholder="From the block"
          value={title}
        />
        <Button
          onClick={() =>
            run(async () => {
              setPlan(
                await actions.preview({
                  blockId,
                  targetType,
                  ...(title.trim() ? { title: title.trim() } : {}),
                  ...(targetType === "Work" ? { workType } : {}),
                }),
              );
            }, "Preview is unavailable.")
          }
          size="sm"
          type="button"
        >
          Preview
        </Button>
        <Button onClick={close} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
      {plan ? (
        <dl aria-label="Convert and Bind preview" className="space-y-1 text-xs">
          <div>
            <dt className="inline font-medium">Target type: </dt>
            <dd className="inline">{plan.targetType}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Project: </dt>
            <dd className="inline">{plan.targetProject.name}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Title: </dt>
            <dd className="inline">{plan.title}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Body: </dt>
            <dd className="inline">{plan.body}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Origin: </dt>
            <dd className="inline">{plan.screenTitle}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Origin Location: </dt>
            <dd className="inline">
              {plan.screenTitle}, block {plan.originLocation.blockId}, Wireframe
              version {plan.originLocation.wireframeVersion}
            </dd>
          </div>
        </dl>
      ) : null}
      {plan ? (
        <Button
          onClick={() =>
            run(async () => {
              setCreated(await actions.confirm(plan));
              close();
            }, "The preview is out of date. Preview again.")
          }
          size="sm"
          type="button"
        >
          Confirm
        </Button>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
