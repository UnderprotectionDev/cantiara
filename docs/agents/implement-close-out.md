# Implement close-out

Final user message after `/implement` — Turkish, three sections in order.

## When

Run after work is committed, `/code-review` has finished, and tests have run.

## 1. Ne eklendi

Plain-language summary of what landed:

- User-visible behaviour or capability delivered
- Main files, routes, APIs, or schema touched — enough to orient, not a raw diff dump
- Scope boundaries: what this change deliberately does not cover

**Done when** the reader can answer “what did this deliver?” without opening the diff.

## 2. İnceleme

Carry forward `/code-review` under `## Standards` and `## Spec` — lightly cleaned, not reranked. End with the one-line summary from that skill (findings per axis, worst issue within each axis).

If no spec was available, say so under Spec. If review was skipped, say why — do not invent findings.

**Done when** both axes are reported or explicitly skipped with reason.

## 3. Nasıl test edilir

Concrete verification the reader can run alone:

- Commands already executed (typecheck, targeted tests, full suite) and their outcome
- Exact commands to re-run locally
- Manual path when UI or integration behaviour changed — URL, clicks, expected result
- Prerequisites only when non-obvious (env vars, migrations, seed data)

**Done when** the reader can verify the change without asking the agent.

## Voice

- Turkish prose throughout.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
