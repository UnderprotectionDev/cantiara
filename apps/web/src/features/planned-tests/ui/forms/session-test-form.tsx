// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Session Test and form fields.
import {
  type PlannedTestCaseRecord,
  type PlannedTestCaseVersionRef,
  SESSION_TEST_LABEL,
  type SessionTestRecord,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { errorText } from "../../lib/error-text";

interface RecordSessionTestValues {
  binding: PlannedTestCaseVersionRef | null;
  expectedBehavior: string;
  purpose: string;
  title: string;
}

export type SubmitSessionTest = (
  values: RecordSessionTestValues,
) => Promise<unknown>;
export type LinkSessionTest = (
  sessionTestId: string,
  ref: PlannedTestCaseVersionRef,
) => Promise<unknown>;

const AD_HOC = "";

function optionValue(ref: PlannedTestCaseVersionRef) {
  return `${ref.caseId}@${ref.version}`;
}

function parseOption(value: string): PlannedTestCaseVersionRef | null {
  const at = value.lastIndexOf("@");
  return at < 0
    ? null
    : { caseId: value.slice(0, at), version: Number(value.slice(at + 1)) };
}

/** Every exact version is its own option: there is no "latest" choice. */
function VersionOptions({ cases }: { cases: PlannedTestCaseRecord[] }) {
  return cases.map((record) => (
    <NativeSelectOptGroup key={record.id} label={record.current.title}>
      {[...record.versions].reverse().map((version) => (
        <NativeSelectOption
          key={version.id}
          value={optionValue({ caseId: record.id, version: version.version })}
        >
          {`${version.title}, version ${version.version}`}
        </NativeSelectOption>
      ))}
    </NativeSelectOptGroup>
  ));
}

export function RecordForm({
  cases,
  onRecord,
}: {
  cases: PlannedTestCaseRecord[];
  onRecord: SubmitSessionTest;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      bound: AD_HOC,
      expectedBehavior: "",
      purpose: "",
      title: "",
    },
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await onRecord({
          binding: value.bound === AD_HOC ? null : parseOption(value.bound),
          expectedBehavior: value.expectedBehavior,
          purpose: value.purpose,
          title: value.title,
        });
        formApi.reset();
      } catch (caught) {
        setError(errorText(caught, `${SESSION_TEST_LABEL} was not saved.`));
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={`Record ${SESSION_TEST_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Record ${SESSION_TEST_LABEL}`}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe
        selector={(state) => ({
          adHoc: state.values.bound === AD_HOC,
          pending: state.isSubmitting,
        })}
      >
        {({ adHoc, pending }) => (
          <>
            <form.Field name="title">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="session-test-new-title">Title</label>
                  <Input
                    disabled={pending}
                    id="session-test-new-title"
                    maxLength={255}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="bound">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="session-test-new-bound">
                    Planned Test Case version
                  </label>
                  <NativeSelect
                    className="w-full"
                    disabled={pending}
                    id="session-test-new-bound"
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value={AD_HOC}>
                      None (ad hoc)
                    </NativeSelectOption>
                    <VersionOptions cases={cases} />
                  </NativeSelect>
                </div>
              )}
            </form.Field>
            {adHoc ? (
              <>
                <form.Field name="purpose">
                  {(field) => (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor="session-test-new-purpose">Purpose</label>
                      <Textarea
                        disabled={pending}
                        id="session-test-new-purpose"
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        rows={3}
                        value={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="expectedBehavior">
                  {(field) => (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor="session-test-new-expected">
                        Expected behavior
                      </label>
                      <Textarea
                        disabled={pending}
                        id="session-test-new-expected"
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        rows={3}
                        value={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
              </>
            ) : null}
            <Button disabled={pending} type="submit">
              {`Record ${SESSION_TEST_LABEL}`}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export function LinkScenarioVersionForm({
  cases,
  onLink,
  sessionTest,
}: {
  cases: PlannedTestCaseRecord[];
  onLink: LinkSessionTest;
  sessionTest: SessionTestRecord;
}) {
  const [error, setError] = useState<string>();
  const selectId = `session-test-${sessionTest.id}-link`;
  const form = useForm({
    defaultValues: { choice: AD_HOC },
    onSubmit: async ({ value }) => {
      const ref = parseOption(value.choice);
      if (!ref) {
        return;
      }
      setError(undefined);
      try {
        await onLink(sessionTest.id, ref);
      } catch (caught) {
        setError(errorText(caught, `${SESSION_TEST_LABEL} was not linked.`));
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  if (cases.length === 0) {
    return null;
  }
  return (
    <form
      aria-label={`Link ${sessionTest.title} to a Planned Test Case`}
      className="space-y-2"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <label className="text-sm" htmlFor={selectId}>
        Link to Planned Test Case version
      </label>
      <p className="text-muted-foreground text-xs">
        Linking keeps what was recorded and does not mark the version as
        executed. A link does not move later.
      </p>
      <form.Subscribe
        selector={(state) => ({
          choice: state.values.choice,
          pending: state.isSubmitting,
        })}
      >
        {({ choice, pending }) => (
          <div className="flex flex-wrap gap-2">
            <form.Field name="choice">
              {(field) => (
                <NativeSelect
                  disabled={pending}
                  id={selectId}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value={AD_HOC}>
                    Choose a version
                  </NativeSelectOption>
                  <VersionOptions cases={cases} />
                </NativeSelect>
              )}
            </form.Field>
            <Button
              disabled={pending || choice === AD_HOC}
              size="sm"
              type="submit"
              variant="outline"
            >
              Link
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
