import type {
  ImportPreview,
  ImportScope,
  PreviewImportInput,
} from "@cantiara/api/data-import";
import { useForm, useSelector } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { orpc } from "@/utils/orpc";

interface PreviewSelection {
  file: number;
  revision: number;
}

/** Observes the exact current preview without putting the raw file in the cache. */
export function usePreviewImport(
  load: (
    input: PreviewImportInput,
    signal: AbortSignal,
  ) => Promise<ImportPreview>,
) {
  const queryClient = useQueryClient();
  const instance = useId();
  const sequence = useRef(0);
  const request = useRef<{
    input: PreviewImportInput;
    selection: PreviewSelection;
  } | null>(null);
  const [selection, setSelection] = useState<PreviewSelection | null>(null);
  const form = useForm({ defaultValues: { excludedRows: [] as number[] } });
  const excludedRows = useSelector(
    form.store,
    (state) => state.values.excludedRows,
  );

  const options = (selected: PreviewSelection | null) => ({
    gcTime: 0,
    networkMode: "always" as const,
    queryKey: [
      ...orpc.previewImport.key(),
      instance,
      selected?.file,
      selected?.revision,
    ],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { current } = request;
      if (!current || current.selection.revision !== selected?.revision) {
        throw new Error("The preview selection changed.");
      }
      return {
        preview: await load(current.input, signal),
        scope: current.input.scope,
      };
    },
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const preview = useQuery<{ preview: ImportPreview; scope: ImportScope }>({
    ...options(selection),
    enabled: selection !== null,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.at(-2) === selection?.file ? previous : undefined,
  });

  function select(input: PreviewImportInput, file?: number) {
    sequence.current += 1;
    const revision = sequence.current;
    const next = { file: file ?? revision, revision };
    request.current = { input, selection: next };
    setSelection(next);
    return next;
  }

  function choose(input: PreviewImportInput) {
    form.setFieldValue("excludedRows", [...(input.excludedRows ?? [])]);
    return fetchFresh(queryClient, options(select(input))).catch(
      () => undefined,
    );
  }

  function toggleRow(rowNumber: number) {
    if (!request.current) {
      return;
    }
    const index = form.getFieldValue("excludedRows").indexOf(rowNumber);
    if (index < 0) {
      form.pushFieldValue("excludedRows", rowNumber);
    } else {
      form.removeFieldValue("excludedRows", index).catch(() => undefined);
    }
    const { input, selection: current } = request.current;
    select(
      {
        ...input,
        excludedRows: [...form.getFieldValue("excludedRows")].sort(
          (a, b) => a - b,
        ),
      },
      current.file,
    );
  }

  function clear(cancelledRevision: number) {
    if (request.current?.selection.revision === cancelledRevision) {
      request.current = null;
      setSelection(null);
    }
  }

  return { choose, clear, excludedRows, preview, selection, toggleRow };
}
