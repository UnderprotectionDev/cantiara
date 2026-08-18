#!/usr/bin/env python3
"""Grade real project-tree-writer outputs against directory fixtures."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

from check_structure_fixtures import (
    FixtureCase,
    load_fixture_cases,
    read_json_object,
    validate_cases,
    validate_fixture,
)


def load_results(path: Path) -> list[dict[str, Any]]:
    try:
        data = read_json_object(path)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    if data.get("version") != 1:
        raise SystemExit(f"{path}: expected version 1")
    results = data.get("results")
    if not isinstance(results, list):
        raise SystemExit(f"{path}: results must be an array")
    return results


def _source_map(case: FixtureCase) -> dict[str, str]:
    source_root = case.directory / case.metadata.source_dir
    sources: dict[str, str] = {}
    for path in sorted(source_root.rglob("*")):
        if path.is_file():
            relative = path.relative_to(source_root).as_posix()
            sources[relative] = path.read_text(encoding="utf-8")
    return sources


def _runner_payload(case: FixtureCase) -> dict[str, Any]:
    return {
        "id": case.id,
        "invocation": case.metadata.invocation,
        "user_input": case.metadata.user_input,
        "target_root": case.metadata.target_root,
        "sources": _source_map(case),
    }


def capture_results(cases: list[FixtureCase], runner: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for case in cases:
        completed = subprocess.run(
            [str(runner)],
            input=json.dumps(_runner_payload(case), ensure_ascii=False),
            check=False,
            capture_output=True,
            text=True,
        )
        if completed.returncode:
            raise SystemExit(
                f"runner failed for {case.id} with exit {completed.returncode}: "
                f"{completed.stderr.strip()}"
            )
        try:
            result = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"runner returned invalid JSON for {case.id}: {exc}") from exc
        if not isinstance(result, dict):
            raise SystemExit(f"runner result for {case.id} must be an object")
        result["id"] = case.id
        results.append(result)
    return results


def grade_case(case: FixtureCase, result: dict[str, Any]) -> list[str]:
    activated = result.get("activated")
    if not isinstance(activated, bool):
        return ["result needs boolean activated"]
    expected_activation = case.metadata.expected_activation
    if activated != expected_activation:
        return [f"activation was {activated}, expected {expected_activation}"]
    if not activated:
        errors: list[str] = []
        if result.get("output_path") is not None:
            errors.append("inactive results must not write an output_path")
        if result.get("output") not in {None, ""}:
            errors.append("inactive results must not return output")
        return errors
    expected_write_path = None
    if case.metadata.expected_mode == "structure":
        expected_write_path = (
            PurePosixPath(case.metadata.target_root) / "structure.md"
        ).as_posix()
    actual_write_path = result.get("output_path")
    if expected_write_path is not None:
        if actual_write_path != expected_write_path:
            return [
                f"output_path was {actual_write_path!r}, expected "
                f"{expected_write_path!r} relative to target_root"
            ]
    elif actual_write_path is not None:
        return ["question results must not write an output_path"]
    output = result.get("output")
    if not isinstance(output, str):
        return ["activated result needs string output"]
    actual_case = FixtureCase(
        directory=case.directory,
        metadata=case.metadata,
        output=output,
    )
    return validate_fixture(actual_case)


def _print_failures(failures: list[tuple[str, list[str]]]) -> None:
    for case_id, errors in failures:
        print(f"FAIL {case_id}", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture_root", type=Path)
    parser.add_argument("results_file", nargs="?", type=Path)
    parser.add_argument("--runner", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.validate_only and (args.results_file is not None or args.runner is not None):
        parser.error("--validate-only cannot be combined with results_file or --runner")
    if not args.validate_only and (args.results_file is None) == (args.runner is None):
        parser.error("provide exactly one of results_file or --runner")

    cases, load_failures = load_fixture_cases(args.fixture_root)
    fixture_failures = [*load_failures, *validate_cases(cases)]
    if fixture_failures:
        _print_failures(fixture_failures)
        return 1
    if args.validate_only:
        print(f"VALID {len(cases)} behavior case(s)")
        return 0

    results = (
        load_results(args.results_file)
        if args.results_file is not None
        else capture_results(cases, args.runner)
    )
    by_id: dict[str, dict[str, Any]] = {}
    failures: list[tuple[str, list[str]]] = []
    for result in results:
        if not isinstance(result, dict) or not isinstance(result.get("id"), str):
            failures.append(("<result>", ["each result needs a string id"]))
            continue
        result_id = result["id"]
        if result_id in by_id:
            failures.append((result_id, ["duplicate result id"]))
            continue
        by_id[result_id] = result

    case_ids = {case.id for case in cases}
    for case in cases:
        result = by_id.get(case.id)
        if result is None:
            failures.append((case.id, ["missing result"]))
            continue
        errors = grade_case(case, result)
        if errors:
            failures.append((case.id, errors))
    for unexpected in sorted(set(by_id) - case_ids):
        failures.append((unexpected, ["unexpected result id"]))

    if failures:
        _print_failures(failures)
        return 1
    print(f"PASS {len(cases)} behavior case(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
