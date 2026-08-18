#!/usr/bin/env python3
"""Validate Prompt Builder regression cases and captured model results."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Any


EXPECTED_MODES = {"final", "question", "input_request"}
INVOCATION_MODES = {"text", "ui_selected"}
INPUT_REQUEST = "Dönüştürmemi istediğin taslağı paylaş."

STRING_LIST_FIELDS = {
    "required_contains",
    "required_contains_i",
    "forbidden_contains",
    "forbidden_contains_i",
    "required_regex",
    "forbidden_regex",
    "protects",
}
BOOL_PROPERTIES = {
    "final_block_only",
    "input_request_only",
    "single_question_only",
    "requires_options",
    "requires_recommendation",
    "requires_rationale",
    "no_public_analysis",
}
INT_PROPERTIES = {
    "max_chars",
    "max_nonempty_lines",
    "max_prompt_line_chars",
}
PROPERTY_KEYS = BOOL_PROPERTIES | INT_PROPERTIES
EQUIVALENCE_CONTRACT_FIELDS = (
    "expected_activation",
    "expected_mode",
    "required_contains",
    "required_contains_i",
    "forbidden_contains",
    "forbidden_contains_i",
    "required_regex",
    "forbidden_regex",
    "properties",
)
CASE_KEYS = {
    "id",
    "invocation",
    "equivalence_group",
    "description",
    "input",
    "expected_activation",
    "expected_mode",
    "saved_output",
    *STRING_LIST_FIELDS,
    "properties",
}

FINAL_PATTERN = re.compile(
    r"\s*### Nihai Prompt\s*\n+\s*```text\n.+\n```\s*",
    flags=re.DOTALL,
)
OPTION_PATTERN = re.compile(r"(?m)^\s*([A-C])\.\s+\S")
RECOMMENDATION_PATTERN = re.compile(r"(?i)\b(önerim|önerilen|öneriyorum)\b\s*:")
RECOMMENDED_OPTION_PATTERN = re.compile(
    r"(?i)\b(?:önerim|önerilen|öneriyorum)\b\s*:\s*\**\s*([A-C])(?:[.)]|\b)"
)
RATIONALE_PATTERN = re.compile(r"(?i)(\bgerekçe\b\s*:|\bçünkü\b)")
PUBLIC_ANALYSIS_PATTERNS = [
    r"(?im)^#{1,4}\s*(analysis|assumptions?|plan|score|rubric|diagnosis|summary)\b",
    r"(?im)^#{1,4}\s*(analiz|varsay[ıi]m|plan|skor|rubrik|tan[ıi]|özet)\b",
    r"(?im)^\s*(Analiz|Varsay[ıi]mlar?|Skor|Rubrik|Kaynak Notu)\s*:",
]


def load_json_object(path: Path, expected_version: int) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise SystemExit(f"{path}: could not read file: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: top-level JSON value must be an object")
    if data.get("version") != expected_version:
        raise SystemExit(f"{path}: expected version {expected_version}")
    return data


def nonempty_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.strip()]


def prompt_body_lines(output: str) -> list[str]:
    lines = output.splitlines()
    try:
        opening_index = lines.index("```text")
        closing_index = lines.index("```", opening_index + 1)
    except ValueError:
        return []
    return lines[opening_index + 1 : closing_index]


def is_indivisible_prompt_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    return bool(
        re.fullmatch(
            r"(?:\[[^\]\n]+\]\([^)\n]+\)|https?://\S+|`[^`\n]+`|\S+)",
            stripped,
        )
    )


def fold_text(text: str) -> str:
    """Case-fold Turkish dotted I without weakening other character checks."""
    return unicodedata.normalize("NFC", text).casefold().replace("\u0307", "")


def check_case_shape(case: Any, index: int, seen_ids: set[str]) -> tuple[str, list[str]]:
    label = f"<case #{index + 1}>"
    if not isinstance(case, dict):
        return label, ["case must be an object"]

    errors: list[str] = []
    case_id = case.get("id")
    if isinstance(case_id, str) and case_id:
        label = case_id
        if case_id in seen_ids:
            errors.append(f"duplicate case id: {case_id}")
        seen_ids.add(case_id)
    else:
        errors.append("case id must be a non-empty string")

    unknown_keys = sorted(set(case) - CASE_KEYS)
    if unknown_keys:
        errors.append(f"unknown case key(s): {', '.join(unknown_keys)}")

    if case.get("invocation", "text") not in INVOCATION_MODES:
        errors.append(f"invocation must be one of {sorted(INVOCATION_MODES)}")
    equivalence_group = case.get("equivalence_group")
    if equivalence_group is not None and (
        not isinstance(equivalence_group, str) or not equivalence_group
    ):
        errors.append("equivalence_group must be a non-empty string when provided")
    if not isinstance(case.get("input"), str) or not case["input"]:
        errors.append("input must be a non-empty string")
    if not isinstance(case.get("expected_activation"), bool):
        errors.append("expected_activation must be a boolean")

    valid_list_fields: set[str] = set()
    for key in STRING_LIST_FIELDS:
        if key not in case:
            continue
        value = case[key]
        if not isinstance(value, list) or not all(
            isinstance(item, str) and item for item in value
        ):
            errors.append(f"{key} must be an array of non-empty strings")
        else:
            valid_list_fields.add(key)

    if "protects" not in valid_list_fields or not case.get("protects"):
        errors.append("protects must be a non-empty array of strings")

    for key in ("required_regex", "forbidden_regex"):
        if key not in valid_list_fields:
            continue
        for pattern in case.get(key, []):
            try:
                re.compile(pattern)
            except re.error as exc:
                errors.append(f"{key} has invalid regex {pattern!r}: {exc}")

    properties = case.get("properties", {})
    if not isinstance(properties, dict):
        errors.append("properties must be an object")
        properties = {}
    else:
        unknown_properties = sorted(set(properties) - PROPERTY_KEYS)
        if unknown_properties:
            errors.append(
                f"unknown property key(s): {', '.join(unknown_properties)}"
            )
        for key in BOOL_PROPERTIES:
            if key in properties and not isinstance(properties[key], bool):
                errors.append(f"property {key} must be a boolean")
        for key in INT_PROPERTIES:
            value = properties.get(key)
            if value is not None and (
                not isinstance(value, int) or isinstance(value, bool) or value < 1
            ):
                errors.append(f"property {key} must be a positive integer")

    activated = case.get("expected_activation")
    expected_mode = case.get("expected_mode")
    saved_output = case.get("saved_output")
    if activated is True:
        if expected_mode not in EXPECTED_MODES:
            errors.append(f"expected_mode must be one of {sorted(EXPECTED_MODES)}")
        if saved_output is not None and (
            not isinstance(saved_output, str) or not saved_output
        ):
            errors.append("saved_output must be a non-empty string when provided")
        if expected_mode == "question":
            required_question_properties = {
                "single_question_only",
                "requires_options",
                "requires_recommendation",
                "requires_rationale",
            }
            missing = sorted(
                key for key in required_question_properties if properties.get(key) is not True
            )
            if missing:
                errors.append(
                    "question cases must enable property key(s): " + ", ".join(missing)
                )
    elif activated is False:
        if expected_mode is not None:
            errors.append("inactive cases must not define expected_mode")
        if saved_output is not None:
            errors.append("inactive cases must not define saved_output")

    return label, errors


def equivalence_contract(case: dict[str, Any]) -> dict[str, Any]:
    contract: dict[str, Any] = {}
    for key in EQUIVALENCE_CONTRACT_FIELDS:
        value = case.get(key)
        contract[key] = sorted(value) if isinstance(value, list) else value
    return contract


def check_equivalence_groups(
    cases: list[dict[str, Any]], shape_valid_ids: set[str]
) -> list[tuple[str, list[str]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for case in cases:
        if case.get("id") not in shape_valid_ids:
            continue
        group = case.get("equivalence_group")
        if isinstance(group, str):
            groups.setdefault(group, []).append(case)

    failures: list[tuple[str, list[str]]] = []
    for group, members in groups.items():
        label = f"<equivalence group {group}>"
        if len(members) < 2:
            failures.append((label, ["equivalence group must contain at least two cases"]))
            continue
        baseline = equivalence_contract(members[0])
        for member in members[1:]:
            contract = equivalence_contract(member)
            differing_fields = [
                key
                for key in EQUIVALENCE_CONTRACT_FIELDS
                if contract[key] != baseline[key]
            ]
            if differing_fields:
                failures.append(
                    (
                        label,
                        [
                            f"{member['id']} differs from {members[0]['id']} in: "
                            + ", ".join(differing_fields)
                        ],
                    )
                )
    return failures


def check_expected_mode(output: str, expected_mode: str) -> list[str]:
    errors: list[str] = []
    if expected_mode == "final":
        if not FINAL_PATTERN.fullmatch(output):
            errors.append(
                "final output must be only '### Nihai Prompt' plus one non-empty text fence"
            )
        if len(re.findall(r"(?m)^```", output)) != 2:
            errors.append("final output must contain exactly one fenced block")
    elif expected_mode == "question":
        if "### Nihai Prompt" in output or "```" in output:
            errors.append("question output must not include a final prompt or fenced block")
        if output.count("?") != 1:
            errors.append("question output must contain exactly one question mark")
    elif expected_mode == "input_request":
        if output.strip() != INPUT_REQUEST:
            errors.append(f"input request must be exactly: {INPUT_REQUEST}")
    else:
        errors.append(f"unknown expected_mode: {expected_mode}")
    return errors


def check_contains(output: str, case: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    folded_output = fold_text(output)
    for needle in case.get("required_contains", []):
        if needle not in output:
            errors.append(f"missing required text: {needle!r}")
    for needle in case.get("required_contains_i", []):
        if fold_text(needle) not in folded_output:
            errors.append(f"missing required text, case-insensitive: {needle!r}")
    for needle in case.get("forbidden_contains", []):
        if needle in output:
            errors.append(f"forbidden text present: {needle!r}")
    for needle in case.get("forbidden_contains_i", []):
        if fold_text(needle) in folded_output:
            errors.append(f"forbidden text present, case-insensitive: {needle!r}")
    for pattern in case.get("required_regex", []):
        if not re.search(pattern, output):
            errors.append(f"missing required regex: {pattern!r}")
    for pattern in case.get("forbidden_regex", []):
        if re.search(pattern, output):
            errors.append(f"forbidden regex matched: {pattern!r}")
    return errors


def check_properties(output: str, case: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    properties = case.get("properties", {})
    max_chars = properties.get("max_chars")
    if isinstance(max_chars, int) and len(output) > max_chars:
        errors.append(f"output has {len(output)} chars, above max_chars {max_chars}")
    max_nonempty_lines = properties.get("max_nonempty_lines")
    if (
        isinstance(max_nonempty_lines, int)
        and len(nonempty_lines(output)) > max_nonempty_lines
    ):
        errors.append(
            f"output has {len(nonempty_lines(output))} non-empty lines, "
            f"above max_nonempty_lines {max_nonempty_lines}"
        )
    max_prompt_line_chars = properties.get("max_prompt_line_chars")
    if isinstance(max_prompt_line_chars, int):
        for line_number, line in enumerate(prompt_body_lines(output), start=1):
            if (
                len(line) > max_prompt_line_chars
                and not is_indivisible_prompt_line(line)
            ):
                errors.append(
                    f"prompt line has {len(line)} chars at body line {line_number}, "
                    "above max_prompt_line_chars "
                    f"{max_prompt_line_chars}"
                )
    if properties.get("final_block_only") and not FINAL_PATTERN.fullmatch(output):
        errors.append("final_block_only contract failed")
    if properties.get("input_request_only") and output.strip() != INPUT_REQUEST:
        errors.append("input_request_only contract failed")
    if properties.get("single_question_only") and (
        output.count("?") != 1 or "### Nihai Prompt" in output or "```" in output
    ):
        errors.append("single-question output must contain one question and no prompt block")
    if properties.get("requires_options"):
        option_labels = OPTION_PATTERN.findall(output)
        if option_labels not in (["A", "B"], ["A", "B", "C"]):
            errors.append(
                "question output must contain ordered A/B or A/B/C options; found "
                + (", ".join(option_labels) or "none")
            )
    if properties.get("requires_recommendation"):
        if not RECOMMENDATION_PATTERN.search(output):
            errors.append("question output must include an explicit recommendation")
        else:
            recommendation = RECOMMENDED_OPTION_PATTERN.search(output)
            option_labels = OPTION_PATTERN.findall(output)
            if recommendation is None:
                errors.append(
                    "question recommendation must select an explicit option label"
                )
            elif recommendation.group(1).upper() not in option_labels:
                errors.append(
                    "question recommendation must select one of the listed options"
                )
    if properties.get("requires_rationale") and not RATIONALE_PATTERN.search(output):
        errors.append("question output must include an explicit rationale")
    if properties.get("no_public_analysis"):
        for pattern in PUBLIC_ANALYSIS_PATTERNS:
            if re.search(pattern, output):
                errors.append(f"public analysis pattern matched: {pattern}")
    return errors


def validate_output(case: dict[str, Any], output: str) -> list[str]:
    errors = check_expected_mode(output, case["expected_mode"])
    errors.extend(check_contains(output, case))
    errors.extend(check_properties(output, case))
    return errors


def load_and_validate_cases(
    path: Path,
) -> tuple[list[dict[str, Any]], list[tuple[str, list[str]]], int]:
    data = load_json_object(path, 1)
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        raise SystemExit(f"{path}: cases must be a non-empty array")

    failures: list[tuple[str, list[str]]] = []
    seen_ids: set[str] = set()
    shape_valid_ids: set[str] = set()
    for index, case in enumerate(cases):
        label, errors = check_case_shape(case, index, seen_ids)
        if errors:
            failures.append((label, errors))
        elif isinstance(case, dict):
            shape_valid_ids.add(case["id"])

    failures.extend(check_equivalence_groups(cases, shape_valid_ids))

    saved_count = 0
    for case in cases:
        if not isinstance(case, dict) or case.get("id") not in shape_valid_ids:
            continue
        saved_output = case.get("saved_output")
        if isinstance(saved_output, str):
            saved_count += 1
            errors = validate_output(case, saved_output)
            if errors:
                failures.append((case["id"], errors))
    return cases, failures, saved_count


def load_results(path: Path) -> list[Any]:
    data = load_json_object(path, 1)
    results = data.get("results")
    if not isinstance(results, list):
        raise SystemExit(f"{path}: results must be an array")
    return results


def capture_results(
    cases: list[dict[str, Any]], runner: Path, timeout_seconds: int
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for case in cases:
        try:
            completed = subprocess.run(
                [str(runner)],
                input=json.dumps(case, ensure_ascii=False),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise SystemExit(
                f"runner timed out after {timeout_seconds}s for {case['id']}"
            ) from exc
        if completed.returncode:
            raise SystemExit(
                f"runner failed for {case['id']} with exit {completed.returncode}: "
                f"{completed.stderr.strip()}"
            )
        try:
            result = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise SystemExit(
                f"runner returned invalid JSON for {case['id']}: {exc}"
            ) from exc
        if not isinstance(result, dict):
            raise SystemExit(f"runner result for {case['id']} must be an object")
        result["id"] = case["id"]
        results.append(result)
    return results


def grade_result(case: dict[str, Any], result: dict[str, Any]) -> list[str]:
    activated = result.get("activated")
    if not isinstance(activated, bool):
        return ["result needs boolean activated"]
    if activated != case["expected_activation"]:
        return [
            f"activation was {activated}, expected {case['expected_activation']}"
        ]
    output = result.get("output", "")
    if not isinstance(output, str):
        return ["result output must be a string"]
    if not activated:
        return []
    return validate_output(case, output)


def grade_results(
    cases: list[dict[str, Any]], results: list[Any]
) -> list[tuple[str, list[str]]]:
    failures: list[tuple[str, list[str]]] = []
    by_id: dict[str, dict[str, Any]] = {}
    for index, result in enumerate(results):
        if not isinstance(result, dict):
            failures.append((f"<result #{index + 1}>", ["result must be an object"]))
            continue
        result_id = result.get("id")
        if not isinstance(result_id, str) or not result_id:
            failures.append(
                (f"<result #{index + 1}>", ["result needs a non-empty string id"])
            )
            continue
        if result_id in by_id:
            failures.append((result_id, [f"duplicate result id: {result_id}"]))
            continue
        by_id[result_id] = result

    case_ids = {case["id"] for case in cases}
    for case in cases:
        result = by_id.get(case["id"])
        if result is None:
            failures.append((case["id"], ["missing result"]))
            continue
        errors = grade_result(case, result)
        if errors:
            failures.append((case["id"], errors))
    for unexpected in sorted(set(by_id) - case_ids):
        failures.append((unexpected, ["unexpected result id"]))
    return failures


def print_failures(failures: list[tuple[str, list[str]]]) -> None:
    for case_id, errors in failures:
        print(f"FAIL {case_id}", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate Prompt Builder regression cases and optional captured model results."
        )
    )
    parser.add_argument("case_file", type=Path)
    result_source = parser.add_mutually_exclusive_group()
    result_source.add_argument("--results", type=Path)
    result_source.add_argument("--runner", type=Path)
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=60,
        help="Per-case runner timeout (default: 60).",
    )
    args = parser.parse_args()
    if args.timeout_seconds < 1:
        parser.error("--timeout-seconds must be positive")

    cases, failures, saved_count = load_and_validate_cases(args.case_file)
    if failures:
        print_failures(failures)
        print(f"{len(failures)} regression case(s) failed", file=sys.stderr)
        return 1

    print(f"PASS {len(cases)} regression case(s); {saved_count} saved output(s)")
    if args.results is None and args.runner is None:
        return 0

    results = (
        load_results(args.results)
        if args.results is not None
        else capture_results(cases, args.runner, args.timeout_seconds)
    )
    result_failures = grade_results(cases, results)
    if result_failures:
        print_failures(result_failures)
        print(
            f"{len(result_failures)} captured result(s) failed",
            file=sys.stderr,
        )
        return 1
    print(f"PASS {len(cases)} captured result(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
