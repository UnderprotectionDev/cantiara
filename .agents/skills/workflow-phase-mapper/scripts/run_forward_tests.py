#!/usr/bin/env python3
"""Run generalized raw-source workflow mapping cases in isolated Codex sessions."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = SKILL_ROOT / "tests/forward-source-cases.json"
PHASE_KINDS = (
    "product-feature",
    "cross-cutting-feature",
    "observable-system-capability",
)
OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "phases": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "phaseKind": {"type": "string", "enum": list(PHASE_KINDS)},
                    "subphases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "id": {"type": "string"},
                                "name": {"type": "string"},
                            },
                            "required": ["id", "name"],
                        },
                    },
                },
                "required": ["id", "name", "phaseKind", "subphases"],
            },
        },
        "phaseOrder": {"type": "array", "items": {"type": "string"}},
        "distributedBehaviors": {"type": "array", "items": {"type": "string"}},
        "rationale": {"type": "string"},
    },
    "required": ["phases", "phaseOrder", "distributedBehaviors", "rationale"],
}


def normalize_id(value: str) -> str:
    translations = str.maketrans(
        {"ı": "i", "İ": "I", "ş": "s", "Ş": "S", "ğ": "g", "Ğ": "G"}
    )
    ascii_value = unicodedata.normalize("NFKD", value.translate(translations))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def distinctive_tokens(value: str) -> set[str]:
    stopwords = {
        "and",
        "area",
        "capability",
        "feature",
        "library",
        "lifecycle",
        "main",
        "management",
        "phase",
        "record",
        "system",
        "the",
        "workflow",
    }
    return {
        _semantic_stem(token)
        for token in normalize_id(value).split("-")
        if token not in stopwords
    }


def _semantic_stem(token: str) -> str:
    irregular = {
        "creation": "creat",
        "consumption": "consum",
        "receipt": "receiv",
    }
    if token in irregular:
        return irregular[token]
    for suffix in ("ing", "ance", "ence", "ation", "ment", "ed", "ion"):
        if token.endswith(suffix) and len(token) > len(suffix) + 3:
            token = token[: -len(suffix)]
            break
    if token.endswith("e") and len(token) > 4:
        token = token[:-1]
    return token


def concept_matches(expected: str, observed: str) -> bool:
    return bool(distinctive_tokens(expected) & distinctive_tokens(observed))


def forbidden_concept_matches(expected: str, observed: str) -> bool:
    expected_tokens = distinctive_tokens(expected)
    return bool(expected_tokens) and expected_tokens <= distinctive_tokens(observed)


def _duplicates(values: list[str]) -> bool:
    normalized = [normalize_id(value) for value in values]
    return len(normalized) != len(set(normalized))


def _find_phase(expected_id: str, phases: list[dict[str, Any]]) -> dict[str, Any] | None:
    matches = [phase for phase in phases if concept_matches(expected_id, phase["id"])]
    return matches[0] if len(matches) == 1 else None


def validate_output(case: dict[str, Any], output: dict[str, Any]) -> list[str]:
    expected = case["expected"]
    expected_phases = expected["phases"]
    observed_phases = output["phases"]
    observed_ids = [phase["id"] for phase in observed_phases]
    errors: list[str] = []

    if _duplicates(observed_ids):
        errors.append("duplicate identifiers in phases")
    if _duplicates(output["phaseOrder"]):
        errors.append("duplicate identifiers in phaseOrder")
    if _duplicates(output["distributedBehaviors"]):
        errors.append("duplicate identifiers in distributedBehaviors")

    expected_ids = [phase["id"] for phase in expected_phases]
    missing = [
        expected_id
        for expected_id in expected_ids
        if _find_phase(expected_id, observed_phases) is None
    ]
    unexpected = [
        observed
        for observed in observed_ids
        if not any(concept_matches(expected_id, observed) for expected_id in expected_ids)
    ]
    if missing:
        errors.append(f"missing main phases: {missing}")
    if unexpected:
        errors.append(f"unexpected main phases: {unexpected}")

    forbidden = expected.get("forbiddenMainPhases", [])
    present_forbidden = [
        item
        for item in forbidden
        if any(forbidden_concept_matches(item, value) for value in observed_ids)
    ]
    if present_forbidden:
        errors.append(f"forbidden main phases: {present_forbidden}")

    for expected_phase in expected_phases:
        observed_phase = _find_phase(expected_phase["id"], observed_phases)
        if observed_phase is None:
            continue
        if observed_phase["phaseKind"] != expected_phase["phaseKind"]:
            errors.append(
                f"phase kind mismatch for {expected_phase['id']}: "
                f"expected {expected_phase['phaseKind']}, "
                f"got {observed_phase['phaseKind']}"
            )
        expected_subphases = expected_phase.get("subphases", [])
        observed_subphase_ids = [item["id"] for item in observed_phase["subphases"]]
        observed_subphase_labels = [
            (item["id"], item["name"]) for item in observed_phase["subphases"]
        ]
        if _duplicates(observed_subphase_ids):
            errors.append(f"duplicate subphase identifiers in {expected_phase['id']}")
        missing_subphases = [
            item
            for item in expected_subphases
            if not any(
                concept_matches(item, observed_id)
                or concept_matches(item, observed_name)
                for observed_id, observed_name in observed_subphase_labels
            )
        ]
        unexpected_subphases = [
            observed_id
            for observed_id, observed_name in observed_subphase_labels
            if not any(
                concept_matches(value, observed_id)
                or concept_matches(value, observed_name)
                for value in expected_subphases
            )
        ]
        if missing_subphases:
            errors.append(
                f"missing subphases in {expected_phase['id']}: {missing_subphases}"
            )
        if expected_phase.get("exactSubphases", True) and unexpected_subphases:
            errors.append(
                f"unexpected subphases in {expected_phase['id']}: "
                f"{unexpected_subphases}"
            )

    required_behaviors = expected.get("distributedBehaviors", [])
    missing_behaviors = [
        item
        for item in required_behaviors
        if not any(
            concept_matches(item, value)
            for value in output["distributedBehaviors"]
        )
    ]
    if missing_behaviors:
        errors.append(f"missing distributed behaviors: {missing_behaviors}")

    required_order = expected.get("requiredOrder", expected_ids)
    observed_order = [
        expected_id
        for value in output["phaseOrder"]
        for expected_id in required_order
        if concept_matches(expected_id, value)
    ]
    if observed_order != required_order:
        errors.append(
            f"phase order mismatch: expected {required_order}, got {observed_order}"
        )
    return errors


def prepare_isolated_skill(workdir: Path) -> Path:
    isolated_root = workdir / "workflow-phase-mapper"
    isolated_root.mkdir()
    shutil.copy2(SKILL_ROOT / "SKILL.md", isolated_root / "SKILL.md")
    shutil.copytree(SKILL_ROOT / "references", isolated_root / "references")
    return isolated_root


def build_prompt(case: dict[str, Any], skill_root: Path) -> str:
    return f"""Use the workflow-phase-mapper skill at {skill_root / 'SKILL.md'}.
