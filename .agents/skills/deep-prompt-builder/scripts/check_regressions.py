#!/usr/bin/env python3
"""Validate Deep Prompt Builder regression cases and captured model results."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Any


EXPECTED_MODES = {"final", "question", "input_request", "source_request"}
INVOCATION_TYPES = {"text", "ui_selected"}
INPUT_REQUEST = "Derinleştirmemi istediğin taslağı paylaş."
SOURCE_REQUEST_PREFIX = (
    "Promptu hazırlamak için şu kaynaklara erişmem gerekiyor. Lütfen erişilebilir hâle "
    "getir veya içeriklerini paylaş:"
)
TOP_LEVEL_KEYS = {"version", "description", "required_protections", "cases"}
RESULT_TOP_LEVEL_KEYS = {"version", "results"}
RESULT_KEYS = {"id", "activated", "output"}
FORWARD_TOP_LEVEL_KEYS = {
    "version",
    "description",
    "required_risk_areas",
    "rubric",
    "cases",
}
FORWARD_RESULT_TOP_LEVEL_KEYS = {"version", "evaluation_method", "results"}
FORWARD_EVALUATION_METHOD = "blind_external_attestation"
FORWARD_CASE_KEYS = {
    "id",
    "description",
    "invocation",
    "input",
    "selected_skills",
    "expected_activation",
    "expected_modes",
    "required_tools",
    "capability_profile",
    "fixtures",
    "risk_areas",
    "hard_requirements",
    "quality_focus",
    "required_runs",
}
FORWARD_RESULT_KEYS = {"id", "runs"}
FORWARD_RUN_KEYS = {
    "run_id",
    "generator_id",
    "evaluator_id",
    "status",
    "activated",
    "output",
    "hard_failures",
    "requirement_evidence",
    "scores",
    "evidence",
}
FORWARD_RUN_STATUSES = {"completed", "blocked"}
FORWARD_TOOLS = {
    "filesystem",
    "image",
    "web",
    "downstream_contract",
    "read_only_tool",
}
CAPABILITY_PROFILES = {"standard", "web_unavailable", "mock_read_only_tool"}
FORWARD_RUBRIC_KEYS = {
    "hard_failures",
    "quality_dimensions",
    "min_dimension_score",
    "min_total_score",
    "score_max",
}

STRING_LIST_FIELDS = {
    "required_contains",
    "required_contains_i",
    "forbidden_contains",
    "forbidden_contains_i",
    "required_regex",
    "forbidden_regex",
    "protects",
}
OUTPUT_CONTRACT_FIELDS = STRING_LIST_FIELDS - {"protects"}
BOOL_PROPERTIES = {
    "final_block_only",
    "input_request_only",
    "source_request_only",
    "decision_request_only",
    "requires_options",
    "requires_recommendation",
    "requires_rationale",
    "no_public_analysis",
}
INT_PROPERTIES = {"max_chars", "max_nonempty_lines", "max_prompt_line_chars"}
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
    "selected_skills",
    "expected_activation",
    "expected_mode",
    "saved_output",
    *STRING_LIST_FIELDS,
    "properties",
}

FINAL_PATTERN = re.compile(r"\s*```text\n.+\n```\s*", flags=re.DOTALL)
OPTION_PATTERN = re.compile(r"(?m)^\s*([A-C])\.\s+\S")
RECOMMENDATION_PATTERN = re.compile(r"(?i)\b(önerim|önerilen|öneriyorum)\b\s*:")
RECOMMENDED_OPTION_PATTERN = re.compile(
    r"(?i)\b(?:önerim|önerilen|öneriyorum)\b\s*:\s*\**\s*([A-C])(?:[.)]|\b)"
)
RATIONALE_PATTERN = re.compile(r"(?i)(\bgerekçe\b\s*:|\bçünkü\b)")
PUBLIC_ANALYSIS_PATTERNS = (
    r"(?im)^#{1,4}\s*(analysis|assumptions?|plan|score|rubric|diagnosis|summary)\b",
    r"(?im)^#{1,4}\s*(analiz|varsay[ıi]mlar?|plan|skor|rubrik|tan[ıi]|özet)\b",
    r"(?im)^\s*(Analiz|Varsay[ıi]mlar?|Skor|Rubrik|Kaynak Notu)\s*:",
)


def decision_blocks(output: str) -> list[str]:
    """Split a sequentially numbered decision frontier into question blocks."""
    stripped = output.strip()
    if not stripped:
        return []
    starts = list(re.finditer(r"(?m)^(\d+)\.\s+\S", stripped))
    if not starts:
        return []
    if starts[0].start() != 0:
        return []
    numbers = [int(match.group(1)) for match in starts]
    if numbers != list(range(1, len(numbers) + 1)):
        return []
    blocks: list[str] = []
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(stripped)
        block = stripped[match.start() : end].strip()
        block = re.sub(r"^\d+\.\s+", "", block, count=1)
        blocks.append(block)
    return blocks


def check_decision_block(block: str) -> list[str]:
    """Validate one question, its options, recommendation, and rationale."""
    errors: list[str] = []
    raw_lines = [line for line in block.splitlines() if line.strip()]
    lines = [line.strip() for line in raw_lines]
    if not lines or not lines[0].endswith("?") or block.count("?") != 1:
        errors.append("each decision block must start with exactly one question")
        return errors
    labels = OPTION_PATTERN.findall(block)
    if labels not in (["A", "B"], ["A", "B", "C"]):
        errors.append("each decision block must contain ordered A/B or A/B/C options")
    recommendation = RECOMMENDED_OPTION_PATTERN.search(block)
    if recommendation is None or recommendation.group(1).upper() not in labels:
        errors.append("each decision block must recommend one listed option")
    if not RATIONALE_PATTERN.search(block):
        errors.append("each decision block must include an explicit rationale")

    option_count = len(labels)
    expected_labels = [f"{label}." for label in labels]
    option_lines_valid = (
        len(lines) >= 1 + option_count
        and all(
            lines[index + 1].startswith(label)
            for index, label in enumerate(expected_labels)
        )
    )
    trailing = lines[1 + option_count :] if option_lines_valid else []
    recommendation_only = (
        len(trailing) == 1
        and RECOMMENDATION_PATTERN.search(trailing[0])
        and RATIONALE_PATTERN.search(trailing[0])
    )
    recommendation_then_rationale = (
        len(trailing) >= 2
        and RECOMMENDATION_PATTERN.search(trailing[0])
        and RATIONALE_PATTERN.search(trailing[1])
        and all(line[:1].isspace() for line in raw_lines[1 + option_count + 2 :])
    )
    if not option_lines_valid or not (
        recommendation_only or recommendation_then_rationale
    ):
        errors.append(
            "each decision block must contain only its question, options, "
            "recommendation, and rationale"
        )
    return errors


class DataError(Exception):
    """Expected user/data error that should be reported without a traceback."""


def load_json_object(
    path: Path, allowed_keys: set[str], expected_version: int
) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise DataError(f"{path}: could not read file: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise DataError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise DataError(f"{path}: top-level JSON value must be an object")
    unknown = sorted(set(data) - allowed_keys)
    if unknown:
        raise DataError(f"{path}: unknown top-level key(s): {', '.join(unknown)}")
    if data.get("version") != expected_version:
        raise DataError(f"{path}: expected version {expected_version}")
    return data


def fold_text(text: str) -> str:
    """Case-fold Turkish dotted I without weakening exact checks."""
    return unicodedata.normalize("NFC", text).casefold().replace("\u0307", "")


def nonempty_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.strip()]


def prompt_body_lines(output: str) -> list[str]:
    lines = output.splitlines()
    try:
        opening = lines.index("```text")
        closing = lines.index("```", opening + 1)
    except ValueError:
        return []
    return lines[opening + 1 : closing]


def wrapper_text(output: str) -> str:
    """Return only public wrapper text, excluding legitimate task content."""
    lines = output.splitlines()
    try:
        opening = lines.index("```text")
        closing = lines.index("```", opening + 1)
    except ValueError:
        return output
    return "\n".join(lines[:opening] + lines[closing + 1 :])


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


def check_case_shape(
    case: Any, index: int, seen_ids: set[str]
) -> tuple[str, list[str]]:
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

    unknown = sorted(set(case) - CASE_KEYS)
    if unknown:
        errors.append(f"unknown case key(s): {', '.join(unknown)}")
    if (
        not isinstance(case.get("invocation"), str)
        or case["invocation"] not in INVOCATION_TYPES
    ):
        errors.append(f"invocation must be one of {sorted(INVOCATION_TYPES)}")
    if not isinstance(case.get("input"), str) or not case.get("input"):
        errors.append("input must be a non-empty string")
    selected_skills = case.get("selected_skills")
    if selected_skills is not None:
        if not isinstance(selected_skills, list) or not selected_skills or not all(
            isinstance(item, str) and item for item in selected_skills
        ):
            errors.append("selected_skills must be a non-empty array of strings")
        elif len(selected_skills) != len(set(selected_skills)):
            errors.append("selected_skills must not contain duplicates")
        if case.get("invocation") != "ui_selected":
            errors.append("selected_skills requires ui_selected invocation")
    if not isinstance(case.get("expected_activation"), bool):
        errors.append("expected_activation must be a boolean")
    description = case.get("description")
    if description is not None and (
        not isinstance(description, str) or not description
    ):
        errors.append("description must be a non-empty string when provided")
    group = case.get("equivalence_group")
    if group is not None and (not isinstance(group, str) or not group):
        errors.append("equivalence_group must be a non-empty string when provided")

    valid_lists: set[str] = set()
    for key in STRING_LIST_FIELDS:
        if key not in case:
            continue
        value = case[key]
        if not isinstance(value, list) or not all(
            isinstance(item, str) and item for item in value
        ):
            errors.append(f"{key} must be an array of non-empty strings")
        else:
            valid_lists.add(key)
    if "protects" not in valid_lists or not case.get("protects"):
        errors.append("protects must be a non-empty array of strings")

    for key in ("required_regex", "forbidden_regex"):
        if key not in valid_lists:
            continue
        for pattern in case[key]:
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
    mode = case.get("expected_mode")
    saved_output = case.get("saved_output")
    if activated is True:
        if not isinstance(mode, str) or mode not in EXPECTED_MODES:
            errors.append(f"expected_mode must be one of {sorted(EXPECTED_MODES)}")
        if not isinstance(saved_output, str) or not saved_output:
            errors.append("active cases must define a non-empty saved_output")
        if mode == "question":
            required = {
                "decision_request_only",
                "requires_options",
                "requires_recommendation",
                "requires_rationale",
            }
            missing = sorted(key for key in required if properties.get(key) is not True)
            if missing:
                errors.append(
                    "question cases must enable property key(s): " + ", ".join(missing)
                )
        if mode == "source_request" and properties.get("source_request_only") is not True:
            errors.append("source_request cases must enable source_request_only")
    elif activated is False:
        if "expected_mode" in case:
            errors.append("inactive cases must not define expected_mode")
        if "saved_output" in case:
            errors.append("inactive cases must not define saved_output")
        forbidden_contracts = sorted(OUTPUT_CONTRACT_FIELDS & set(case))
        if forbidden_contracts:
            errors.append(
                "inactive cases must not define output contract field(s): "
                + ", ".join(forbidden_contracts)
            )
        if properties:
            errors.append("inactive cases must not define output properties")

    return label, errors


def canonical_contract_value(value: Any) -> Any:
    if isinstance(value, list):
        return sorted(value)
    if isinstance(value, dict):
        return {key: canonical_contract_value(value[key]) for key in sorted(value)}
    return value


def equivalence_contract(case: dict[str, Any]) -> dict[str, Any]:
    return {
        key: canonical_contract_value(case.get(key))
        for key in EQUIVALENCE_CONTRACT_FIELDS
    }


def check_equivalence_groups(
    cases: list[dict[str, Any]], valid_ids: set[str]
) -> list[tuple[str, list[str]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for case in cases:
        if not isinstance(case, dict):
            continue
        if case.get("id") in valid_ids and isinstance(case.get("equivalence_group"), str):
            groups.setdefault(case["equivalence_group"], []).append(case)

    failures: list[tuple[str, list[str]]] = []
    for group, members in groups.items():
        label = f"<equivalence group {group}>"
        if len(members) < 2:
            failures.append((label, ["equivalence group must contain at least two cases"]))
            continue
        baseline = equivalence_contract(members[0])
        for member in members[1:]:
            contract = equivalence_contract(member)
            differing = [
                key for key in EQUIVALENCE_CONTRACT_FIELDS if contract[key] != baseline[key]
            ]
            if differing:
                failures.append(
                    (
                        label,
                        [
                            f"{member['id']} differs from {members[0]['id']} in: "
                            + ", ".join(differing)
                        ],
                    )
                )
    return failures


def check_expected_mode(output: str, mode: str) -> list[str]:
    errors: list[str] = []
    if mode == "final":
        if not FINAL_PATTERN.fullmatch(output):
            errors.append("final output must be only one non-empty text fence")
        if len(re.findall(r"(?m)^```", output)) != 2:
            errors.append("final output must contain exactly one fenced block")
    elif mode == "question":
        if "```" in output:
            errors.append("question output must not include a final prompt or fenced block")
        blocks = decision_blocks(output)
        if not blocks:
            errors.append(
                "question output must be a sequentially numbered decision frontier"
            )
        for index, block in enumerate(blocks, start=1):
            errors.extend(
                f"decision {index}: {error}" for error in check_decision_block(block)
            )
    elif mode == "input_request":
        if output.strip() != INPUT_REQUEST:
            errors.append(f"input request must be exactly: {INPUT_REQUEST}")
    elif mode == "source_request":
        lines = output.strip().splitlines()
        if not lines or lines[0] != SOURCE_REQUEST_PREFIX:
            errors.append(
                "source request must start with the canonical source-request sentence"
            )
        source_lines = [line for line in lines[1:] if line.strip()]
        if not source_lines or any(
            not line.startswith("- ") or not line[2:].strip() for line in source_lines
        ):
            errors.append("source request must contain only a non-empty bullet source list")
        elif len(source_lines) != len(set(source_lines)):
            errors.append("source request source list must not contain duplicates")
        if "?" in output or "###" in output or "```" in output:
            errors.append("source request must not contain a question, heading, or fence")
    else:
        errors.append(f"unknown expected_mode: {mode}")
    return errors


def check_content(output: str, case: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    folded = fold_text(output)
    for needle in case.get("required_contains", []):
        if needle not in output:
            errors.append(f"missing required text: {needle!r}")
    for needle in case.get("required_contains_i", []):
        if fold_text(needle) not in folded:
            errors.append(f"missing required text, case-insensitive: {needle!r}")
    for needle in case.get("forbidden_contains", []):
        if needle in output:
            errors.append(f"forbidden text present: {needle!r}")
    for needle in case.get("forbidden_contains_i", []):
        if fold_text(needle) in folded:
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
    if isinstance(properties.get("max_chars"), int) and len(output) > properties["max_chars"]:
        errors.append(
            f"output has {len(output)} chars, above max_chars {properties['max_chars']}"
        )
    if isinstance(properties.get("max_nonempty_lines"), int):
        count = len(nonempty_lines(output))
        if count > properties["max_nonempty_lines"]:
            errors.append(
                f"output has {count} non-empty lines, above max_nonempty_lines "
                f"{properties['max_nonempty_lines']}"
            )
    maximum = properties.get("max_prompt_line_chars")
    if maximum is None and case.get("expected_mode") == "final":
        maximum = 95
    if isinstance(maximum, int):
        for number, line in enumerate(prompt_body_lines(output), start=1):
            if len(line) > maximum and not is_indivisible_prompt_line(line):
                errors.append(
                    f"prompt line has {len(line)} chars at body line {number}, "
                    f"above max_prompt_line_chars {maximum}"
                )
    if properties.get("final_block_only") and not FINAL_PATTERN.fullmatch(output):
        errors.append("final_block_only contract failed")
    if properties.get("input_request_only") and output.strip() != INPUT_REQUEST:
        errors.append("input_request_only contract failed")
    if properties.get("source_request_only"):
        errors.extend(check_expected_mode(output, "source_request"))
    if properties.get("decision_request_only"):
        errors.extend(check_expected_mode(output, "question"))
    if properties.get("requires_options"):
        if not decision_blocks(output) or any(
            "ordered A/B" in error
            for block in decision_blocks(output)
            for error in check_decision_block(block)
        ):
            errors.append("every decision must contain ordered A/B or A/B/C options")
    if properties.get("requires_recommendation"):
        if not decision_blocks(output) or any(
            "recommend" in error
            for block in decision_blocks(output)
            for error in check_decision_block(block)
        ):
            errors.append("every decision must recommend one listed option")
    if properties.get("requires_rationale") and (
        not decision_blocks(output)
        or any(
            "rationale" in error
            for block in decision_blocks(output)
            for error in check_decision_block(block)
        )
    ):
        errors.append("every decision must include an explicit rationale")
    if properties.get("no_public_analysis"):
        public_wrapper = wrapper_text(output)
        for pattern in PUBLIC_ANALYSIS_PATTERNS:
            if re.search(pattern, public_wrapper):
                errors.append(f"public analysis pattern matched outside prompt body: {pattern}")
    return errors


def validate_output(case: dict[str, Any], output: str) -> list[str]:
    errors = check_expected_mode(output, case["expected_mode"])
    errors.extend(check_content(output, case))
    errors.extend(check_properties(output, case))
    return errors


def load_and_validate_cases(
    path: Path,
) -> tuple[list[dict[str, Any]], list[tuple[str, list[str]]], int]:
    data = load_json_object(path, TOP_LEVEL_KEYS, expected_version=2)
    description = data.get("description")
    if description is not None and not isinstance(description, str):
        raise DataError(f"{path}: description must be a string")
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        raise DataError(f"{path}: cases must be a non-empty array")

    failures: list[tuple[str, list[str]]] = []
    seen_ids: set[str] = set()
    valid_ids: set[str] = set()
    for index, case in enumerate(cases):
        label, errors = check_case_shape(case, index, seen_ids)
        if errors:
            failures.append((label, errors))
        elif isinstance(case, dict):
            valid_ids.add(case["id"])
    failures.extend(check_equivalence_groups(cases, valid_ids))

    required_protections = data.get("required_protections")
    if not isinstance(required_protections, list) or not required_protections or not all(
        isinstance(item, str) and item for item in required_protections
    ):
        failures.append(
            ("<required_protections>", ["must be a non-empty array of strings"])
        )
    elif len(required_protections) != len(set(required_protections)):
        failures.append(("<required_protections>", ["must not contain duplicates"]))
    else:
        protected = {
            item
            for case in cases
            if isinstance(case, dict) and isinstance(case.get("protects"), list)
            for item in case["protects"]
        }
        missing = sorted(set(required_protections) - protected)
        if missing:
            failures.append(
                (
                    "<required_protections>",
                    ["uncovered protection(s): " + ", ".join(missing)],
                )
            )

    saved_count = 0
    for case in cases:
        if not isinstance(case, dict) or case.get("id") not in valid_ids:
            continue
        if case["expected_activation"]:
            saved_count += 1
            errors = validate_output(case, case["saved_output"])
            if errors:
                failures.append((case["id"], errors))
    return cases, failures, saved_count


def load_results(path: Path) -> list[Any]:
    data = load_json_object(path, RESULT_TOP_LEVEL_KEYS, expected_version=1)
    results = data.get("results")
    if not isinstance(results, list):
        raise DataError(f"{path}: results must be an array")
    return results


def capture_results(
    cases: list[dict[str, Any]], runner: Path, timeout_seconds: int
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for case in cases:
        runner_input = {
            "id": case["id"],
            "invocation": case["invocation"],
            "input": case["input"],
        }
        if "selected_skills" in case:
            runner_input["selected_skills"] = case["selected_skills"]
        try:
            completed = subprocess.run(
                [str(runner)],
                input=json.dumps(runner_input, ensure_ascii=False),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise DataError(
                f"runner timed out after {timeout_seconds}s for {case['id']}"
            ) from exc
        except OSError as exc:
            raise DataError(f"could not execute runner for {case['id']}: {exc}") from exc
        if completed.returncode:
            detail = completed.stderr.strip() or "no stderr"
            raise DataError(
                f"runner failed for {case['id']} with exit {completed.returncode}: {detail}"
            )
        try:
            result = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise DataError(f"runner returned invalid JSON for {case['id']}: {exc}") from exc
        if not isinstance(result, dict):
            raise DataError(f"runner result for {case['id']} must be an object")
        unknown = sorted(set(result) - {"activated", "output"})
        if unknown:
            raise DataError(
                f"runner result for {case['id']} has unknown key(s): {', '.join(unknown)}"
            )
        result["id"] = case["id"]
        results.append(result)
    return results


def grade_result(case: dict[str, Any], result: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    unknown = sorted(set(result) - RESULT_KEYS)
    if unknown:
        errors.append(f"unknown result key(s): {', '.join(unknown)}")
    activated = result.get("activated")
    if not isinstance(activated, bool):
        return errors + ["result needs boolean activated"]
    if activated != case["expected_activation"]:
        return errors + [
            f"activation was {activated}, expected {case['expected_activation']}"
        ]
    if not activated:
        if result.get("output") not in (None, ""):
            errors.append("inactive result must not contain output")
        return errors
    output = result.get("output")
    if not isinstance(output, str):
        return errors + ["active result output must be a string"]
    return errors + validate_output(case, output)


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
            failures.append((f"<result #{index + 1}>", ["result needs a non-empty string id"]))
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


def validate_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not value or not all(
        isinstance(item, str) and item for item in value
    ):
        return [f"{label} must be a non-empty array of strings"]
    if len(value) != len(set(value)):
        return [f"{label} must not contain duplicates"]
    return []


def load_and_validate_forward_cases(
    path: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[tuple[str, list[str]]]]:
    data = load_json_object(path, FORWARD_TOP_LEVEL_KEYS, expected_version=1)
    failures: list[tuple[str, list[str]]] = []
    if not isinstance(data.get("description"), str) or not data["description"]:
        failures.append(("<forward description>", ["must be a non-empty string"]))

    required_areas = data.get("required_risk_areas")
    area_errors = validate_string_list(required_areas, "required_risk_areas")
    if area_errors:
        failures.append(("<required_risk_areas>", area_errors))
        required_areas = []

    rubric = data.get("rubric")
    if not isinstance(rubric, dict):
        failures.append(("<forward rubric>", ["rubric must be an object"]))
        rubric = {}
    else:
        unknown = sorted(set(rubric) - FORWARD_RUBRIC_KEYS)
        missing = sorted(FORWARD_RUBRIC_KEYS - set(rubric))
        errors: list[str] = []
        if unknown:
            errors.append("unknown rubric key(s): " + ", ".join(unknown))
        if missing:
            errors.append("missing rubric key(s): " + ", ".join(missing))
        errors.extend(validate_string_list(rubric.get("hard_failures"), "hard_failures"))
        errors.extend(
            validate_string_list(
                rubric.get("quality_dimensions"), "quality_dimensions"
            )
        )
        for key in ("min_dimension_score", "min_total_score", "score_max"):
            value = rubric.get(key)
            if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                errors.append(f"{key} must be a positive integer")
        if not errors:
            dimensions = rubric["quality_dimensions"]
            if rubric["min_dimension_score"] > rubric["score_max"]:
                errors.append("min_dimension_score must not exceed score_max")
            maximum_total = rubric["score_max"] * len(dimensions)
            if rubric["min_total_score"] > maximum_total:
                errors.append("min_total_score exceeds the maximum possible score")
        if errors:
            failures.append(("<forward rubric>", errors))

    raw_cases = data.get("cases")
    if not isinstance(raw_cases, list) or not raw_cases:
        raise DataError(f"{path}: cases must be a non-empty array")

    seen: set[str] = set()
    cases: list[dict[str, Any]] = []
    covered: set[str] = set()
    package_dir = path.parents[1]
    for index, case in enumerate(raw_cases):
        label = f"<forward case #{index + 1}>"
        if not isinstance(case, dict):
            failures.append((label, ["case must be an object"]))
            continue
        errors: list[str] = []
        case_id = case.get("id")
        if isinstance(case_id, str) and case_id:
            label = case_id
            if case_id in seen:
                errors.append(f"duplicate case id: {case_id}")
            seen.add(case_id)
        else:
            errors.append("id must be a non-empty string")
        unknown = sorted(set(case) - FORWARD_CASE_KEYS)
        if unknown:
            errors.append("unknown case key(s): " + ", ".join(unknown))
        if not isinstance(case.get("description"), str) or not case["description"]:
            errors.append("description must be a non-empty string")
        if (
            not isinstance(case.get("invocation"), str)
            or case["invocation"] not in INVOCATION_TYPES
        ):
            errors.append(f"invocation must be one of {sorted(INVOCATION_TYPES)}")
        if not isinstance(case.get("input"), str) or not case["input"]:
            errors.append("input must be a non-empty string")
        selected_skills = case.get("selected_skills")
        if selected_skills is not None:
            if not isinstance(selected_skills, list) or not selected_skills or not all(
                isinstance(item, str) and item for item in selected_skills
            ):
                errors.append("selected_skills must be a non-empty array of strings")
            elif len(selected_skills) != len(set(selected_skills)):
                errors.append("selected_skills must not contain duplicates")
            if case.get("invocation") != "ui_selected":
                errors.append("selected_skills requires ui_selected invocation")
        activated = case.get("expected_activation")
        if not isinstance(activated, bool):
            errors.append("expected_activation must be a boolean")
        modes = case.get("expected_modes")
        if not isinstance(modes, list) or not all(
            isinstance(mode, str) and mode in EXPECTED_MODES for mode in modes
        ):
            errors.append(f"expected_modes must contain only {sorted(EXPECTED_MODES)}")
        elif activated is True and not modes:
            errors.append("active forward cases need at least one expected mode")
        elif activated is False and modes:
            errors.append("inactive forward cases must have no expected modes")
        tools = case.get("required_tools")
        if not isinstance(tools, list) or not all(
            isinstance(item, str) and item for item in tools
        ):
            errors.append("required_tools must be an array of strings")
        else:
            invalid_tools = sorted(set(tools) - FORWARD_TOOLS)
            if invalid_tools:
                errors.append("unknown required tool(s): " + ", ".join(invalid_tools))
        if (
            not isinstance(case.get("capability_profile"), str)
            or case["capability_profile"] not in CAPABILITY_PROFILES
        ):
            errors.append(
                f"capability_profile must be one of {sorted(CAPABILITY_PROFILES)}"
            )
        for key in ("risk_areas", "hard_requirements", "quality_focus"):
            errors.extend(validate_string_list(case.get(key), key))
        if isinstance(case.get("risk_areas"), list) and all(
            isinstance(item, str) for item in case["risk_areas"]
        ):
            covered.update(case["risk_areas"])
            if required_areas:
                unknown_areas = sorted(set(case["risk_areas"]) - set(required_areas))
                if unknown_areas:
                    errors.append("unknown risk area(s): " + ", ".join(unknown_areas))
        if (
            isinstance(case.get("quality_focus"), list)
            and all(isinstance(item, str) for item in case["quality_focus"])
            and isinstance(rubric, dict)
            and isinstance(rubric.get("quality_dimensions"), list)
            and all(
                isinstance(item, str) for item in rubric["quality_dimensions"]
            )
        ):
            unknown_focus = sorted(
                set(case["quality_focus"]) - set(rubric.get("quality_dimensions", []))
            )
            if unknown_focus:
                errors.append("unknown quality focus: " + ", ".join(unknown_focus))
        fixtures = case.get("fixtures")
        if not isinstance(fixtures, list) or not all(
            isinstance(item, str) and item for item in fixtures
        ):
            errors.append("fixtures must be an array of non-empty strings")
        else:
            for fixture in fixtures:
                if Path(fixture).is_absolute() or ".." in Path(fixture).parts:
                    errors.append(f"fixture path must stay inside package: {fixture}")
                elif not (package_dir / fixture).is_file():
                    errors.append(f"fixture does not exist: {fixture}")
        if case.get("required_runs") != 2:
            errors.append("required_runs must be exactly 2")
        if errors:
            failures.append((label, errors))
        else:
            cases.append(case)

    missing_areas = sorted(set(required_areas) - covered)
    if missing_areas:
        failures.append(
            ("<required_risk_areas>", ["uncovered area(s): " + ", ".join(missing_areas)])
        )
    return rubric, cases, failures


def load_forward_results(path: Path) -> list[Any]:
    data = load_json_object(path, FORWARD_RESULT_TOP_LEVEL_KEYS, expected_version=1)
    if data.get("evaluation_method") != FORWARD_EVALUATION_METHOD:
        raise DataError(
            f"{path}: evaluation_method must be {FORWARD_EVALUATION_METHOD!r}"
        )
    results = data.get("results")
    if not isinstance(results, list):
        raise DataError(f"{path}: results must be an array")
    return results


def grade_forward_run(
    case: dict[str, Any], run: Any, rubric: dict[str, Any]
) -> tuple[list[str], bool | None]:
    if not isinstance(run, dict):
        return ["run must be an object"], None
    errors: list[str] = []
    unknown = sorted(set(run) - FORWARD_RUN_KEYS)
    if unknown:
        errors.append("unknown run key(s): " + ", ".join(unknown))
    if not isinstance(run.get("run_id"), str) or not run["run_id"]:
        errors.append("run_id must be a non-empty string")
    status = run.get("status")
    if not isinstance(status, str) or status not in FORWARD_RUN_STATUSES:
        errors.append(f"status must be one of {sorted(FORWARD_RUN_STATUSES)}")
        return errors, None
    if status == "blocked":
        return errors + ["run is blocked; release gate is incomplete"], None

    for identity in ("generator_id", "evaluator_id"):
        if not isinstance(run.get(identity), str) or not run[identity]:
            errors.append(f"completed run needs non-empty {identity}")
    if (
        isinstance(run.get("generator_id"), str)
        and run.get("generator_id") == run.get("evaluator_id")
    ):
        errors.append("generator_id and evaluator_id must identify different actors")

    activated = run.get("activated")
    if not isinstance(activated, bool):
        errors.append("completed run needs boolean activated")
    elif activated != case["expected_activation"]:
        errors.append(
            f"activation was {activated}, expected {case['expected_activation']}"
        )
    output = run.get("output")
    if activated is True:
        if not isinstance(output, str):
            errors.append("active completed run needs string output")
        elif not any(
            not check_expected_mode(output, mode) for mode in case["expected_modes"]
        ):
            errors.append(
                "output did not match any expected mode: "
                + ", ".join(case["expected_modes"])
            )
    elif activated is False and output not in (None, ""):
        errors.append("inactive completed run must not contain output")

    hard_failures = run.get("hard_failures")
    if not isinstance(hard_failures, list) or not all(
        isinstance(item, str) and item for item in hard_failures
    ):
        errors.append("hard_failures must be an array of strings")
        hard_failures = []
    unknown_hard = sorted(set(hard_failures) - set(rubric["hard_failures"]))
    if unknown_hard:
        errors.append("unknown hard failure(s): " + ", ".join(unknown_hard))

    requirement_evidence = run.get("requirement_evidence")
    requirements = case["hard_requirements"]
    if not isinstance(requirement_evidence, dict):
        errors.append("requirement_evidence must be an object")
    elif set(requirement_evidence) != set(requirements):
        errors.append("requirement_evidence must cover every hard requirement exactly")
    elif not all(
        isinstance(value, str) and value.strip()
        for value in requirement_evidence.values()
    ):
        errors.append("requirement_evidence values must be non-empty strings")

    scores = run.get("scores")
    dimensions = rubric["quality_dimensions"]
    if not isinstance(scores, dict):
        errors.append("scores must be an object")
        scores = {}
    if set(scores) != set(dimensions):
        errors.append("scores must contain exactly: " + ", ".join(dimensions))
    for dimension, score in scores.items():
        if not isinstance(score, int) or isinstance(score, bool) or not (
            1 <= score <= rubric["score_max"]
        ):
            errors.append(
                f"score {dimension} must be an integer from 1 to {rubric['score_max']}"
            )
    evidence = run.get("evidence")
    if not isinstance(evidence, list) or not evidence or not all(
        isinstance(item, str) and item for item in evidence
    ):
        errors.append("completed run needs non-empty string evidence")
    if errors:
        return errors, None
    quality_pass = all(
        scores[dimension] >= rubric["min_dimension_score"] for dimension in dimensions
    ) and sum(scores.values()) >= rubric["min_total_score"]
    if hard_failures:
        return [], False
    return [], quality_pass


def describe_forward_failure(run: dict[str, Any], index: int) -> str:
    hard_failures = run.get("hard_failures")
    if isinstance(hard_failures, list) and hard_failures:
        return f"run {index}: hard failure(s): {', '.join(hard_failures)}"
    return f"run {index}: failed quality rubric"


def grade_forward_results(
    cases: list[dict[str, Any]], results: list[Any], rubric: dict[str, Any]
) -> list[tuple[str, list[str]]]:
    failures: list[tuple[str, list[str]]] = []
    by_id: dict[str, dict[str, Any]] = {}
    for index, result in enumerate(results):
        label = f"<forward result #{index + 1}>"
        if not isinstance(result, dict):
            failures.append((label, ["result must be an object"]))
            continue
        result_id = result.get("id")
        if not isinstance(result_id, str) or not result_id:
            failures.append((label, ["result needs a non-empty string id"]))
            continue
        if result_id in by_id:
            failures.append((result_id, [f"duplicate result id: {result_id}"]))
            continue
        unknown = sorted(set(result) - FORWARD_RESULT_KEYS)
        if unknown:
            failures.append((result_id, ["unknown result key(s): " + ", ".join(unknown)]))
            continue
        by_id[result_id] = result

    case_ids = {case["id"] for case in cases}
    for case in cases:
        result = by_id.get(case["id"])
        if result is None:
            failures.append((case["id"], ["missing forward result"]))
            continue
        runs = result.get("runs")
        if not isinstance(runs, list) or len(runs) not in (2, 3):
            failures.append((case["id"], ["runs must contain two or three entries"]))
            continue
        run_errors: list[str] = []
        outcomes: list[bool | None] = []
        for index, run in enumerate(runs):
            errors, outcome = grade_forward_run(case, run, rubric)
            run_errors.extend(f"run {index + 1}: {error}" for error in errors)
            outcomes.append(outcome)
        if run_errors:
            failures.append((case["id"], run_errors))
            continue
        hard_failure_runs = [
            (index, run)
            for index, run in enumerate(runs, start=1)
            if isinstance(run.get("hard_failures"), list) and run["hard_failures"]
        ]
        if hard_failure_runs:
            failures.append(
                (
                    case["id"],
                    [describe_forward_failure(run, index) for index, run in hard_failure_runs],
                )
            )
            continue
        run_ids = [run["run_id"] for run in runs]
        if len(run_ids) != len(set(run_ids)):
            failures.append((case["id"], ["run_id values must be unique"]))
            continue
        generator_ids = [run["generator_id"] for run in runs[:2]]
        if len(set(generator_ids)) != 2:
            failures.append(
                (case["id"], ["first two runs need distinct generator_id values"])
            )
            continue
        evaluator_ids = [run["evaluator_id"] for run in runs[:2]]
        if len(set(evaluator_ids)) != 2:
            failures.append(
                (case["id"], ["first two runs need distinct evaluator_id values"])
            )
            continue
        first_two = outcomes[:2]
        if first_two == [True, True]:
            continue
        if first_two == [False, False]:
            failures.append(
                (
                    case["id"],
                    [
                        describe_forward_failure(runs[0], 1),
                        describe_forward_failure(runs[1], 2),
                    ],
                )
            )
            continue
        if len(outcomes) != 3:
            failed_index = 1 if outcomes[0] is False else 2
            failures.append(
                (
                    case["id"],
                    [
                        describe_forward_failure(
                            runs[failed_index - 1], failed_index
                        ),
                        "disagreeing independent runs require a third adjudication",
                    ],
                )
            )
            continue
        if outcomes[2] is not True:
            failures.append(
                (case["id"], [describe_forward_failure(runs[2], 3)])
            )
            continue
        evaluator_ids = [
            run.get("evaluator_id") for run in runs if isinstance(run, dict)
        ]
        if len(evaluator_ids) != 3 or evaluator_ids[2] in evaluator_ids[:2]:
            failures.append(
                (case["id"], ["third adjudication needs a distinct evaluator_id"])
            )

    for unexpected in sorted(set(by_id) - case_ids):
        failures.append((unexpected, ["unexpected forward result id"]))
    return failures


def print_failures(failures: list[tuple[str, list[str]]]) -> None:
    for case_id, errors in failures:
        print(f"FAIL {case_id}", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)


def run_main(args: argparse.Namespace) -> int:
    cases, failures, saved_count = load_and_validate_cases(args.case_file)
    if failures:
        print_failures(failures)
        print(f"{len(failures)} regression case(s) failed", file=sys.stderr)
        return 1

    print(f"PASS {len(cases)} regression case(s); {saved_count} saved output(s)")
    if args.results is not None or args.runner is not None:
        results = (
            load_results(args.results)
            if args.results is not None
            else capture_results(cases, args.runner, args.timeout_seconds)
        )
        failures = grade_results(cases, results)
        if failures:
            print_failures(failures)
            print(f"{len(failures)} captured result(s) failed", file=sys.stderr)
            return 1
        print(f"PASS {len(cases)} captured result(s)")

    if args.forward_cases is not None:
        rubric, forward_cases, failures = load_and_validate_forward_cases(
            args.forward_cases
        )
        if failures:
            print_failures(failures)
            print(f"{len(failures)} forward case check(s) failed", file=sys.stderr)
            return 1
        print(f"PASS {len(forward_cases)} forward case definition(s)")
        if args.forward_results is not None:
            forward_results = load_forward_results(args.forward_results)
            failures = grade_forward_results(forward_cases, forward_results, rubric)
            if failures:
                print_failures(failures)
                print(f"{len(failures)} forward result(s) failed", file=sys.stderr)
                return 1
            print(f"PASS {len(forward_cases)} forward result(s)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Deep Prompt Builder cases and optional model results."
    )
    parser.add_argument("case_file", type=Path)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--results", type=Path)
    source.add_argument("--runner", type=Path)
    parser.add_argument("--forward-cases", type=Path)
    parser.add_argument("--forward-results", type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=60)
    args = parser.parse_args()
    if args.timeout_seconds < 1:
        parser.error("--timeout-seconds must be positive")
    if args.forward_results is not None and args.forward_cases is None:
        parser.error("--forward-results requires --forward-cases")
    try:
        return run_main(args)
    except DataError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
