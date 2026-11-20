import { useForm } from "@tanstack/react-form";
import { parseSearchGitHubRecords } from "../lib/github-forms";

export function useGitHubRecordSearchForm() {
  return useForm({
    defaultValues: { query: "", submitted: null as string | null },
    onSubmit: ({ formApi, value }) => {
      const parsed = parseSearchGitHubRecords({ query: value.query });
      if (parsed.ok) {
        formApi.setFieldValue("submitted", parsed.data.query);
      }
    },
  });
}
