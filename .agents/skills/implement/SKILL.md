---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Before your final message, read [`docs/agents/implement-close-out.md`](../../docs/agents/implement-close-out.md) and follow its three-section format — Turkish, in order: Ne eklendi, İnceleme, Nasıl test edilir.
