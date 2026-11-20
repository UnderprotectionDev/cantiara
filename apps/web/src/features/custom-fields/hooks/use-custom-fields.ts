import type {
  CreateCustomFieldInput,
  CustomFieldRecordType,
  CustomFieldValueListItem,
  CustomFieldValueRecord,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
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

  const create = usePreparedMutation(
    orpc.createCustomField.mutationOptions({
      mutationFn: (input) => client.createCustomField(input),
      onSuccess: invalidate,
    }),
    (input: CreateCustomFieldInput) => ({
      ...input,
      baseRevision: 0,
    }),
  );

  const update = usePreparedMutation(
    orpc.updateCustomField.mutationOptions({
      mutationFn: (input) => client.updateCustomField(input),
      onSuccess: invalidate,
    }),
    (input: UpdateCustomFieldArgs) => ({
      ...input,
    }),
  );

  const moveToTrash = usePreparedMutation(
    orpc.trashCustomField.mutationOptions({
      mutationFn: (input) => client.trashCustomField(input),
      onSuccess: invalidate,
    }),
    (input: DefinitionRevisionArgs) => ({
      ...input,
    }),
  );

  const restore = usePreparedMutation(
    orpc.restoreCustomField.mutationOptions({
      mutationFn: (input) => client.restoreCustomField(input),
      onSuccess: invalidate,
    }),
    (input: DefinitionRevisionArgs) => ({
      ...input,
    }),
  );

  const deletePermanently = usePreparedMutation(
    orpc.deleteCustomField.mutationOptions({
      mutationFn: (input) => client.deleteCustomField(input),
      onSuccess: invalidate,
    }),
    (input: DefinitionRevisionArgs) => ({
      ...input,
    }),
  );

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
  options: { enabled?: boolean } = {},
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
    enabled: Boolean(recordId) && (options.enabled ?? true),
  });
  const { queryKey } = valuesQueryOptions;
  // Row surfaces may render prefetched Project values instead of this query;
  // invalidating both keeps either source fresh after a value write.
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.customFieldProjectValues.queryOptions({
          input: { projectId, recordType },
        }).queryKey,
      }),
    ]);
  };

  const setValue = usePreparedMutation(
    orpc.setCustomFieldValue.mutationOptions({
      mutationFn: (input) => {
        if (!input.recordId) {
          throw new Error("A record is required before saving a Custom field.");
        }
        return client.setCustomFieldValue(input);
      },
      onSuccess: invalidate,
    }),
    (input: SetCustomFieldValueArgs) => ({
      ...input,
      recordId: recordId ?? "",
      recordType,
    }),
  );

  const clearValue = usePreparedMutation(
    orpc.clearCustomFieldValue.mutationOptions({
      mutationFn: (input) => {
        if (!input.recordId) {
          throw new Error(
            "A record is required before clearing a Custom field.",
          );
        }
        return client.clearCustomFieldValue(input);
      },
      onSuccess: invalidate,
    }),
    (input: ClearCustomFieldValueArgs) => ({
      ...input,
      recordId: recordId ?? "",
      recordType,
    }),
  );

  return { clearValue, query, setValue };
}

export function useCustomFieldProjectValues(
  projectId: string,
  recordType: CustomFieldRecordType,
) {
  const query = useQuery(
    orpc.customFieldProjectValues.queryOptions({
      input: { projectId, recordType },
    }),
  );
  return { query };
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
