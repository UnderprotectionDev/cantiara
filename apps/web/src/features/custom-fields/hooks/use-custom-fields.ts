import type {
  CreateCustomFieldInput,
  CustomFieldRecordType,
  CustomFieldValueListItem,
  CustomFieldValueRecord,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export interface UpdateCustomFieldArgs {
  baseRevision: number;
  definitionId: string;
  name: string;
  options: string[];
  recordTypes: CustomFieldRecordType[];
}

export interface DefinitionRevisionArgs {
  baseRevision: number;
  definitionId: string;
}

export type CustomFieldDraftValues = Record<
  string,
  ParsedCustomFieldValuePayload | null
>;

export interface SetCustomFieldValueArgs {
  baseRevision: number;
  definitionId: string;
  payload: ParsedCustomFieldValuePayload;
}

export interface ClearCustomFieldValueArgs {
  baseRevision: number;
  definitionId: string;
}

export function useCustomFields(projectId: string) {
  const queryClient = useQueryClient();
  const customFieldsQueryOptions = orpc.customFields.queryOptions({
    input: { projectId },
  });
  const query = useQuery(customFieldsQueryOptions);
  const { queryKey } = customFieldsQueryOptions;
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const create = useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      runOnlineOnlyWrite(() =>
        client.createCustomField({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: UpdateCustomFieldArgs) =>
      runOnlineOnlyWrite(() =>
        client.updateCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const moveToTrash = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.trashCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.restoreCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const deletePermanently = useMutation({
    mutationFn: (input: DefinitionRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.deleteCustomField({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  return {
    create,
    deletePermanently,
    moveToTrash,
    query,
    restore,
    update,
  };
}

export function useCustomFieldValues(
  projectId: string,
  recordType: CustomFieldRecordType,
  recordId?: string,
) {
  const queryClient = useQueryClient();
  const valuesQueryOptions = orpc.customFieldValues.queryOptions({
    input: {
      projectId,
      recordId: recordId ?? "new-record",
      recordType,
    },
  });
  const query = useQuery({
    ...valuesQueryOptions,
    enabled: Boolean(recordId),
  });
  const { queryKey } = valuesQueryOptions;
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const setValue = useMutation({
    mutationFn: (input: SetCustomFieldValueArgs) => {
      if (!recordId) {
        throw new Error("A record is required before saving a Custom field.");
      }
      return runOnlineOnlyWrite(() =>
        client.setCustomFieldValue({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
          recordId,
          recordType,
        }),
      );
    },
    onSuccess: invalidate,
  });

  const clearValue = useMutation({
    mutationFn: (input: ClearCustomFieldValueArgs) => {
      if (!recordId) {
        throw new Error("A record is required before clearing a Custom field.");
      }
      return runOnlineOnlyWrite(() =>
        client.clearCustomFieldValue({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
          recordId,
          recordType,
        }),
      );
    },
    onSuccess: invalidate,
  });

  return { clearValue, query, setValue };
}

function sameCustomFieldValue(
  first: CustomFieldValueRecord | null,
  second: ParsedCustomFieldValuePayload | null,
) {
  return JSON.stringify(first?.value ?? null) === JSON.stringify(second);
}

export async function persistCustomFieldValues({
  projectId,
  recordId,
  recordType,
  values,
}: {
  projectId: string;
  recordId: string;
  recordType: CustomFieldRecordType;
  values: CustomFieldDraftValues;
}) {
  const current = await runOnlineOnlyWrite(() =>
    client.customFieldValues({ projectId, recordId, recordType }),
  );
  const currentByDefinitionId = new Map<string, CustomFieldValueListItem>(
    current.map((item) => [item.definition.id, item]),
  );

  for (const [definitionId, payload] of Object.entries(values)) {
    const existing = currentByDefinitionId.get(definitionId)?.value ?? null;
    if (sameCustomFieldValue(existing, payload)) {
      continue;
    }
    const baseRevision = existing?.revision ?? 0;
    const write = () =>
      Promise.resolve(
        payload === null
          ? client.clearCustomFieldValue({
              baseRevision,
              clientIdempotencyKey: crypto.randomUUID(),
              definitionId,
              recordId,
              recordType,
            })
          : client.setCustomFieldValue({
              baseRevision,
              clientIdempotencyKey: crypto.randomUUID(),
              definitionId,
              payload,
              recordId,
              recordType,
            }),
      );
    // biome-ignore lint/performance/noAwaitInLoops: Each value has its own Mutation Contract target and revision.
    await runOnlineOnlyWrite(write);
  }
}
