// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";

export const SEARCH_GITHUB_RECORDS_LABEL = "Search GitHub records";

export function SearchGitHubRecordsForm({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) {
  const form = useForm({
    defaultValues: { query: "" },
    onSubmit: ({ value }) => {
      onSearch(value.query.trim());
    },
  });
  return (
    <form
      aria-label={SEARCH_GITHUB_RECORDS_LABEL}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-record-search">
          {SEARCH_GITHUB_RECORDS_LABEL}
        </label>
        <form.Field name="query">
          {(field) => (
            <Input
              id="github-record-search"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Title, #number, label or milestone"
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
}
