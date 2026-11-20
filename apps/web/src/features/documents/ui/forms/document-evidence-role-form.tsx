// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.

import {
  type DocumentEvidenceBinding,
  EVIDENCE_ROLES,
  type EvidenceRole,
} from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { client, orpc } from "@/utils/orpc";
import { documentEvidenceRoleFormSchema } from "../../lib/document-evidence-form";
import { EvidenceRoleHistory } from "../components/document-evidence-role-history";

/** Role is the founder's own choice on the relation; interpretation is separate from the source text. */
export default function DocumentEvidenceRoleForm({
  binding,
  record,
}: {
  binding: DocumentEvidenceBinding;
  record: Document;
}) {
  const setDocumentEvidenceRoleMutation = useMutation(
    orpc.setDocumentEvidenceRole.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setDocumentEvidenceRole(input),
    }),
  );
  const cache = useQueryClient();

  const command = useRef<string | null>(null);
  const selection = {
    documentId: record.id,
    projectId: record.projectId ?? "",
  };
  const history = useQuery({
    ...orpc.documentEvidenceHistory.queryOptions({
      input: { ...selection, id: binding.id },
    }),
    enabled: Boolean(record.projectId),
  });
  const form = useForm({
    defaultValues: {
      interpretation: binding.interpretation ?? "",
      role: binding.role as EvidenceRole,
    },
    onSubmit: async ({ value }) => {
      const parsed = documentEvidenceRoleFormSchema.safeParse(value);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: "Evidence Role could not be saved. Reload and try again.",
            fields: {},
          },
        });
        return;
      }
      command.current ??= crypto.randomUUID();
      form.setErrorMap({ onSubmit: undefined });
      try {
        await setDocumentEvidenceRoleMutation.mutateAsync({
          ...selection,
          id: binding.id,
          baseRevision: binding.revision,
          clientIdempotencyKey: command.current ?? crypto.randomUUID(),
          role: parsed.data.role,
          interpretation: parsed.data.interpretation,
        });
        command.current = null;
        await cache.invalidateQueries({
          queryKey: orpc.documentEvidenceBindings.key(),
        });
        await cache.invalidateQueries({
          queryKey: orpc.documentEvidenceHistory.key(),
        });
      } catch {
        form.setErrorMap({
          onSubmit: {
            form: "Evidence Role could not be saved. Reload and try again.",
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const values = useSelector(form.store, (state) => state.values);
  const pending = useSelector(form.store, (state) => state.isSubmitting);
  const dirty =
    values.role !== binding.role ||
    values.interpretation !== (binding.interpretation ?? "");
  function submit() {
    submitForm(form).catch(() => undefined);
  }
  // Rendered inside the Document edit `<form>`, so it submits through a button instead of a nested `<form>`.
  return (
    <div className="space-y-2">
      <Label htmlFor={`evidence-role-${binding.id}`}>Evidence Role</Label>
      <form.Field name="role">
        {(field) => (
          <NativeSelect
            id={`evidence-role-${binding.id}`}
            name={field.name}
            onChange={(event) => {
              field.handleChange(event.target.value as EvidenceRole);
              command.current = null;
            }}
            value={field.state.value}
          >
            {EVIDENCE_ROLES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <Label htmlFor={`evidence-interpretation-${binding.id}`}>
        Founder interpretation
      </Label>
      <form.Field name="interpretation">
        {(field) => (
          <Textarea
            id={`evidence-interpretation-${binding.id}`}
            maxLength={5000}
            name={field.name}
            onChange={(event) => {
              field.handleChange(event.target.value);
              command.current = null;
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button
        disabled={!dirty || pending}
        onClick={submit}
        type="button"
        variant="outline"
      >
        Save Evidence Role
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      <EvidenceRoleHistory entries={history.data ?? []} />
    </div>
  );
}
