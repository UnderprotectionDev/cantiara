from __future__ import annotations

import re
from pathlib import Path
from typing import Any


MARKER_PATTERN = re.compile(r"<!--\s*workflow-phase-mapper\b", re.IGNORECASE)
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
ALLOWED_LEVEL_TWO = (
    "Alt Fazlar",
    "Tamamlanma Ölçütleri",
    "Kapsam Sınırları",
)
BANNED_HEADINGS = {
    "Yetkili kaynaklar",
    "Yetkili kaynaklar ve mevcut durum",
    "Doğrudan girişler",
    "Doğrudan önkoşul",
    "Doğrudan önkoşullar",
    "Girdiler ve önkoşullar",
    "Sahip olunan gereksinimler",
}
BANNED_LABELS = (
    "Tetikleyici/amaç",
    "Girdiler",
    "Olumlu sonuç",
    "Olumsuz sonuç",
    "Auth/sahiplik",
    "Yetki/sahiplik",
    "Hata",
    "Hata ve recovery",
    "Recovery",
)


class PhaseContextContractError(ValueError):
    """Raised when a final phase-context document violates its visible contract."""


def _nonempty_section(lines: list[str], start: int, end: int, label: str) -> None:
    if not any(line.strip() and not line.startswith("#") for line in lines[start:end]):
        raise PhaseContextContractError(f"{label} must contain visible content")


def parse_phase_context(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise PhaseContextContractError(f"phase context does not exist: {path}")
    document = path.read_text(encoding="utf-8")
    if MARKER_PATTERN.search(document):
        raise PhaseContextContractError("phase context must not contain a generated marker")

    lines = document.splitlines()
    first_visible = next((index for index, line in enumerate(lines) if line.strip()), None)
    if first_visible is None:
        raise PhaseContextContractError("phase context is empty")
    first_heading = HEADING_PATTERN.fullmatch(lines[first_visible])
    if first_heading is None or first_heading.group(1) != "#":
        raise PhaseContextContractError("phase context must start with one level-one heading")

    headings: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        heading = HEADING_PATTERN.fullmatch(line)
        if heading is None:
            continue
        level = len(heading.group(1))
        name = heading.group(2).strip()
        headings.append((index, level, name))
        if level > 3:
            raise PhaseContextContractError(
                "headings below level three are outside the visible contract"
            )
        if name.casefold() in {item.casefold() for item in BANNED_HEADINGS}:
            raise PhaseContextContractError(f"forbidden visible heading: {name}")

    level_one = [item for item in headings if item[1] == 1]
    if len(level_one) != 1:
        raise PhaseContextContractError("phase context must contain exactly one level-one heading")
    phase_name = level_one[0][2]

    for label in BANNED_LABELS:
        label_pattern = re.compile(
            rf"^\s*(?:[-*]\s+)?(?:\*\*)?{re.escape(label)}(?:\*\*)?\s*:",
            re.IGNORECASE,
        )
        if any(label_pattern.search(line) for line in lines):
            raise PhaseContextContractError(f"forbidden mechanical label: {label}")

    level_two = [item for item in headings if item[1] == 2]
    level_two_names = [item[2] for item in level_two]
    if any(name not in ALLOWED_LEVEL_TWO for name in level_two_names):
        raise PhaseContextContractError("phase context has an unsupported level-two heading")
    expected_names = ["Tamamlanma Ölçütleri", "Kapsam Sınırları"]
    if level_two_names and level_two_names[0] == "Alt Fazlar":
        expected_names.insert(0, "Alt Fazlar")
    if level_two_names != expected_names:
        raise PhaseContextContractError(
            "level-two headings must be optional Alt Fazlar followed by "
            "Tamamlanma Ölçütleri and Kapsam Sınırları"
        )

    first_level_two_line = level_two[0][0]
    _nonempty_section(
        lines,
        first_visible + 1,
        first_level_two_line,
        "phase introduction",
    )

    subphases: list[dict[str, Any]] = []
    alt_start = next(
        (line for line, _level, name in level_two if name == "Alt Fazlar"),
        None,
    )
    completion_start = next(
        line
        for line, _level, name in level_two
        if name == "Tamamlanma Ölçütleri"
    )
    for line, level, name in headings:
        if level != 3:
            continue
        if alt_start is None or not alt_start < line < completion_start:
            raise PhaseContextContractError(
                "level-three headings are allowed only inside Alt Fazlar"
            )
        subphases.append(
            {
                "order": len(subphases) + 1,
                "name": name,
                "line": line,
            }
        )
    if alt_start is not None and not subphases:
        raise PhaseContextContractError("Alt Fazlar must contain at least one subphase")

    for index, subphase in enumerate(subphases):
        end = (
            subphases[index + 1]["line"]
            if index + 1 < len(subphases)
            else completion_start
        )
        _nonempty_section(
            lines,
            subphase["line"] + 1,
            end,
            f"subphase {subphase['name']}",
        )

    completion_index = level_two_names.index("Tamamlanma Ölçütleri")
    completion_end = level_two[completion_index + 1][0]
    _nonempty_section(
        lines,
        completion_start + 1,
        completion_end,
        "Tamamlanma Ölçütleri",
    )
    scope_start = level_two[-1][0]
    _nonempty_section(lines, scope_start + 1, len(lines), "Kapsam Sınırları")

    return {
        "name": phase_name,
        "subphases": [
            {"order": item["order"], "name": item["name"]} for item in subphases
        ],
    }


def validate_phase_context(path: Path, expected_phase: dict[str, Any]) -> None:
    observed = parse_phase_context(path)
    if observed["name"] != expected_phase["name"]:
        raise PhaseContextContractError(
            f"phase name mismatch: expected {expected_phase['name']!r}, "
            f"got {observed['name']!r}"
        )
    observed_names = [item["name"] for item in observed["subphases"]]
    expected_names = [item["name"] for item in expected_phase["subphases"]]
    if observed_names != expected_names:
        raise PhaseContextContractError(
            f"subphase hierarchy mismatch in {expected_phase['id']}: "
            f"expected {expected_names!r}, got {observed_names!r}"
        )
