#!/usr/bin/env python3
"""Validate prd-readiness-check static assets and optional forward-test results.

The default run is deterministic and never calls a model. It validates:

1. user-invocation metadata;
2. saved valid and invalid output-contract samples; and
3. the shape of behavior and invocation scenarios used for forward tests.

Pass ``--outputs`` or ``--invocation-results`` to validate externally captured
fresh-agent results. The checker never calls or substitutes for a model.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


VALID_MODES = {"report", "question"}
VALID_GATES = {"Bloke", "Çalışma Gerekli", "Geçti"}
VALID_IMPACTS = {"Bloklayıcı", "Başlamadan Netleşmeli", "İyileştirme"}
GATE_FOR_IMPACT = {
    "Bloklayıcı": "Bloke",
    "Başlamadan Netleşmeli": "Çalışma Gerekli",
    "İyileştirme": "Geçti",
}
IMPLEMENTATION_DECISION_FOR_GATE = {
    "Bloke": "Güvenli başlangıç mümkün değil",
    "Çalışma Gerekli": "Önce netleştirme gerekli",
    "Geçti": "Hazır",
}

REPORT_HEADINGS = ["## Sonuç", "## Kontrol Özeti", "## Bulgular"]
FINDING_HEADER_RE = re.compile(
    r"(?im)^###\s*(Bloklayıcı|Başlamadan Netleşmeli|İyileştirme)\s*[-–—]\s*.+$"
)
NO_FINDINGS_RE = re.compile(
    r"(?i)\b(?:bulgu\s+(?:yok|bulunmad[ıi]|saptanmad[ıi])|"
    r"(?:ciddi|non-blocking)\s+bulgu\s+(?:yok|bulunmad[ıi]|saptanmad[ıi]))\b"
)
SCORE_PATTERNS = [
    r"(?im)^#{1,4}\s*(skor|score|puan|quality score|kalite puan[ıi])\b",
    r"(?im)^\s*[-*]?\s*(Skor|Score|Puan|Kalite puan[ıi])\s*:",
    r"(?i)\b\d{1,3}\s*/\s*100\b",
]
TOOL_PROVENANCE_PATTERNS = [
    r"(?i)prd üretim skill",
    r"(?i)bu skill ile üretildi",
    r"(?i)generator output",
    r"(?i)prd generator",
    r"(?i)prd automation",
]
PRD_TYPE_PATTERNS = [
    r"(?im)^-\s*PRD T[üu]r[üu]\s*:",
    r"(?i)\bÜrün PRD\b",
    r"(?i)\bÖzellik PRD\b",
    r"(?i)\bKarma PRD\b",
    r"(?i)\bImplementation-ready PRD\b",
]
APPROVAL_PATTERNS = [
    r"(?i)\bPRD\s+onayl[ıi]\b",
    r"(?i)\bPRD\s+onayl[ıi]\s+de[ğg]il\b",
]
VISIBLE_MATRIX_PATTERNS = [
    r"(?im)^##\s*Kalite Matrisi\s*$",
    r"(?im)^\|\s*Alan\s*\|\s*Durum\s*\|",
]
FORBIDDEN_REPORT_LABELS = ["Örnek PRD metni", "- Aksiyon:", "- Etki:"]


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"{path}: top-level JSON value must be an object")
    return value


def as_text(value: Any, label: str) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return "\n".join(value)
    raise ValueError(f"{label} must be a string or an array of strings")


def parse_gate(output: str) -> str | None:
    match = re.search(
        r"(?im)^-\s*Kalite Kap[ıi]s[ıi]\s*:\s*(Bloke|Çalışma Gerekli|Geçti)\s*$",
        output,
    )
    return match.group(1) if match else None


def finding_blocks(output: str) -> list[str]:
    findings_heading = re.search(r"(?m)^## Bulgular\s*$", output)
    if not findings_heading:
        return []
    findings_text = output[findings_heading.end() :]
    matches = list(FINDING_HEADER_RE.finditer(findings_text))
    blocks: list[str] = []
    for index, match in enumerate(matches):
        end = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else len(findings_text)
        )
        blocks.append(findings_text[match.start() : end].strip())
    return blocks


def finding_impacts(output: str) -> list[str]:
    impacts: list[str] = []
    for block in finding_blocks(output):
        match = FINDING_HEADER_RE.search(block)
        if not match:
            continue
        impact = match.group(1)
        if impact not in impacts:
            impacts.append(impact)
    return impacts


def finding_types(output: str) -> list[str]:
    result: list[str] = []
    for block in finding_blocks(output):
        match = re.search(r"(?im)^-\s*T[üu]r\s*:\s*(\S(?:.*\S)?)\s*$", block)
        if match:
            value = match.group(1)
            if value not in result:
                result.append(value)
    return result


def expected_gate_for_impacts(impacts: list[str]) -> str:
    if "Bloklayıcı" in impacts:
        return GATE_FOR_IMPACT["Bloklayıcı"]
    if "Başlamadan Netleşmeli" in impacts:
        return GATE_FOR_IMPACT["Başlamadan Netleşmeli"]
    return GATE_FOR_IMPACT["İyileştirme"]


def section_text(output: str, heading: str) -> str:
    match = re.search(rf"(?im)^###\s*{re.escape(heading)}\s*$", output)
    if not match:
        return ""
    start = match.end()
    next_heading = re.search(r"(?m)^#{2,3}\s+", output[start:])
    end = start + next_heading.start() if next_heading else len(output)
    return output[start:end].strip()


def list_item_count(text: str) -> int:
    return len(re.findall(r"(?m)^\s*(?:\d+\.|-)\s+\S", text))


def validate_finding_blocks(output: str) -> list[str]:
    errors: list[str] = []
    required = [
        ("Tür", r"(?im)^-\s*T[üu]r\s*:\s*\S(?:.*\S)?$"),
        (
            "Ciddiyet",
            r"(?im)^-\s*Ciddiyet\s*:\s*(Bloklayıcı|Başlamadan Netleşmeli|İyileştirme)\s*$",
        ),
        ("Kategori", r"(?im)^-\s*Kategori\s*:\s*\S(?:.*\S)?$"),
        ("Kanıt", r"(?im)^-\s*Kan[ıi]t\s*:\s*\S(?:.*\S)?$"),
        ("Neden önemli", r"(?im)^-\s*Neden [öo]nemli\s*:\s*\S(?:.*\S)?$"),
        (
            "Karar verilmesi gereken konu",
            r"(?im)^-\s*Karar verilmesi gereken konu\s*:\s*\S(?:.*\S)?$",
        ),
    ]
    for number, block in enumerate(finding_blocks(output), start=1):
        for label, pattern in required:
            matches = re.findall(pattern, block)
            if not matches:
                errors.append(f"finding #{number} missing valid '{label}' field")
            elif len(matches) > 1:
                errors.append(f"finding #{number} repeats '{label}' field")
        header_impact = FINDING_HEADER_RE.search(block)
        field_impact = re.search(
            r"(?im)^-\s*Ciddiyet\s*:\s*(Bloklayıcı|Başlamadan Netleşmeli|İyileştirme)\s*$",
            block,
        )
        if header_impact and field_impact and header_impact.group(1) != field_impact.group(1):
            errors.append(f"finding #{number} header and Ciddiyet do not match")
        topic = re.search(r"(?im)^-\s*Karar verilmesi gereken konu\s*:\s*(.+)$", block)
        if topic and "?" in topic.group(1):
            errors.append(f"finding #{number} decision topic must not ask a question")
    return errors


def validate_report_contract(output: str) -> list[str]:
    errors: list[str] = []
    positions: list[int] = []
    for heading in REPORT_HEADINGS:
        matches = list(re.finditer(rf"(?m)^{re.escape(heading)}\s*$", output))
        position = matches[0].start() if matches else -1
        if not matches:
            errors.append(f"missing report heading: {heading}")
        elif len(matches) > 1:
            errors.append(f"duplicate report heading: {heading}")
        positions.append(position)
    if all(position >= 0 for position in positions) and positions != sorted(positions):
        errors.append("report headings must be in Sonuç -> Kontrol Özeti -> Bulgular order")

    gate = parse_gate(output)
    if gate not in VALID_GATES:
        errors.append("missing or invalid Kalite Kapısı line")
    else:
        expected_decision = IMPLEMENTATION_DECISION_FOR_GATE[gate]
        if not re.search(
            rf"(?im)^-\s*Implementation karar[ıi]\s*:\s*{re.escape(expected_decision)}\s*$",
            output,
        ):
            errors.append(
                f"gate {gate!r} requires Implementation kararı {expected_decision!r}"
            )

    if not re.search(r"(?im)^-\s*K[ıi]sa De[ğg]erlendirme\s*:\s*\S(?:.*\S)?$", output):
        errors.append("missing Kısa Değerlendirme line")

    summary_lines = [
        r"(?im)^-\s*G[üu][çc]l[üu] alanlar\s*:\s*\S(?:.*\S)?$",
        r"(?im)^-\s*Karar[ıi] etkileyen zay[ıi]fl[ıi]klar\s*:\s*\S(?:.*\S)?$",
        r"(?im)^-\s*Ba[ğg]lama g[öo]re incelenen alanlar\s*:\s*\S(?:.*\S)?$",
    ]
    for pattern in summary_lines:
        if not re.search(pattern, output):
            errors.append(f"missing control-summary line matching {pattern!r}")

    impacts = finding_impacts(output)
    expected_gate = expected_gate_for_impacts(impacts)
    if gate and gate != expected_gate:
        errors.append(f"gate {gate!r} inconsistent with finding impacts; expected {expected_gate!r}")

    start_heading = re.search(r"(?m)^### Başlamak için şart\s*$", output)
    start_count = list_item_count(section_text(output, "Başlamak için şart"))
    serious_count = sum(
        1
        for block in finding_blocks(output)
        if (match := FINDING_HEADER_RE.search(block))
        and match.group(1) in {"Bloklayıcı", "Başlamadan Netleşmeli"}
    )
    if gate in {"Bloke", "Çalışma Gerekli"} and start_count == 0:
        errors.append("non-passing report requires a non-empty Başlamak için şart list")
    if gate == "Geçti" and start_heading:
        errors.append("passing report must not include Başlamak için şart")
    if start_count and start_count != serious_count:
        errors.append("Başlamak için şart must contain one item per serious finding")

    improvement_count = sum(
        1
        for block in finding_blocks(output)
        if (match := FINDING_HEADER_RE.search(block)) and match.group(1) == "İyileştirme"
    )
    improve_heading = re.search(r"(?m)^### Sonra iyileştir\s*$", output)
    improve_items = list_item_count(section_text(output, "Sonra iyileştir"))
    if "İyileştirme" in impacts and improve_items == 0:
        errors.append("report with non-blocking findings requires Sonra iyileştir items")
    if improve_items > 3:
        errors.append("Sonra iyileştir must contain at most 3 items")
    if improvement_count > 3:
        errors.append("report must contain at most 3 non-blocking finding groups")
    if improve_heading and improvement_count == 0:
        errors.append("Sonra iyileştir requires a non-blocking finding")
    if improve_items and improve_items != improvement_count:
        errors.append("Sonra iyileştir must contain one item per non-blocking finding")

    findings_heading = re.search(r"(?m)^## Bulgular\s*$", output)
    if findings_heading:
        findings_body = output[findings_heading.end() :].strip()
        if not findings_body:
            errors.append(
                "Bulgular section must contain findings or an explicit no-findings statement"
            )
        elif not finding_blocks(output) and not NO_FINDINGS_RE.search(findings_body):
            errors.append("finding-free report requires an explicit no-findings statement")
        if len(FINDING_HEADER_RE.findall(output)) != len(finding_blocks(output)):
            errors.append("finding headings must appear only inside the Bulgular section")

    policy_surface = re.sub(r"(?im)^-\s*Kan[ıi]t\s*:.*$", "", output)
    for label in FORBIDDEN_REPORT_LABELS:
        if label.casefold() in policy_surface.casefold():
            errors.append(f"forbidden legacy report label present: {label!r}")
    for pattern in SCORE_PATTERNS + TOOL_PROVENANCE_PATTERNS + PRD_TYPE_PATTERNS:
        if re.search(pattern, policy_surface):
            errors.append(f"forbidden report pattern matched: {pattern}")
    for pattern in APPROVAL_PATTERNS:
        if re.search(pattern, policy_surface):
            errors.append(f"report must not claim PRD approval: {pattern}")
    for pattern in VISIBLE_MATRIX_PATTERNS:
        if re.search(pattern, policy_surface):
            errors.append(f"report must not show a fixed quality matrix: {pattern}")
    if "?" in policy_surface:
        errors.append("report must not ask questions outside source evidence")
    errors.extend(validate_finding_blocks(output))
    return errors


def validate_question_contract(output: str) -> list[str]:
    errors: list[str] = []
    if output.count("?") != 1:
        errors.append("question output must contain exactly one question mark")
    for heading in REPORT_HEADINGS:
        if heading in output:
            errors.append(f"question output must not contain {heading!r}")
    lines = [line for line in output.splitlines() if line.strip()]
    if len(lines) != 1 or not lines[0].strip().endswith("?"):
        errors.append("question output must be one non-empty line ending in a question mark")
    return errors


def validate_expected(output: str, expected: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    mode = expected.get("mode")
    if mode == "report":
        errors.extend(validate_report_contract(output))
    elif mode == "question":
        errors.extend(validate_question_contract(output))
    else:
        errors.append(f"invalid expected mode: {mode!r}")
        return errors

    gate = expected.get("gate")
    if gate is not None and parse_gate(output) != gate:
        errors.append(f"expected gate {gate!r}, got {parse_gate(output)!r}")

    impacts = expected.get("impacts")
    if impacts is not None and sorted(finding_impacts(output)) != sorted(impacts):
        errors.append(
            f"expected impacts {sorted(impacts)!r}, got {sorted(finding_impacts(output))!r}"
        )

    types = expected.get("types")
    if types is not None:
        actual_types = [value.casefold() for value in finding_types(output)]
        for expected_type in types:
            if expected_type.casefold() not in actual_types:
                errors.append(f"missing expected finding type: {expected_type!r}")

    lower_output = output.casefold()
    for value in expected.get("required_contains_i", []):
        if value.casefold() not in lower_output:
            errors.append(f"missing required text: {value!r}")
    for value in expected.get("forbidden_contains_i", []):
        if value.casefold() in lower_output:
            errors.append(f"forbidden text present: {value!r}")

    count = len(finding_blocks(output))
    minimum = expected.get("min_findings")
    maximum = expected.get("max_findings")
    if isinstance(minimum, int) and count < minimum:
        errors.append(f"expected at least {minimum} findings, got {count}")
    if isinstance(maximum, int) and count > maximum:
        errors.append(f"expected at most {maximum} findings, got {count}")
    return errors


def validate_expected_shape(expected: Any, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(expected, dict):
        return [f"{label}: expected must be an object"]
    mode = expected.get("mode")
    if mode not in VALID_MODES:
        errors.append(f"{label}: mode must be one of {sorted(VALID_MODES)!r}")
    gate = expected.get("gate")
    if gate is not None and gate not in VALID_GATES:
        errors.append(f"{label}: invalid gate {gate!r}")
    impacts = expected.get("impacts")
    if impacts is not None and (
        not isinstance(impacts, list) or not all(item in VALID_IMPACTS for item in impacts)
    ):
        errors.append(f"{label}: impacts must contain only valid impact labels")
    if (
        mode == "report"
        and gate in VALID_GATES
        and isinstance(impacts, list)
        and all(item in VALID_IMPACTS for item in impacts)
        and gate != expected_gate_for_impacts(impacts)
    ):
        errors.append(f"{label}: gate is inconsistent with expected impacts")
    for key in ("types", "required_contains_i", "forbidden_contains_i"):
        value = expected.get(key)
        if value is not None and (
            not isinstance(value, list)
            or not all(isinstance(item, str) and item for item in value)
        ):
            errors.append(f"{label}: {key} must be an array of non-empty strings")
    for key in ("min_findings", "max_findings"):
        value = expected.get(key)
        if value is not None and (not isinstance(value, int) or isinstance(value, bool)):
            errors.append(f"{label}: {key} must be an integer")
        elif isinstance(value, int) and value < 0:
            errors.append(f"{label}: {key} must be non-negative")
    minimum = expected.get("min_findings")
    maximum = expected.get("max_findings")
    if isinstance(minimum, int) and isinstance(maximum, int) and minimum > maximum:
        errors.append(f"{label}: min_findings must not exceed max_findings")
    if mode == "question" and any(
        key in expected
        for key in ("gate", "impacts", "types", "min_findings", "max_findings")
    ):
        errors.append(f"{label}: question expectations cannot declare report properties")
    if mode == "report" and gate is None:
        errors.append(f"{label}: report expectations require a gate")
    return errors


def validate_input_shape(value: Any, label: str) -> list[str]:
    if not isinstance(value, dict):
        return [f"{label}: input must be an object"]
    errors: list[str] = []
    try:
        as_text(value.get("primary", ""), f"{label}.input.primary")
    except ValueError as exc:
        errors.append(str(exc))
    linked = value.get("linked_sources", [])
    if not isinstance(linked, list):
        errors.append(f"{label}: linked_sources must be an array")
    else:
        for index, source in enumerate(linked, start=1):
            if not isinstance(source, dict):
                errors.append(f"{label}: linked source #{index} must be an object")
                continue
            if not isinstance(source.get("name"), str) or not source.get("name"):
                errors.append(f"{label}: linked source #{index} needs a name")
            try:
                as_text(source.get("content", ""), f"{label}.linked_sources[{index}].content")
            except ValueError as exc:
                errors.append(str(exc))
    return errors


def validate_invocation_case(value: Any, label: str) -> list[str]:
    if not isinstance(value, dict):
        return [f"{label}: invocation case must be an object"]
    errors: list[str] = []
    if not isinstance(value.get("id"), str) or not value.get("id"):
        errors.append(f"{label}: id must be a non-empty string")
    if not isinstance(value.get("prompt"), str) or not value.get("prompt"):
        errors.append(f"{label}: prompt must be a non-empty string")
    if not isinstance(value.get("expected_invoked"), bool):
        errors.append(f"{label}: expected_invoked must be a boolean")
    return errors


def validate_static_invocation_surfaces(fixture_file: Path) -> list[str]:
    """Check only deterministic package declarations, not model invocation behavior."""
    skill_root = fixture_file.resolve().parent.parent
    skill_file = skill_root / "SKILL.md"
    agent_file = skill_root / "agents" / "openai.yaml"
    errors: list[str] = []
    if not skill_file.is_file():
        return [f"missing skill file: {skill_file}"]
    skill_text = skill_file.read_text(encoding="utf-8")
    frontmatter = skill_text.split("---", 2)[1] if skill_text.startswith("---") else ""
    if not re.search(r"(?m)^name:\s*prd-readiness-check\s*$", frontmatter):
        errors.append("SKILL.md frontmatter must declare name prd-readiness-check")
    if not re.search(r"(?m)^disable-model-invocation:\s*true\s*$", frontmatter):
        errors.append("SKILL.md must disable model invocation")
    description = re.search(r"(?m)^description:\s*(.+)$", frontmatter)
    if not description or "$prd-readiness-check" in description.group(1):
        errors.append("user-invoked skill description must be a human-facing summary")
    if "Yalnız kullanıcı açıkça `$prd-readiness-check` çağırdığında kullan." not in skill_text:
        errors.append("SKILL.md runtime contract must require explicit invocation")
    if not agent_file.is_file():
        errors.append(f"missing agent metadata: {agent_file}")
    else:
        agent_text = agent_file.read_text(encoding="utf-8")
        if not re.search(r"(?m)^\s*allow_implicit_invocation:\s*false\s*$", agent_text):
            errors.append("agent metadata must disable implicit invocation")
        if not re.search(r'(?m)^\s*default_prompt:\s*.*\$prd-readiness-check', agent_text):
            errors.append("agent default prompt must explicitly invoke $prd-readiness-check")
    return errors


def load_invocation_results(path: Path) -> dict[str, bool]:
    data = read_json(path)
    entries = data.get("results")
    if not isinstance(entries, list):
        raise SystemExit(f"{path}: results must be an array")
    result: dict[str, bool] = {}
    for entry in entries:
        if (
            not isinstance(entry, dict)
            or not isinstance(entry.get("id"), str)
            or not isinstance(entry.get("invoked"), bool)
        ):
            raise SystemExit(f"{path}: each result needs string id and boolean invoked")
        if entry["id"] in result:
            raise SystemExit(f"{path}: duplicate invocation result id {entry['id']!r}")
        result[entry["id"]] = entry["invoked"]
    return result


def load_output_overrides(path: Path) -> dict[str, str]:
    data = read_json(path)
    if "outputs" in data:
        entries = data["outputs"]
        if not isinstance(entries, list):
            raise SystemExit(f"{path}: outputs must be an array")
        result: dict[str, str] = {}
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                raise SystemExit(f"{path}: each output entry needs string id and output")
            if entry["id"] in result:
                raise SystemExit(f"{path}: duplicate output id {entry['id']!r}")
            result[entry["id"]] = as_text(entry.get("output"), f"{entry['id']}.output")
        return result
    result = {}
    for fixture_id, output in data.items():
        result[fixture_id] = as_text(output, f"{fixture_id}.output")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate prd-readiness-check contract samples and optional forward-test outputs."
    )
    parser.add_argument("fixture_file", type=Path)
    parser.add_argument(
        "--outputs",
        type=Path,
        help="JSON file containing real outputs keyed by behavior-case id",
    )
    parser.add_argument(
        "--require-all",
        action="store_true",
        help="Require supplied output and invocation result files to cover every case",
    )
    parser.add_argument(
        "--invocation-results",
        type=Path,
        help="JSON file containing fresh-agent invocation observations",
    )
    args = parser.parse_args()

    data = read_json(args.fixture_file)
    if data.get("version") != 3:
        raise SystemExit(f"{args.fixture_file}: expected version 3")

    contract_cases = data.get("contract_cases")
    invalid_contract_cases = data.get("invalid_contract_cases")
    behavior_cases = data.get("behavior_cases")
    invocation_cases = data.get("invocation_cases")
    if not isinstance(contract_cases, list) or not contract_cases:
        raise SystemExit(f"{args.fixture_file}: contract_cases must be a non-empty array")
    if not isinstance(invalid_contract_cases, list) or not invalid_contract_cases:
        raise SystemExit(
            f"{args.fixture_file}: invalid_contract_cases must be a non-empty array"
        )
    if not isinstance(behavior_cases, list) or not behavior_cases:
        raise SystemExit(f"{args.fixture_file}: behavior_cases must be a non-empty array")
    if not isinstance(invocation_cases, list) or not invocation_cases:
        raise SystemExit(f"{args.fixture_file}: invocation_cases must be a non-empty array")

    failures: list[tuple[str, list[str]]] = []
    static_errors = validate_static_invocation_surfaces(args.fixture_file)
    if static_errors:
        failures.append(("<invocation surfaces>", static_errors))
    seen_ids: set[str] = set()
    behavior_by_id: dict[str, dict[str, Any]] = {}

    for case in contract_cases:
        if not isinstance(case, dict):
            failures.append(("<invalid contract case>", ["case must be an object"]))
            continue
        fixture_id = case.get("id")
        label = fixture_id if isinstance(fixture_id, str) else "<missing contract id>"
        errors: list[str] = []
        if not isinstance(fixture_id, str) or not fixture_id:
            errors.append("id must be a non-empty string")
        elif fixture_id in seen_ids:
            errors.append("duplicate id")
        else:
            seen_ids.add(fixture_id)
        errors.extend(validate_expected_shape(case.get("expected"), label))
        try:
            output = as_text(case.get("output"), f"{label}.output")
        except ValueError as exc:
            errors.append(str(exc))
            output = ""
        if not errors:
            errors.extend(validate_expected(output, case["expected"]))
        if errors:
            failures.append((label, errors))

    for case in invalid_contract_cases:
        if not isinstance(case, dict):
            failures.append(("<invalid invalid-contract case>", ["case must be an object"]))
            continue
        fixture_id = case.get("id")
        label = fixture_id if isinstance(fixture_id, str) else "<missing invalid-contract id>"
        errors: list[str] = []
        if not isinstance(fixture_id, str) or not fixture_id:
            errors.append("id must be a non-empty string")
        elif fixture_id in seen_ids:
            errors.append("duplicate id")
        else:
            seen_ids.add(fixture_id)
        try:
            output = as_text(case.get("output"), f"{label}.output")
        except ValueError as exc:
            errors.append(str(exc))
            output = ""
        expected_errors = case.get("expected_errors_i")
        if not isinstance(expected_errors, list) or not expected_errors or not all(
            isinstance(item, str) and item for item in expected_errors
        ):
            errors.append("expected_errors_i must be a non-empty array of strings")
        if not errors:
            actual_errors = validate_report_contract(output)
            if not actual_errors:
                errors.append("invalid contract sample was accepted")
            else:
                actual_text = "\n".join(actual_errors).casefold()
                for expected_error in expected_errors:
                    if expected_error.casefold() not in actual_text:
                        errors.append(f"missing expected checker error: {expected_error!r}")
        if errors:
            failures.append((label, errors))

    for case in behavior_cases:
        if not isinstance(case, dict):
            failures.append(("<invalid behavior case>", ["case must be an object"]))
            continue
        fixture_id = case.get("id")
        label = fixture_id if isinstance(fixture_id, str) else "<missing behavior id>"
        errors: list[str] = []
        if not isinstance(fixture_id, str) or not fixture_id:
            errors.append("id must be a non-empty string")
        elif fixture_id in seen_ids:
            errors.append("duplicate id")
        else:
            seen_ids.add(fixture_id)
            behavior_by_id[fixture_id] = case
        if not isinstance(case.get("description"), str) or not case.get("description"):
            errors.append("description must be a non-empty string")
        errors.extend(validate_input_shape(case.get("input"), label))
        errors.extend(validate_expected_shape(case.get("expected"), label))
        if errors:
            failures.append((label, errors))

    invocation_by_id: dict[str, dict[str, Any]] = {}
    for case in invocation_cases:
        fixture_id = case.get("id") if isinstance(case, dict) else None
        label = fixture_id if isinstance(fixture_id, str) else "<invalid invocation case>"
        errors = validate_invocation_case(case, label)
        if isinstance(fixture_id, str):
            if fixture_id in seen_ids:
                errors.append("duplicate id")
            else:
                seen_ids.add(fixture_id)
                invocation_by_id[fixture_id] = case
        if errors:
            failures.append((label, errors))

    checked_outputs = 0
    if args.outputs:
        overrides = load_output_overrides(args.outputs)
        unknown = sorted(set(overrides) - set(behavior_by_id))
        if unknown:
            failures.append(("<outputs>", [f"unknown behavior-case ids: {', '.join(unknown)}"]))
        if args.require_all:
            missing = sorted(set(behavior_by_id) - set(overrides))
            if missing:
                failures.append(("<outputs>", [f"missing behavior-case ids: {', '.join(missing)}"]))
        for fixture_id, output in overrides.items():
            case = behavior_by_id.get(fixture_id)
            if case is None:
                continue
            checked_outputs += 1
            errors = validate_expected(output, case["expected"])
            if errors:
                failures.append((fixture_id, errors))

    checked_invocations = 0
    if args.invocation_results:
        results = load_invocation_results(args.invocation_results)
        unknown = sorted(set(results) - set(invocation_by_id))
        if unknown:
            failures.append(
                ("<invocation results>", [f"unknown invocation-case ids: {', '.join(unknown)}"])
            )
        if args.require_all:
            missing = sorted(set(invocation_by_id) - set(results))
            if missing:
                failures.append(
                    (
                        "<invocation results>",
                        [f"missing invocation-case ids: {', '.join(missing)}"],
                    )
                )
        for fixture_id, invoked in results.items():
            case = invocation_by_id.get(fixture_id)
            if case is None:
                continue
            checked_invocations += 1
            if invoked != case["expected_invoked"]:
                failures.append(
                    (
                        fixture_id,
                        [
                            f"expected invoked={case['expected_invoked']!r}, got {invoked!r}"
                        ],
                    )
                )

    if failures:
        for fixture_id, errors in failures:
            print(f"FAIL {fixture_id}", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        print(f"{len(failures)} case(s) failed", file=sys.stderr)
        return 1

    print(
        "PASS "
        "invocation surfaces, "
        f"{len(contract_cases)} contract sample(s), "
        f"{len(invalid_contract_cases)} rejected contract sample(s), "
        f"{len(behavior_cases)} behavior scenario(s), "
        f"{len(invocation_cases)} invocation scenario(s), "
        f"{checked_outputs} external output(s), "
        f"{checked_invocations} invocation observation(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
