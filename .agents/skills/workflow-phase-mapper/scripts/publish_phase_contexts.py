#!/usr/bin/env python3
"""Publish phase-context files that match the current HTML preview."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from phase_context_contract import (
    PhaseContextContractError,
    validate_phase_context,
)
from preview_contract import PreviewContractError, parse_preview_html, source_sha256


MARKER_PATTERN = re.compile(
    r"^<!-- workflow-phase-mapper "
    r"phaseId=([a-z0-9][a-z0-9-]*) "
    r"previewRevision=(pv-[0-9a-f]{20}) -->$"
)
LEGACY_MARKER_PATTERN = re.compile(
    r"^<!-- workflow-phase-mapper schema=3 "
    r"phaseId=([a-z0-9][a-z0-9-]*) "
    r"reviewRevision=(wf-[0-9a-f]{20}) -->$"
)
PHASE_DIRECTORY_PATTERN = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*$")


def marker(path: Path) -> tuple[str, str] | None:
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines:
        return None
    first_line = lines[0]
    match = MARKER_PATTERN.fullmatch(first_line)
    if match:
        return match.group(1), match.group(2)
    legacy = LEGACY_MARKER_PATTERN.fullmatch(first_line)
    if legacy:
        return legacy.group(1), legacy.group(2)
    return None


def expected_directories(preview: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        f"{phase['order']:02d}-{phase['id']}": phase
        for phase in preview["phases"]
    }


def validate_current_sources(
    workflow_dir: Path,
    preview: dict[str, Any],
) -> None:
    project_root = workflow_dir.parent.parent.resolve()
    for source in preview["sources"]:
        try:
            actual = source_sha256(project_root, source["path"])
        except PreviewContractError as error:
            raise ValueError(str(error)) from error
        if actual != source["sha256"]:
            raise ValueError(
                f"preview source changed; regenerate index.html: {source['path']}"
            )


def validate_staging(
    staging_dir: Path,
    preview: dict[str, Any],
) -> dict[str, Path]:
    if not staging_dir.is_dir():
        raise ValueError(f"staging directory does not exist: {staging_dir}")
    expected = expected_directories(preview)
    staged_dirs = {path.name: path for path in staging_dir.iterdir() if path.is_dir()}
    if set(staged_dirs) != set(expected):
        raise ValueError(
            "staging directories must exactly match preview phases: "
            + ", ".join(sorted(expected))
        )
    unexpected_root_files = [path.name for path in staging_dir.iterdir() if path.is_file()]
    if unexpected_root_files:
        raise ValueError(
            "staging contains unexpected root files: "
            + ", ".join(sorted(unexpected_root_files))
        )

    validated: dict[str, Path] = {}
    for directory_name, phase in expected.items():
        context_path = staged_dirs[directory_name] / "phase-context.md"
        try:
            validate_phase_context(context_path, phase)
        except PhaseContextContractError as error:
            raise ValueError(f"{directory_name}/phase-context.md: {error}") from error
        unexpected = [
            path.name
            for path in staged_dirs[directory_name].iterdir()
            if path.name != "phase-context.md"
        ]
        if unexpected:
            raise ValueError(f"{directory_name} contains unexpected staged files")
        validated[directory_name] = staged_dirs[directory_name]
    return validated


def generated_context_directory(path: Path) -> bool:
    return path.is_dir() and marker(path / "phase-context.md") is not None


def publish(
    workflow_dir: Path,
    staging_dir: Path,
    approved_preview_revision: str,
) -> str:
    preview_path = workflow_dir / "index.html"
    preview = parse_preview_html(preview_path)
    if approved_preview_revision != preview["previewRevision"]:
        raise ValueError(
            "approved preview revision does not match current index.html: "
            f"expected {preview['previewRevision']}, "
            f"got {approved_preview_revision}"
        )
    validate_current_sources(workflow_dir, preview)
    staged = validate_staging(staging_dir, preview)
    expected = expected_directories(preview)

    collisions = [
        path.name
        for path in workflow_dir.iterdir()
        if path.is_dir()
        and PHASE_DIRECTORY_PATTERN.fullmatch(path.name)
        and not generated_context_directory(path)
    ]
    if collisions:
        raise ValueError(
            "refusing to publish beside or replace markerless phase directories; "
            "ownership is unknown: "
            + ", ".join(sorted(collisions))
        )

    transaction_root = Path(
        tempfile.mkdtemp(prefix=".phase-publish.", dir=workflow_dir)
    )
    installed: list[Path] = []
    moved_existing: list[tuple[Path, Path]] = []
    try:
        prepared_root = transaction_root / "prepared"
        backup_root = transaction_root / "backup"
        prepared_root.mkdir()
        backup_root.mkdir()
        for name, source in staged.items():
            shutil.copytree(source, prepared_root / name)

        generated_existing = [
            path
            for path in workflow_dir.iterdir()
            if path != transaction_root and generated_context_directory(path)
        ]
        for current in generated_existing:
            backup = backup_root / current.name
            os.replace(current, backup)
            moved_existing.append((current, backup))
        for name in expected:
            target = workflow_dir / name
            os.replace(prepared_root / name, target)
            installed.append(target)
        preview_path.unlink()
    except Exception:
        for target in installed:
            if target.exists():
                shutil.rmtree(target)
        for original, backup in reversed(moved_existing):
            if backup.exists():
                os.replace(backup, original)
        raise
    finally:
        shutil.rmtree(transaction_root, ignore_errors=True)
    return preview["previewRevision"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Publish explicitly approved phase-context files and remove the preview."
        )
    )
    parser.add_argument("--workflow-dir", type=Path, default=Path("docs/workflow"))
    parser.add_argument("--staging-dir", type=Path, required=True)
    parser.add_argument("--approved-preview-revision", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    published_revision = publish(
        args.workflow_dir.resolve(),
        args.staging_dir.resolve(),
        args.approved_preview_revision,
    )
    print("PUBLISHED=1")
    print(f"PUBLISHED_PREVIEW_REVISION={published_revision}")
    print("PREVIEW_REMOVED=1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
