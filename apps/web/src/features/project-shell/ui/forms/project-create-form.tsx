// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props and local picker state require closures over current field handlers.

import {
  STARTER_CONFIGURATION_OPTIONS,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FolderPlus } from "lucide-react";
import type { SubmitEvent } from "react";
import { DatePicker } from "@/components/date-picker";
import { submitForm } from "@/lib/submit-form";
import { useProjectCreateForm } from "../../hooks/use-project-create-form";

const PROJECT_LOGO_ACCEPTED_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PROJECT_LOGO_MAX_BYTES = 750_000;

function readProjectLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () =>
      reject(new Error("Logo could not be read.")),
    );
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Logo could not be read."));
        return;
      }
      resolve(reader.result);
    });
    reader.readAsDataURL(file);
  });
}

function ProjectProfileDetails({
  form,
}: {
  form: ReturnType<typeof useProjectCreateForm>["form"];
}) {
  return (
    <details className="border-t border-border/70 pt-4">
      <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        Optional profile details
      </summary>
      <FieldGroup className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2">
        <form.Field name="purpose">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="project-purpose">Purpose</FieldLabel>
              <Textarea
                id="project-purpose"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What are you building?"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="problem">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="project-problem">Problem</FieldLabel>
              <Textarea
                id="project-problem"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What problem does it solve?"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="scope">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="project-scope">Scope</FieldLabel>
              <Textarea
                id="project-scope"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What belongs in this Project?"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="targetDate">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="project-target-date">Target date</FieldLabel>
              <DatePicker
                ariaLabel="Target date"
                clearLabel="Clear target date"
                id="project-target-date"
                onChange={(value) => field.handleChange(value)}
                placeholder="Select a target date"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="logoFile"
          validators={{
            onChangeAsync: async ({ value: file, signal }) => {
              if (!file) {
                return;
              }
              if (!PROJECT_LOGO_ACCEPTED_TYPES.has(file.type)) {
                return "Logo must be a PNG, JPEG, WebP, or GIF image.";
              }
              if (file.size > PROJECT_LOGO_MAX_BYTES) {
                return "Logo must be 750 KB or smaller.";
              }
              try {
                const logo = await readProjectLogo(file);
                if (!signal.aborted) {
                  form.setFieldValue("logo", logo);
                }
              } catch (error) {
                return error instanceof Error
                  ? error.message
                  : "Logo could not be read.";
              }
            },
          }}
        >
          {(field) => (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="project-logo">Logo</FieldLabel>
              <Input
                accept="image/png,image/jpeg,image/webp,image/gif"
                id="project-logo"
                name={field.name}
                onChange={(event) => {
                  form.setFieldValue("logo", "");
                  field.handleChange(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
              <FieldDescription>
                Optional. Choose a PNG, JPEG, WebP, or GIF image up to 750 KB.
                Project color, CSS, and fonts are not part of the profile.
              </FieldDescription>
              {field.state.meta.errors.map((error) => (
                <p key={error} role="alert">
                  {error}
                </p>
              ))}
            </Field>
          )}
        </form.Field>
      </FieldGroup>
    </details>
  );
}

export default function ProjectCreateForm() {
  const { form, formError, isPending } = useProjectCreateForm();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  return (
    <ProjectCreateFields
      form={form}
      formError={formError}
      isPending={isPending}
      onSubmit={handleSubmit}
    />
  );
}

function ProjectCreateFields({
  form,
  formError,
  isPending,
  onSubmit,
}: ReturnType<typeof useProjectCreateForm> & {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-8" noValidate onSubmit={onSubmit}>
      {formError ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-4"
          role="alert"
        >
          <p className="text-sm font-medium">{formError}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing was changed. Review the fields and try again.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="project-profile-heading" className="space-y-5">
        <div className="border-b border-border/70 pb-4">
          <h2
            className="text-lg font-semibold tracking-tight"
            id="project-profile-heading"
          >
            Project profile
          </h2>
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            Start with a name and configuration. A Short code is suggested from
            the Project Name and can be changed from Projects until the first
            Work.
          </p>
        </div>
        <FieldGroup className="grid max-w-2xl gap-y-5">
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="project-name">Project Name</FieldLabel>
                <Input
                  autoComplete="off"
                  autoFocus
                  id="project-name"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Payment App"
                  value={field.state.value}
                />
                <FieldDescription>
                  This is the name shown across your Project surfaces.
                </FieldDescription>
              </Field>
            )}
          </form.Field>

          <form.Field name="starterConfiguration">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="starter-configuration">
                  Starter Configuration
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="starter-configuration"
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as StarterConfiguration,
                    )
                  }
                  value={field.state.value}
                >
                  {STARTER_CONFIGURATION_OPTIONS.map((configuration) => (
                    <NativeSelectOption
                      key={configuration}
                      value={configuration}
                    >
                      {configuration}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  A one-time starting structure. It does not create sample
                  content.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
        </FieldGroup>
      </section>

      <ProjectProfileDetails form={form} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
        <Link
          className={`${buttonVariants({ variant: "ghost" })} min-h-11`}
          to="/projects"
        >
          <ArrowLeft aria-hidden="true" />
          Cancel
        </Link>
        <form.Subscribe
          selector={(state) => ({
            isSubmitting: state.isSubmitting,
            isValidating: state.isValidating,
          })}
        >
          {({ isSubmitting, isValidating }) => (
            <Button
              className="min-h-11"
              disabled={isValidating || isSubmitting || isPending}
              type="submit"
            >
              <FolderPlus aria-hidden="true" />
              {isSubmitting || isPending ? "Creating…" : "Create Project"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
