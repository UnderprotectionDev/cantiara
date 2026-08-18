# Forward Evaluation Protocol

This is a development-time evaluation protocol, not part of the Deep Prompt Builder runtime
contract. [forward-cases.json](../evals/forward-cases.json) owns the cases and rubric;
[run_forward_evals.py](../scripts/run_forward_evals.py) and
[check_regressions.py](../scripts/check_regressions.py) own the executable adapter, schema and
gate behavior. This document defines how real adapters must provide clean, independent model
evidence.

The forward runner sends every case through two independent generator and evaluator calls.
Any declared hard failure keeps that run and case failing regardless of its numeric scores.
If their rubric outcomes disagree without a hard failure, it runs a third independent pass;
invalid, blocked, or hard-failed runs are not adjudicated away. The command writes
checker-compatible evidence and returns non-zero unless the complete release gate passes.

## Usage

```sh
python3 scripts/run_forward_evals.py evals/forward-cases.json \
  --generator-command "/path/to/generator-adapter" \
  --evaluator-command "/path/to/evaluator-adapter" \
  --output .context/forward-results.json

python3 scripts/check_regressions.py evals/regression-cases.json \
  --forward-cases evals/forward-cases.json \
  --forward-results .context/forward-results.json
```

Commands are parsed without a shell, run from the package directory, receive one JSON object
on stdin, and must return one JSON object on stdout. Each invocation should start a clean
model context. Generator and evaluator identities must differ, as must their identities
between the first two runs.

## Generator Request and Response

The generator sees the invocation, user input, selected skills, required capabilities and
fixture paths. It does not see expected modes, hard requirements or the scoring rubric.

```json
{"generator_id":"model-session-a","activated":true,"output":"```text\n...\n```"}
```

## Evaluator Request and Response

The evaluator receives the complete case, rubric and generated output. It must evaluate the
output independently and cite concrete evidence for every hard requirement.

```json
{
  "evaluator_id": "evaluator-session-a",
  "status": "completed",
  "hard_failures": [],
  "requirement_evidence": {"<exact hard requirement>": "<concrete evidence>"},
  "scores": {"<quality dimension>": 4},
  "evidence": ["<overall evidence>"]
}
```

Do not commit fabricated or placeholder results. A forward case definition passing schema
validation is not a completed release gate; only real adapter output accepted by the checker
is. A blocked evaluator response is retained as failing evidence and keeps the gate open.

Report these gates separately:

- unit and tooling tests;
- regression schema and saved-output checks;
- forward case and rubric schema checks;
- live forward results accepted by the checker.

The first three never imply the fourth. If clean adapters or required capabilities are not
available, report the live gate as not run and keep it open.
