// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import type { GitHubExternalRecord } from "@cantiara/api/github-integration";
import {
  GITHUB_LINK_WORK_LABEL,
  GITHUB_ROLE_CONTEXTUAL_LABEL,
  GITHUB_ROLE_REQUIRED_LABEL,
  type GitHubWorkLinksOverview,
} from "@cantiara/api/github-work-links";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { errorText } from "../../lib/github-error-text";

export type LinkWorkValues =
  | { recordId: string; role: string; target: "record"; workId: string }
  | {
      linkId: string;
      reference: string;
      role: string;
      target: "Branch" | "Commit";
      workId: string;
    };

export type SubmitLinkWork = (values: LinkWorkValues) => Promise<unknown>;

export interface RepositoryChoice {
  id: string;
  label: string;
}

/**
 * Link one Work to one GitHub record, commit or branch by explicit pick. The
 * founder chooses the role; `Required for completion` is offered for a Pull
 * request only. Linking changes no Work status and writes nothing to GitHub.
 */
export function LinkWorkForm({
  onLink,
  records,
  repositories,
  works,
}: {
  onLink: SubmitLinkWork;
  records: GitHubExternalRecord[];
  repositories: RepositoryChoice[];
  works: GitHubWorkLinksOverview["works"];
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const form = useForm({
    defaultValues: {
      linkId: repositories[0]?.id ?? "",
      recordId: "",
      reference: "",
      role: GITHUB_ROLE_CONTEXTUAL_LABEL as string,
      target: "record" as "Branch" | "Commit" | "record",
      workId: "",
    },
    onSubmit: async ({ formApi, value }) => {
      setError(undefined);
      setSaved(undefined);
      if (!value.workId) {
        setError("Choose a Work.");
        return;
      }
      try {
        if (value.target === "record") {
          if (!value.recordId) {
            setError("Choose a GitHub record.");
            return;
          }
          await onLink({
            recordId: value.recordId,
            role: value.role,
            target: "record",
            workId: value.workId,
          });
        } else {
          if (!(value.linkId && value.reference.trim())) {
            setError(`Enter the ${value.target.toLowerCase()}.`);
            return;
          }
          await onLink({
            linkId: value.linkId,
            reference: value.reference.trim(),
            role: GITHUB_ROLE_CONTEXTUAL_LABEL,
            target: value.target,
            workId: value.workId,
          });
        }
        setSaved("Linked. The Work and the GitHub record are unchanged.");
        formApi.setFieldValue("recordId", "");
        formApi.setFieldValue("reference", "");
      } catch (caught) {
        setError(errorText(caught, "The link was not made."));
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const selected = records.find((record) => record.id === values.recordId);
  const requiredAllowed =
    values.target === "record" && selected?.kind === "Pull request";
  return (
    <form
      aria-label={GITHUB_LINK_WORK_LABEL}
      className="space-y-3 rounded-lg border border-border/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h4 className="font-medium">{GITHUB_LINK_WORK_LABEL}</h4>
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-link-target">GitHub item</label>
        <form.Field name="target">
          {(field) => (
            <NativeSelect
              className="w-full"
              id="github-link-target"
              name={field.name}
              onChange={(event) =>
                field.handleChange(
                  event.target.value as "Branch" | "Commit" | "record",
                )
              }
              value={field.state.value}
            >
              <NativeSelectOption value="record">
                Issue or Pull request
              </NativeSelectOption>
              <NativeSelectOption value="Commit">Commit</NativeSelectOption>
              <NativeSelectOption value="Branch">Branch</NativeSelectOption>
            </NativeSelect>
          )}
        </form.Field>
      </div>
      {values.target === "record" ? (
        <div className="grid gap-2 text-sm">
          <label htmlFor="github-link-record">GitHub record</label>
          <form.Field name="recordId">
            {(field) => (
              <NativeSelect
                className="w-full"
                id="github-link-record"
                name={field.name}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  const next = records.find(
                    (record) => record.id === event.target.value,
                  );
                  if (next?.kind !== "Pull request") {
                    form.setFieldValue("role", GITHUB_ROLE_CONTEXTUAL_LABEL);
                  }
                }}
                value={field.state.value}
              >
                <NativeSelectOption value="">
                  Choose a GitHub record
                </NativeSelectOption>
                {records.map((record) => (
                  <NativeSelectOption key={record.id} value={record.id}>
                    {`${record.kind} #${record.number} ${record.title}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </div>
      ) : (
        <>
          <div className="grid gap-2 text-sm">
            <label htmlFor="github-link-repository">Repository</label>
            <form.Field name="linkId">
              {(field) => (
                <NativeSelect
                  className="w-full"
                  id="github-link-repository"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  {repositories.map((repository) => (
                    <NativeSelectOption
                      key={repository.id}
                      value={repository.id}
                    >
                      {repository.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor="github-link-reference">
              {values.target === "Commit" ? "Commit SHA" : "Branch name"}
            </label>
            <form.Field name="reference">
              {(field) => (
                <Input
                  id="github-link-reference"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </div>
        </>
      )}
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-link-work">Work</label>
        <form.Field name="workId">
          {(field) => (
            <NativeSelect
              className="w-full"
              id="github-link-work"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Choose a Work</NativeSelectOption>
              {works.map((work) => (
                <NativeSelectOption key={work.id} value={work.id}>
                  {`${work.key} ${work.title}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-link-role">Role</label>
        <form.Field name="role">
          {(field) => (
            <NativeSelect
              className="w-full"
              id="github-link-role"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption
                disabled={!requiredAllowed}
                value={GITHUB_ROLE_REQUIRED_LABEL}
              >
                {GITHUB_ROLE_REQUIRED_LABEL}
              </NativeSelectOption>
              <NativeSelectOption value={GITHUB_ROLE_CONTEXTUAL_LABEL}>
                {GITHUB_ROLE_CONTEXTUAL_LABEL}
              </NativeSelectOption>
            </NativeSelect>
          )}
        </form.Field>
        <p className="text-muted-foreground">
          {`${GITHUB_ROLE_REQUIRED_LABEL} applies to a Pull request only. It is data for the ready rule; linking never changes the Work.`}
        </p>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm" role="status">
          {saved}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {GITHUB_LINK_WORK_LABEL}
      </Button>
    </form>
  );
}
