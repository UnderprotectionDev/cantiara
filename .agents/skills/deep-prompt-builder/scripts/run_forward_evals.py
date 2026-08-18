#!/usr/bin/env python3
"""Run blind Deep Prompt Builder forward evaluations through external adapters."""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

from check_regressions import (
    FORWARD_EVALUATION_METHOD,
    grade_forward_results,
    grade_forward_run,
    load_and_validate_forward_cases,
    print_failures,
)


GENERATOR_RESPONSE_KEYS = {"generator_id", "activated", "output"}
EVALUATOR_RESPONSE_KEYS = {
    "evaluator_id",
    "status",
    "hard_failures",
    "requirement_evidence",
    "scores",
    "evidence",
}
GENERATOR_CASE_KEYS = {
    "id",
    "invocation",
    "input",
    "selected_skills",
    "required_tools",
    "capability_profile",
    "fixtures",
}


class AdapterError(Exception):
    """Expected adapter or protocol failure reported without a traceback."""


def parse_command(raw: str, label: str) -> list[str]:
    try:
        command = shlex.split(raw)
    except ValueError as exc:
        raise AdapterError(f"{label} command could not be parsed: {exc}") from exc
    if not command:
        raise AdapterError(f"{label} command must not be empty")
    return command


def call_adapter(
    command: list[str],
    payload: dict[str, Any],
    *,
    label: str,
    cwd: Path,
    timeout_seconds: int,
) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            cwd=cwd,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        raise AdapterError(f"could not execute {label}: {exc}") from exc
    except OSError as exc:
        raise AdapterError(f"could not execute {label}: {exc}") from exc
    except subprocess.TimeoutExpired as exc:
        raise AdapterError(
            f"{label} timed out after {timeout_seconds} seconds"
        ) from exc

    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        suffix = f": {detail}" if detail else ""
        raise AdapterError(
            f"{label} failed with exit code {completed.returncode}{suffix}"
        )
    try:
        response = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise AdapterError(f"{label} returned invalid JSON: {exc}") from exc
    if not isinstance(response, dict):
        raise AdapterError(f"{label} response must be a JSON object")
    return response


def validate_response_keys(
    response: dict[str, Any], expected: set[str], label: str
) -> None:
    missing = sorted(expected - set(response))
    unknown = sorted(set(response) - expected)
    if missing:
        raise AdapterError(f"{label} response missing key(s): {', '.join(missing)}")
    if unknown:
        raise AdapterError(f"{label} response has unknown key(s): {', '.join(unknown)}")


def generator_case(case: dict[str, Any]) -> dict[str, Any]:
    """Hide evaluator-only answer keys and rubrics from the generator."""
    return {key: case[key] for key in GENERATOR_CASE_KEYS if key in case}


def run_once(
    case: dict[str, Any],
    rubric: dict[str, Any],
    run_number: int,
    generator_command: list[str],
    evaluator_command: list[str],
    package_dir: Path,
    timeout_seconds: int,
) -> tuple[dict[str, Any], bool | None]:
    run_id = f"{case['id']}-{run_number}"
    generation = call_adapter(
        generator_command,
        {
            "protocol_version": 1,
            "role": "generator",
            "run_id": run_id,
            "package_dir": str(package_dir),
            "case": generator_case(case),
        },
        label=f"generator for {run_id}",
        cwd=package_dir,
        timeout_seconds=timeout_seconds,
    )
    validate_response_keys(
        generation, GENERATOR_RESPONSE_KEYS, f"generator for {run_id}"
    )
    if not isinstance(generation["generator_id"], str) or not generation[
        "generator_id"
    ]:
        raise AdapterError(f"generator for {run_id} needs non-empty generator_id")
    if not isinstance(generation["activated"], bool):
        raise AdapterError(f"generator for {run_id} needs boolean activated")
    if generation["output"] is not None and not isinstance(generation["output"], str):
        raise AdapterError(f"generator for {run_id} output must be string or null")

    evaluation = call_adapter(
        evaluator_command,
        {
            "protocol_version": 1,
            "role": "evaluator",
            "run_id": run_id,
            "package_dir": str(package_dir),
            "case": case,
            "rubric": rubric,
            "generation": generation,
        },
        label=f"evaluator for {run_id}",
        cwd=package_dir,
        timeout_seconds=timeout_seconds,
    )
    validate_response_keys(
        evaluation, EVALUATOR_RESPONSE_KEYS, f"evaluator for {run_id}"
    )
    if not isinstance(evaluation["evaluator_id"], str) or not evaluation[
        "evaluator_id"
    ]:
        raise AdapterError(f"evaluator for {run_id} needs non-empty evaluator_id")

    run = {
        "run_id": run_id,
        "generator_id": generation["generator_id"],
        "evaluator_id": evaluation["evaluator_id"],
        "status": evaluation["status"],
        "activated": generation["activated"],
        "output": generation["output"],
        "hard_failures": evaluation["hard_failures"],
        "requirement_evidence": evaluation["requirement_evidence"],
        "scores": evaluation["scores"],
        "evidence": evaluation["evidence"],
    }
    errors, outcome = grade_forward_run(case, run, rubric)
    if errors and outcome is None and run["status"] != "blocked":
        raise AdapterError(f"invalid {run_id}: {'; '.join(errors)}")
    return run, outcome


def write_results(path: Path, data: dict[str, Any], force: bool) -> None:
    if path.exists() and not force:
        raise AdapterError(f"output already exists: {path}; pass --force to replace it")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def run_main(args: argparse.Namespace) -> int:
    rubric, cases, failures = load_and_validate_forward_cases(args.forward_cases)
    if failures:
        print_failures(failures)
        return 1

    generator_command = parse_command(args.generator_command, "generator")
    evaluator_command = parse_command(args.evaluator_command, "evaluator")
    package_dir = args.forward_cases.resolve().parents[1]
    results: list[dict[str, Any]] = []
    for case in cases:
        runs: list[dict[str, Any]] = []
        outcomes: list[bool | None] = []
        for number in (1, 2):
            run, outcome = run_once(
                case,
                rubric,
                number,
                generator_command,
                evaluator_command,
                package_dir,
                args.timeout_seconds,
            )
            runs.append(run)
            outcomes.append(outcome)
        if outcomes in ([True, False], [False, True]):
            run, _ = run_once(
                case,
                rubric,
                3,
                generator_command,
                evaluator_command,
                package_dir,
                args.timeout_seconds,
            )
            runs.append(run)
        results.append({"id": case["id"], "runs": runs})

    document = {
        "version": 1,
        "evaluation_method": FORWARD_EVALUATION_METHOD,
        "results": results,
    }
    write_results(args.output, document, args.force)
    failures = grade_forward_results(cases, results, rubric)
    if failures:
        print_failures(failures)
        print(f"WROTE failing evidence to {args.output}", file=sys.stderr)
        return 1
    print(f"PASS {len(cases)} forward result(s); wrote {args.output}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run two blind generator/evaluator passes per forward case and write "
            "checker-compatible evidence."
        )
    )
    parser.add_argument("forward_cases", type=Path)
    parser.add_argument("--generator-command", required=True)
    parser.add_argument("--evaluator-command", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.timeout_seconds < 1:
        parser.error("--timeout-seconds must be positive")
    try:
        return run_main(args)
    except AdapterError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