Read that skill and only the references it routes for phase-boundary analysis. Do not inspect
tests, regression fixtures, prior outputs, or files outside the two source documents below.
Analyze the project sources without modifying any file. Return only the requested JSON object.

Use concise lowercase ASCII kebab-case identifiers. `phases` must contain the complete main
phase set. For every phase assign one allowed diagnostic `phaseKind`, and put each meaningful
feature-owned lifecycle or staged behavior in that phase's `subphases`. Keep shared helpers,
validation, models, and technical mechanisms out of the phase hierarchy and summarize them in
`distributedBehaviors` only when relevant. Put phase identifiers in actual prerequisite order
in `phaseOrder`. Do not invent decorative subphases for an atomic feature.

PRD source:
{case['sourcePackage']['prd']}

Tech-stack source:
{case['sourcePackage']['techStack']}
"""


def run_case(
    case: dict[str, Any],
    *,
    codex_bin: str,
    model: str | None,
    timeout: int,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="workflow-forward-") as directory:
        workdir = Path(directory)
        isolated_skill = prepare_isolated_skill(workdir)
        schema_path = workdir / "output-schema.json"
        output_path = workdir / "output.json"
        schema_path.write_text(json.dumps(OUTPUT_SCHEMA), encoding="utf-8")
        command = [
            codex_bin,
            "exec",
            "--ephemeral",
            "--ignore-user-config",
            "--ignore-rules",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--cd",
            str(workdir),
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(output_path),
            "-",
        ]
        if model:
            command[2:2] = ["--model", model]
        result = subprocess.run(
            command,
            input=build_prompt(case, isolated_skill),
            text=True,
            capture_output=True,
            timeout=timeout,
            env=os.environ.copy(),
        )
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        return json.loads(output_path.read_text(encoding="utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run generalized source-to-hierarchy cases in fresh Codex sessions."
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--case", action="append", dest="case_ids")
    parser.add_argument("--codex-bin", default=os.environ.get("CODEX_BIN", "codex"))
    parser.add_argument("--model")
    parser.add_argument("--timeout", type=int, default=600)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    selected = [
        case
        for case in manifest["cases"]
        if not args.case_ids or case["id"] in set(args.case_ids)
    ]
    missing_ids = set(args.case_ids or []) - {case["id"] for case in selected}
    if missing_ids:
        raise SystemExit(f"Unknown case ids: {sorted(missing_ids)}")

    failed = False
    for case in selected:
        output = run_case(
            case,
            codex_bin=args.codex_bin,
            model=args.model,
            timeout=args.timeout,
        )
        errors = validate_output(case, output)
        print(f"{'PASS' if not errors else 'FAIL'} {case['id']}", flush=True)
        for error in errors:
            print(f"  - {error}", flush=True)
        if errors:
            print(json.dumps(output, ensure_ascii=False, indent=2), flush=True)
        failed = failed or bool(errors)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
