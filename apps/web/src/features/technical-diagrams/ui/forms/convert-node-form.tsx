// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own selection fields.
import { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import { USER_FLOW_CONVERT_TARGETS } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { convertNodeSchema } from "../../lib/technical-diagram-form-schemas";

export type Target = (typeof USER_FLOW_CONVERT_TARGETS)[number];
export const WORK_TYPES = ["Task", "Bug", "Research", "Improvement"] as const;

export function ConvertNodeForm({
  disabled,
  onCancelConvert,
  onPreviewConvert,
  versions,
}: {
  disabled: boolean;
  onCancelConvert: () => void;
  onPreviewConvert: (input: {
    nodeId: string;
    target: Target;
    versionId: string;
    workType: (typeof WORK_TYPES)[number];
  }) => void;
  versions: TechnicalDiagramVersion[];
}) {
  const versionId = useId();
  const nodeId = useId();
  const targetId = useId();
  const workTypeId = useId();
  const form = useForm({
    defaultValues: {
      nodeId: "",
      target: "Work" as Target,
      versionId: "",
      workType: "Task" as (typeof WORK_TYPES)[number],
    },
    onSubmit: ({ value }) => {
      if (!convertNodeSchema.safeParse(value).success) {
        return;
      }
      onPreviewConvert(value);
    },
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="versionId">
        {(field) => (
          <>
            <Label htmlFor={versionId}>Diagram Version</Label>
            <NativeSelect
              id={versionId}
              onChange={(event) => {
                field.handleChange(event.target.value);
                form.setFieldValue("nodeId", "");
                // The selects changed while the plan stays shown; the
                // previewed plan belongs to the previous selection.
                onCancelConvert();
              }}
              value={field.state.value}
            >
              <NativeSelectOption value="">
                Choose a Diagram Version
              </NativeSelectOption>
              {versions.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name} · version {item.number}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.versionId}>
        {(selectedVersion) => {
          const version = versions.find(({ id }) => id === selectedVersion);
          const nodes = version ? diagramGraph(version.model).nodes : [];
          return (
            <form.Field name="nodeId">
              {(field) => (
                <>
                  <Label htmlFor={nodeId}>Node</Label>
                  <NativeSelect
                    id={nodeId}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      onCancelConvert();
                    }}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Choose a node
                    </NativeSelectOption>
                    {nodes.map((node) => (
                      <NativeSelectOption key={node.id} value={node.id}>
                        {node.kind} · {node.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </>
              )}
            </form.Field>
          );
        }}
      </form.Subscribe>
      <form.Field name="target">
        {(field) => (
          <>
            <Label htmlFor={targetId}>Target type</Label>
            <NativeSelect
              id={targetId}
              onChange={(event) => {
                field.handleChange(event.target.value as Target);
                onCancelConvert();
              }}
              value={field.state.value}
            >
              {USER_FLOW_CONVERT_TARGETS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.target}>
        {(target) =>
          target === "Work" ? (
            <form.Field name="workType">
              {(field) => (
                <>
                  <Label htmlFor={workTypeId}>Work type</Label>
                  <NativeSelect
                    id={workTypeId}
                    onChange={(event) => {
                      field.handleChange(
                        event.target.value as (typeof WORK_TYPES)[number],
                      );
                      onCancelConvert();
                    }}
                    value={field.state.value}
                  >
                    {WORK_TYPES.map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {item}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={disabled || !(values.versionId && values.nodeId)}
            type="submit"
            variant="outline"
          >
            Preview conversion
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
