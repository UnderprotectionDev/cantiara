// biome-ignore-all lint/performance/noJsxPropsBind: Each form binds its own field state.

import type {
  CreatableAuthorityMode,
  ExternalSourceLink,
} from "@cantiara/api/technical-diagram-authority";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { commandVariables } from "@/lib/command-variables";
import { fetchFresh } from "@/lib/fetch-fresh";
import { submitForm } from "@/lib/submit-form";
import { client, orpc } from "@/utils/orpc";
import { conversionSchema } from "../../lib/technical-diagram-form-schemas";

const TARGET_MODES: CreatableAuthorityMode[] = [
  "Product-authored Model",
  "Imported Independent Copy",
  "External Source Link",
];

type ConversionValues = z.infer<typeof conversionSchema>;

export function DiagramAuthorityConversion({
  diagram,
}: {
  diagram: TechnicalDiagramSource;
}) {
  const queryClient = useQueryClient();
  const targets = TARGET_MODES.filter(
    (mode) =>
      mode !== diagram.authorityMode &&
      !(
        mode === "Imported Independent Copy" &&
        diagram.authorityMode === "External Source Link"
      ),
  );
  const request = (values: ConversionValues) => {
    const externalSource: ExternalSourceLink | undefined =
      values.targetMode === "External Source Link"
        ? {
            lastCheckedAt: new Date().toISOString(),
            revision: values.revision.trim() || null,
            tool: values.tool,
            url: values.url,
          }
        : undefined;
    return {
      ...(externalSource ? { externalSource } : {}),
      sourceDiagramId: diagram.id,
      targetMode: values.targetMode as CreatableAuthorityMode,
      title: values.title,
    };
  };
  const previewMutation = useMutation({
    meta: { retryInSurface: true },
    mutationKey: orpc.previewDiagramAuthorityConversion.mutationKey(),
    mutationFn: (input: ReturnType<typeof request>) =>
      fetchFresh(queryClient, {
        ...orpc.previewDiagramAuthorityConversion.queryOptions({ input }),
        gcTime: 0,
      }),
  });
  const confirmMutation = useMutation(
    orpc.convertDiagramAuthority.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.convertDiagramAuthority(input),
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.technicalDiagrams.key({
            input: { projectId: diagram.projectId },
          }),
        }),
    }),
  );
  function reset() {
    previewMutation.reset();
    confirmMutation.reset();
  }
  const preview = previewMutation.data;
  const form = useForm({
    defaultValues: {
      revision: "",
      targetMode: targets[0] ?? "",
      title: `${diagram.title} (converted)`,
      tool: "",
      url: "",
    } as ConversionValues,
    listeners: { onChange: reset },
    onSubmitMeta: { action: "preview" } as { action: "preview" | "confirm" },
    onSubmit: async ({ formApi, meta, value }) => {
      if (meta.action === "confirm") {
        const reviewed = previewMutation.variables;
        if (reviewed && preview?.canConvert) {
          await confirmMutation.mutateAsync(
            commandVariables(
              { ...reviewed, previewToken: preview.previewToken },
              confirmMutation.isError ? confirmMutation.variables : undefined,
            ),
          );
          formApi.reset();
          reset();
        }
        return;
      }
      const values = conversionSchema.safeParse(value);
      if (!values.success) {
        formApi.setErrorMap({
          onSubmit: { form: "Check the conversion fields.", fields: {} },
        });
        return;
      }
      confirmMutation.reset();
      await previewMutation.mutateAsync(request(values.data));
    },
  });
  const busy = useSelector(form.store, (state) => state.isSubmitting);
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const failure = confirmMutation.error ?? previewMutation.error;
  const fallback = confirmMutation.isError
    ? "Conversion failed."
    : "Preview failed.";
  const error =
    validationError ??
    (failure instanceof Error ? failure.message : failure && fallback);

  if (targets.length === 0) {
    return null;
  }
  return (
    <section aria-label="Convert authority" className="space-y-2">
      <h4 className="font-medium">Convert authority</h4>
      <p className="text-sm text-muted-foreground">
        Diagram Authority Mode never changes in place. Converting creates a new
        Technical Diagram that Originates from this one.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submitForm(form, { action: "preview" }).catch(() => undefined);
        }}
      >
        <fieldset className="space-y-2" disabled={busy}>
          <form.Field name="targetMode">
            {(field) => (
              <>
                <Label htmlFor={`authority-target-${diagram.id}`}>
                  Diagram Authority Mode
                </Label>
                <NativeSelect
                  id={`authority-target-${diagram.id}`}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as CreatableAuthorityMode,
                    )
                  }
                  value={field.state.value}
                >
                  {targets.map((mode) => (
                    <NativeSelectOption key={mode} value={mode}>
                      {mode}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </>
            )}
          </form.Field>
          <form.Field name="title">
            {(field) => (
              <>
                <Label htmlFor={`authority-title-${diagram.id}`}>Title</Label>
                <Input
                  id={`authority-title-${diagram.id}`}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                  value={field.state.value}
                />
              </>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.targetMode}>
            {(targetMode) =>
              targetMode === "External Source Link" ? (
                <>
                  <form.Field name="url">
                    {(field) => (
                      <>
                        <Label htmlFor={`authority-url-${diagram.id}`}>
                          HTTPS URL
                        </Label>
                        <Input
                          id={`authority-url-${diagram.id}`}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          required
                          type="url"
                          value={field.state.value}
                        />
                      </>
                    )}
                  </form.Field>
                  <form.Field name="tool">
                    {(field) => (
                      <>
                        <Label htmlFor={`authority-tool-${diagram.id}`}>
                          Source tool
                        </Label>
                        <Input
                          id={`authority-tool-${diagram.id}`}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          required
                          value={field.state.value}
                        />
                      </>
                    )}
                  </form.Field>
                  <form.Field name="revision">
                    {(field) => (
                      <>
                        <Label htmlFor={`authority-revision-${diagram.id}`}>
                          Known revision (optional)
                        </Label>
                        <Input
                          id={`authority-revision-${diagram.id}`}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          value={field.state.value}
                        />
                      </>
                    )}
                  </form.Field>
                </>
              ) : null
            }
          </form.Subscribe>
          <Button type="submit">Preview conversion</Button>
        </fieldset>
        {preview ? (
          <div className="space-y-2" role="status">
            <p>
              {preview.sourceMode} to {preview.targetMode}: a new Technical
              Diagram that Originates from this one.
            </p>
            <ul className="list-inside list-disc">
              {preview.loss.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{preview.history}</p>
            <Button
              disabled={!preview.canConvert || busy}
              onClick={() =>
                submitForm(form, { action: "confirm" }).catch(() => undefined)
              }
              type="button"
            >
              Confirm conversion
            </Button>
          </div>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
