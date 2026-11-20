// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.

import {
  GITHUB_APP_LABEL,
  GITHUB_REPOSITORY_LABEL,
  type GitHubInstallationRecord,
  type GitHubRepository,
} from "@cantiara/api/github-integration";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";
import { errorText } from "../../lib/github-error-text";
import { parseLinkRepository } from "../../lib/github-forms";

export type AvailableRepository = GitHubRepository & { linked: boolean };
export type LoadRepositories = (
  installationId: number,
) => Promise<AvailableRepository[]>;
export type SubmitLinkRepository = (values: {
  installationId: number;
  repositoryId: number;
}) => Promise<unknown>;

/**
 * Link a Repository chosen by GitHub's stable numeric id. The visible label is
 * the owner and name, the option value is the id, so a rename cannot make the
 * same Repository look new.
 */
export function LinkRepositoryForm({
  installations,
  loadRepositories,
  onLink,
  projectId,
}: {
  installations: GitHubInstallationRecord[];
  loadRepositories: LoadRepositories;
  onLink: SubmitLinkRepository;
  projectId: string;
}) {
  const active = installations.filter(({ removedAt }) => removedAt === null);
  const form = useForm({
    defaultValues: {
      installationId: String(active[0]?.installationId ?? ""),
      repositoryId: "",
    },
    onSubmit: async ({ formApi, value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = parseLinkRepository(value);
      if (!parsed.ok) {
        form.setErrorMap({ onSubmit: { form: parsed.message, fields: {} } });
        return;
      }
      try {
        await onLink(parsed.data);
        formApi.setFieldValue("repositoryId", "");
      } catch (caught) {
        form.setErrorMap({
          onSubmit: {
            form: errorText(
              caught,
              `${GITHUB_REPOSITORY_LABEL} was not linked.`,
            ),
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
  const succeeded = useSelector(
    form.store,
    (state) => state.isSubmitSuccessful,
  );
  const saved =
    succeeded && !error ? `${GITHUB_REPOSITORY_LABEL} linked.` : undefined;
  const values = useSelector(form.store, (state) => state.values);
  const pending = useSelector(form.store, (state) => state.isSubmitting);
  const installationId = Number(values.installationId);
  const repositories = useQuery({
    enabled: installationId > 0,
    gcTime: 0,
    queryFn: () => loadRepositories(installationId),
    queryKey: orpc.gitHubAppRepositories.queryKey({
      input: { installationId, projectId },
    }),
  });
  const choices = (repositories.data ?? []).filter(({ linked }) => !linked);

  if (active.length === 0) {
    return null;
  }

  return (
    <form
      aria-label={`Link ${GITHUB_REPOSITORY_LABEL}`}
      className="space-y-3 rounded-lg border border-border/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form).catch(() => undefined);
      }}
    >
      <h3 className="font-medium">{`Link ${GITHUB_REPOSITORY_LABEL}`}</h3>
      {active.length > 1 ? (
        <div className="grid gap-2 text-sm">
          <label htmlFor="github-installation">{`${GITHUB_APP_LABEL} installation`}</label>
          <form.Field name="installationId">
            {(field) => (
              <NativeSelect
                className="w-full"
                disabled={pending}
                id="github-installation"
                name={field.name}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  form.setFieldValue("repositoryId", "");
                }}
                value={field.state.value}
              >
                {active.map((installation) => (
                  <NativeSelectOption
                    key={installation.id}
                    value={String(installation.installationId)}
                  >
                    {installation.accountLogin}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </div>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-repository">{GITHUB_REPOSITORY_LABEL}</label>
        <form.Field name="repositoryId">
          {(field) => (
            <NativeSelect
              className="w-full"
              disabled={pending || repositories.isPending}
              id="github-repository"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">{`Choose a ${GITHUB_REPOSITORY_LABEL}`}</NativeSelectOption>
              {choices.map((repository) => (
                <NativeSelectOption
                  key={repository.repositoryId}
                  value={String(repository.repositoryId)}
                >
                  {repository.fullName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        {repositories.isError ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-destructive" role="alert">
              The Repository list is unavailable.
            </p>
            <Button
              className="h-8 px-2 text-xs"
              onClick={() => {
                repositories.refetch().catch(() => undefined);
              }}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : null}
        {repositories.data && choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every Repository this installation exposes is already linked. Change
            the selection on GitHub to add more.
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm" role="status">
          {saved}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {`Link ${GITHUB_REPOSITORY_LABEL}`}
      </Button>
    </form>
  );
}
