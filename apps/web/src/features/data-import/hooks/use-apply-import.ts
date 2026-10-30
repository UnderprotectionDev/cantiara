import type { ApplyImportInput } from "@cantiara/api/data-import";
import { client } from "@/utils/orpc";

/** `Apply Import` and the pre-barrier cancel of the staged file. */
export function useApplyImport() {
  return {
    apply: (input: ApplyImportInput) => client.applyImport(input),
    cancel: (stagingId: string) => client.cancelImport({ stagingId }),
  };
}
