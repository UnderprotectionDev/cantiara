// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import { TEST_GAP_LABEL, type TestGapRecord } from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";
import {
  EMPTY_GAP_FORM,
  errorText,
  type GapFormValues,
  relationLabel,
} from "../lib/test-gap-form";
import {
  type LoadGapRelationTargets,
  TestGapRelationsField,
} from "./test-gap-relations-field";

export type SubmitGap = (values: GapFormValues) => Promise<unknown>;

/**
 * Filing form. The founder writes the title, the rationale and the support
 * relations; there is no coverage, score, status or result field to fill in.
 */
function GapForm({
  loadTargets,
  onSubmit,
}: {
  loadTargets: LoadGapRelationTargets;
  onSubmit: SubmitGap;
}) {
  const [values, setValues] = useState<GapFormValues>(EMPTY_GAP_FORM);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onSubmit(values);
      setValues(EMPTY_GAP_FORM);
    } catch (caught) {
      setError(errorText(caught, `${TEST_GAP_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label={`File ${TEST_GAP_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`File ${TEST_GAP_LABEL}`}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-gap-new-title">Title</label>
        <Input
          disabled={pending}
          id="test-gap-new-title"
          maxLength={255}
          onChange={(event) =>
            setValues({ ...values, title: event.target.value })
          }
          required
          value={values.title}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-gap-new-rationale">Rationale</label>
        <Textarea
          disabled={pending}
          id="test-gap-new-rationale"
          onChange={(event) =>
            setValues({ ...values, rationale: event.target.value })
          }
          required
          rows={3}
          value={values.rationale}
        />
      </div>
      <TestGapRelationsField
        idPrefix="test-gap-new"
        loadTargets={loadTargets}
        onChange={(relations) => setValues({ ...values, relations })}
        value={values.relations}
      />
      <Button disabled={pending} type="submit">
        {`File ${TEST_GAP_LABEL}`}
      </Button>
    </form>
  );
}

function GapItem({ record }: { record: TestGapRecord }) {
  return (
    <li className="space-y-2 rounded-lg border border-border/70 p-4">
      <h4 className="font-medium">{record.title}</h4>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Rationale</dt>
          <dd className="whitespace-pre-wrap">{record.rationale}</dd>
        </div>
        <div>
          <dt className="font-medium">Support relations</dt>
          <dd>
            {record.relations.length === 0 ? (
              "No support relations."
            ) : (
              <ul>
                {record.relations.map((relation) => (
                  <li key={relation.id}>{relationLabel(relation)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </li>
  );
}

/**
 * The Tests area's Test Gap list. A management view of records the founder
 * filed: not a phase, a runner or a coverage figure, and nothing here files a
 * Gap on its own.
 */
export function TestGapsView({
  gaps,
  loadTargets,
  onCreate,
  readOnly,
}: {
  gaps: TestGapRecord[];
  loadTargets: LoadGapRelationTargets;
  onCreate: SubmitGap;
  readOnly: boolean;
}) {
  return (
    <section aria-labelledby="test-gaps-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="test-gaps-heading">
        Test Gaps
      </h2>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived. Test Gaps are read-only.
        </p>
      ) : (
        <GapForm loadTargets={loadTargets} onSubmit={onCreate} />
      )}
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Test Gaps filed.</p>
      ) : (
        <ul aria-label="Test Gaps" className="space-y-3">
          {gaps.map((record) => (
            <GapItem key={record.id} record={record} />
          ))}
        </ul>
      )}
    </section>
  );
}
