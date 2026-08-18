#!/usr/bin/env python3
"""Create one self-contained workflow index.html from semantic phase data."""

from __future__ import annotations

import argparse
import html
import json
import os
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any

from preview_contract import (
    PreviewContractError,
    finalize_preview_metadata,
    finalize_html_content_digest,
    source_sha256,
    validate_preview,
)


SKILL_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = SKILL_ROOT / "templates" / "preview.html"


def read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise PreviewContractError(f"{path} must contain a JSON object")
    return value


def attach_source_hashes(
    semantic_preview: dict[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    candidate = deepcopy(semantic_preview)
    sources = candidate.get("sources")
    if not isinstance(sources, list):
        raise PreviewContractError("sources must be a list")
    for source in sources:
        if not isinstance(source, dict):
            raise PreviewContractError("each source must be an object")
        relative_path = source.get("path")
        if not isinstance(relative_path, str) or not relative_path.strip():
            raise PreviewContractError("source.path must be non-empty text")
        source["sha256"] = source_sha256(project_root, relative_path)
    return candidate


def escaped(value: Any) -> str:
    return html.escape(str(value), quote=True)


def source_metadata(sources: list[dict[str, Any]]) -> str:
    return "\n".join(
        (
            '<meta name="workflow-source"'
            f' data-label="{escaped(source["label"])}"'
            f' data-role="{escaped(source["role"])}"'
            f' data-path="{escaped(source["path"])}"'
            f' data-sha256="{escaped(source["sha256"])}">'
        )
        for source in sources
    )


def subphases_html(phase: dict[str, Any]) -> str:
    if not phase["subphases"]:
        return ""
    items = []
    for subphase in phase["subphases"]:
        number = f'{phase["order"]}.{subphase["order"]}'
        items.append(
            '<div class="subphase"'
            f' data-subphase-id="{escaped(subphase["id"])}"'
            f' data-subphase-order="{subphase["order"]}"'
            f' data-subphase-name="{escaped(subphase["name"])}"'
            f' data-subphase-outcome="{escaped(subphase["outcome"])}">'
            f'<span class="subphase-number">{escaped(number)}</span>'
            "<div>"
            f'<h4>{escaped(subphase["name"])}</h4>'
            f'<p>{escaped(subphase["outcome"])}</p>'
            "</div>"
            "</div>"
        )
    return (
        '<section class="content-section subphases">'
        "<h3>Alt Fazlar</h3>"
        + "".join(items)
        + "</section>"
    )


def phase_card(phase: dict[str, Any]) -> str:
    number = str(phase["order"]).zfill(2)
    heading = (
        f'<span class="phase-number">{number}</span>'
        '<span class="phase-heading">'
        f'<span class="phase-name">{escaped(phase["name"])}</span>'
        f'<span class="phase-value">{escaped(phase["summary"])}</span>'
        "</span>"
    )
    if phase["subphases"]:
        content = (
            '<details open><summary class="phase-summary">'
            f"{heading}"
            '<span class="chevron" aria-hidden="true">⌄</span>'
            "</summary>"
            f'<div class="phase-body">{subphases_html(phase)}</div>'
            "</details>"
        )
    else:
        content = f'<div class="phase-summary atomic">{heading}</div>'
    return (
        f'<article class="phase-card" id="phase-{escaped(phase["id"])}"'
        f' data-phase-id="{escaped(phase["id"])}"'
        f' data-phase-order="{phase["order"]}"'
        f' data-phase-name="{escaped(phase["name"])}">'
        f"{content}"
        "</article>"
    )


def render(preview: dict[str, Any]) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    replacements = {
        "__DOCUMENT_TITLE__": escaped(f'{preview["title"]} — İş Akışı Önizlemesi'),
        "__PAGE_TITLE__": escaped(preview["title"]),
        "__DESCRIPTION__": escaped(preview["description"]),
        "__PREVIEW_REVISION__": escaped(preview["previewRevision"]),
        "__SOURCE_REVISION__": escaped(preview["sourceRevision"]),
        "__SOURCE_METADATA__": source_metadata(preview["sources"]),
        "__PHASE_COUNT__": str(len(preview["phases"])),
        "__EXPANSION_ACTIONS__": (
            '<div class="toolbar-actions">'
            '<button class="secondary-button" id="expand-all" type="button">'
            "Tümünü genişlet</button>"
            '<button class="secondary-button" id="collapse-all" type="button">'
            "Tümünü daralt</button>"
            "</div>"
            if any(phase["subphases"] for phase in preview["phases"])
            else ""
        ),
        "__PHASE_NAV__": "".join(
            (
                f'<a href="#phase-{escaped(phase["id"])}">'
                f'<span>{str(phase["order"]).zfill(2)}</span>'
                f'{escaped(phase["name"])}</a>'
            )
            for phase in preview["phases"]
        ),
        "__PHASE_CARDS__": "".join(
            phase_card(phase) for phase in preview["phases"]
        ),
    }
    for token, value in replacements.items():
        template = template.replace(token, value)
    unresolved = [token for token in replacements if token in template]
    if unresolved:
        raise PreviewContractError(
            "template contains unresolved placeholders: " + ", ".join(unresolved)
        )
    return finalize_html_content_digest(template)


def write_atomically(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temporary_file:
            temporary_file.write(content)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def prepare(
    semantic_path: Path,
    workflow_dir: Path,
    project_root: Path,
) -> dict[str, Any]:
    semantic = attach_source_hashes(read_object(semantic_path), project_root)
    preview = finalize_preview_metadata(semantic)
    validate_preview(preview)
    write_atomically(workflow_dir / "index.html", render(preview))
    return preview


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create one self-contained workflow index.html preview."
    )
    parser.add_argument("semantic_preview", type=Path)
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--workflow-dir", type=Path, default=Path("docs/workflow"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    preview = prepare(
        args.semantic_preview.resolve(),
        args.workflow_dir.resolve(),
        args.project_root.resolve(),
    )
    print(f"PREVIEW_PATH={args.workflow_dir.resolve() / 'index.html'}")
    print(f"PREVIEW_REVISION={preview['previewRevision']}")
    print(f"SOURCE_REVISION={preview['sourceRevision']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
