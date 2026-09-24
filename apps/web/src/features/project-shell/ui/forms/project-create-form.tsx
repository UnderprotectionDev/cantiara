// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props and local picker state require closures over current field handlers.
import {
  type CreateProjectMutationInput,
  createProjectInputSchema,
  STARTER_CONFIGURATION_OPTIONS,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, FolderPlus } from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectsQueryPrefix } from "@/utils/orpc";

const INITIAL_VALUES = {
  logo: "",
  name: "",
  problem: "",
  purpose: "",
  scope: "",
  starterConfiguration: "Blank Project" as StarterConfiguration,
  targetDate: "",
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const { data } = error;
    if (typeof data === "object" && data !== null && "label" in data) {
      const { label } = data;
      if (typeof label === "string") {
        return label;
      }
    }
  }
  return "Project could not be created. Try again.";
}

function optionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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

export default function ProjectCreateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLogoReading, setIsLogoReading] = useState(false);
  const pendingCreate = useRef<{
    clientIdempotencyKey: string;
    values: string;
  } | null>(null);

  const createProject = useMutation({
    mutationFn: (input: CreateProjectMutationInput) =>
      runOnlineOnlyWrite(() => client.createProject(input)),
    onError: (error) => {
      setFormError(errorMessage(error));
    },
    onSuccess: async () => {
      pendingCreate.current = null;
      await queryClient.invalidateQueries({ queryKey: projectsQueryPrefix });
      toast.success("Project created.");
      await navigate({ to: "/projects" });
    },
  });

  const form = useForm({
    defaultValues: INITIAL_VALUES,
    onSubmit: async ({ value }) => {
      const parsed = createProjectInputSchema.safeParse({
        logo: optionalValue(value.logo),
        name: value.name,
        problem: optionalValue(value.problem),
        purpose: optionalValue(value.purpose),
        scope: optionalValue(value.scope),
        starterConfiguration: value.starterConfiguration,
        targetDate: optionalValue(value.targetDate),
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }

      setFormError(null);
      const serialized = JSON.stringify(parsed.data);
      const pending = pendingCreate.current;
      const clientIdempotencyKey =
        pending?.values === serialized
          ? pending.clientIdempotencyKey
          : crypto.randomUUID();
      pendingCreate.current = { clientIdempotencyKey, values: serialized };
      await createProject.mutateAsync({
        ...parsed.data,
        baseRevision: 0,
        clientIdempotencyKey,
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>,
    onChange: (value: string) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      onChange("");
      return;
    }
    if (!PROJECT_LOGO_ACCEPTED_TYPES.has(file.type)) {
      event.target.value = "";
      setFormError("Logo must be a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > PROJECT_LOGO_MAX_BYTES) {
      event.target.value = "";
      setFormError("Logo must be 750 KB or smaller.");
      return;
    }

    setFormError(null);
    setIsLogoReading(true);
    readProjectLogo(file)
      .then((logo) => onChange(logo))
      .catch((error) => {
        onChange("");
        setFormError(
          error instanceof Error ? error.message : "Logo could not be read.",
        );
        event.target.value = "";
      })
      .finally(() => setIsLogoReading(false));
  }

  return (
    <form className="space-y-8" noValidate onSubmit={handleSubmit}>
      {formError ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-4"
          role="alert"
        >
          <p className="font-medium text-sm">{formError}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Nothing was changed. Review the fields and try again.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="project-profile-heading" className="space-y-5">
        <div className="border-border/70 border-b pb-4">
          <h2
            className="font-semibold text-lg tracking-tight"
            id="project-profile-heading"
          >
            Project profile
          </h2>
          <p className="mt-1 text-muted-foreground text-xs/relaxed">
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

      <details className="border-border/70 border-t pt-4">
        <summary className="flex min-h-10 cursor-pointer items-center font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
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
                <FieldLabel htmlFor="project-target-date">
                  Target date
                </FieldLabel>
                <TargetDatePicker
                  id="project-target-date"
                  onChange={(value) => field.handleChange(value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="logo">
            {(field) => (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="project-logo">Logo</FieldLabel>
                <Input
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  id="project-logo"
                  name={field.name}
                  onChange={(event) => {
                    handleLogoChange(event, field.handleChange);
                  }}
                  type="file"
                />
                <FieldDescription>
                  Optional. Choose a PNG, JPEG, WebP, or GIF image up to 750 KB.
                  Project color, CSS, and fonts are not part of the profile.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
        </FieldGroup>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3 border-border/70 border-t pt-5">
        <Link
          className={`${buttonVariants({ variant: "ghost" })} min-h-11`}
          to="/projects"
        >
          <ArrowLeft aria-hidden="true" />
          Cancel
        </Link>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              className="min-h-11"
              disabled={
                isLogoReading || isSubmitting || createProject.isPending
              }
              type="submit"
            >
              <FolderPlus aria-hidden="true" />
              {isSubmitting || createProject.isPending
                ? "Creating…"
                : "Create Project"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

function TargetDatePicker({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : undefined;
  const validSelectedDate =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? selectedDate
      : undefined;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label="Target date"
            className="w-full justify-between font-normal"
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        {value || "Select a target date"}
        <CalendarDays aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-72">
        <PopoverDescription>
          Choose the date when you want to review this Project.
        </PopoverDescription>
        <Calendar
          defaultMonth={validSelectedDate}
          mode="single"
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          selected={validSelectedDate}
        />
        {value ? (
          <Button
            className="w-full"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            Clear target date
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
