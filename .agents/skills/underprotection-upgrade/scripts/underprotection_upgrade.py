#!/usr/bin/env python3
"""Minimal updater for Underprotection Codex skills."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


REPO_URL = "https://github.com/UnderprotectionDev/my-skills.git"
REF = "main"
EXCLUDED_NAMES = {
    ".git",
    ".DS_Store",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}
LEGACY_SKILL_RENAMES = {
    "docs-to-workflow": "workflow-phase-mapper",
    "prd-check": "prd-readiness-check",
}
RETIRED_SKILL_NAMES = {
    "backend-prompt-builder",
    "code-review-prompt-builder",
    "frontend-prompt-builder",
    "security-review-prompt-builder",
    "test-prompt-builder",
}


def run(cmd: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def is_clean_package_path(path: Path) -> bool:
    return not any(part in EXCLUDED_NAMES for part in path.parts)


def package_files(package_dir: Path) -> list[str]:
    files: list[str] = []
    for path in sorted(package_dir.rglob("*")):
        rel = path.relative_to(package_dir)
        if path.is_file() and is_clean_package_path(rel):
            files.append(rel.as_posix())
    return files


def package_matches(source_package: Path, local_package: Path) -> bool:
    if not local_package.is_dir():
        return False

    source_files = package_files(source_package)
    local_files = package_files(local_package)
    if source_files != local_files:
        return False

    for rel in source_files:
        if (source_package / rel).read_bytes() != (local_package / rel).read_bytes():
            return False
    return True


def copy_package_contents(source_package: Path, local_package: Path) -> None:
    for rel in package_files(source_package):
        src = source_package / rel
        dest = local_package / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def replace_package_atomic(source_package: Path, local_package: Path) -> None:
    """Replace a package with a same-parent swap so a failed copy can roll back."""

    local_package.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(
        tempfile.mkdtemp(
            prefix=f".{local_package.name}.tmp-",
            dir=str(local_package.parent),
        )
    )
    backup_path: Path | None = None

    try:
        copy_package_contents(source_package, tmp_dir)
        validation_error = validate_skill(tmp_dir, local_package.name)
        if validation_error:
            raise RuntimeError(f"copied package validation failed: {validation_error}")

        if local_package.exists():
            backup_path = Path(
                tempfile.mkdtemp(
                    prefix=f".{local_package.name}.backup-",
                    dir=str(local_package.parent),
                )
            )
            backup_path.rmdir()
            local_package.replace(backup_path)

        tmp_dir.replace(local_package)

        if backup_path is not None and backup_path.exists():
            if backup_path.is_dir():
                shutil.rmtree(backup_path)
            else:
                backup_path.unlink()
    except Exception:
        if backup_path is not None and backup_path.exists() and not local_package.exists():
            backup_path.replace(local_package)
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
        raise


def local_library(args: argparse.Namespace) -> Path:
    raw = args.local_dir or os.environ.get("UNDERPROTECTION_LOCAL_SKILLS_DIR")
    return Path(raw).expanduser() if raw else Path.home() / ".codex" / "skills"


def clone_source(args: argparse.Namespace) -> tuple[Path, str, tempfile.TemporaryDirectory[str] | None]:
    source_dir = args.source_dir or os.environ.get("UNDERPROTECTION_SOURCE_DIR")
    if source_dir:
        root = Path(source_dir).expanduser().resolve()
        commit = run(["git", "rev-parse", "HEAD"], cwd=root)
        return root, commit, None

    tmp = tempfile.TemporaryDirectory(prefix="underprotection-upgrade-")
    root = Path(tmp.name) / "my-skills"
    run(["git", "clone", "--depth", "1", "--branch", REF, REPO_URL, str(root)])
    commit = run(["git", "rev-parse", "HEAD"], cwd=root)
    return root, commit, tmp


def inventory_source(source_root: Path) -> dict[str, dict[str, Any]]:
    skills_root = source_root / "skills"
    packages: dict[str, dict[str, Any]] = {}
    for skill_md in sorted(skills_root.glob("*/SKILL.md")):
        package_dir = skill_md.parent
        packages[package_dir.name] = {
            "dir": package_dir,
            "files": package_files(package_dir),
        }
    return packages


def validate_skill(local_package: Path, name: str) -> str | None:
    skill_md = local_package / "SKILL.md"
    if not skill_md.exists():
        return "missing SKILL.md"
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        return "missing YAML frontmatter"
    end = text.find("\n---", 4)
    if end == -1:
        return "unterminated YAML frontmatter"
    frontmatter = text[4:end]
    if "\nname:" not in "\n" + frontmatter:
        return "missing name"
    if "\ndescription:" not in "\n" + frontmatter:
        return "missing description"
    expected = f"name: {name}"
    if expected not in frontmatter:
        return f"name does not match package ({name})"
    return None


def validate_source_packages(source_packages: dict[str, dict[str, Any]]) -> dict[str, str]:
    errors: dict[str, str] = {}
    for name in sorted(source_packages):
        package_dir = source_packages[name]["dir"]
        error = validate_skill(package_dir, name)
        if error:
            errors[name] = error
    return errors


def package_state(source_package: Path, local_package: Path) -> str:
    if package_matches(source_package, local_package):
        return "unchanged"
    if not local_package.exists():
        return "missing"
    return "different"


def print_list(label: str, values: list[str]) -> None:
    print(f"{label}: {', '.join(values) if values else 'none'}")


def print_validation_errors(validation_errors: dict[str, str], *, label: str) -> None:
    print(f"{label}:")
    for name in sorted(validation_errors):
        print(f"  - {name}: {validation_errors[name]}")


def collect_states(
    source_packages: dict[str, dict[str, Any]],
    local_dir: Path,
) -> dict[str, list[str]]:
    states = {"missing": [], "different": [], "unchanged": []}
    for name in sorted(source_packages):
        state = package_state(source_packages[name]["dir"], local_dir / name)
        states[state].append(name)
    return states


def installed_legacy_packages(local_dir: Path, source_packages: dict[str, dict[str, Any]]) -> list[str]:
    return sorted(
        legacy_name
        for legacy_name, replacement_name in LEGACY_SKILL_RENAMES.items()
        if replacement_name in source_packages and (local_dir / legacy_name).exists()
    )


def installed_retired_packages(local_dir: Path) -> list[str]:
    return sorted(name for name in RETIRED_SKILL_NAMES if (local_dir / name).exists())


def remove_path(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()


def print_header(command: str, local_dir: Path, source_commit: str) -> None:
    print(f"Underprotection upgrade {command}")
    print(f"Source: {REPO_URL} {REF} {source_commit}")
    print(f"Local library: {local_dir}")


def status_updates(args: argparse.Namespace, source_root: Path, source_commit: str) -> int:
    local_dir = local_library(args)
    source_packages = inventory_source(source_root)
    source_validation_errors = validate_source_packages(source_packages)
    states = collect_states(source_packages, local_dir)

    print_header("STATUS", local_dir, source_commit)
    print_list("Checked", sorted(source_packages))
    print_list("Missing", states["missing"])
    print_list("Different", states["different"])
    print_list("Unchanged", states["unchanged"])
    print_list("Legacy installed", installed_legacy_packages(local_dir, source_packages))
    print_list("Retired installed", installed_retired_packages(local_dir))

    if source_validation_errors:
        print_validation_errors(source_validation_errors, label="Source validation errors")
        return 2

    print("Validation: ok")
    print("Dry run: no local files changed.")
    return 0


def apply_updates(args: argparse.Namespace, source_root: Path, source_commit: str) -> int:
    local_dir = local_library(args)
    local_dir.mkdir(parents=True, exist_ok=True)
    source_packages = inventory_source(source_root)
    source_validation_errors = validate_source_packages(source_packages)
    states = collect_states(source_packages, local_dir)

    print_header("APPLY", local_dir, source_commit)
    print("Overwrite mode: changed local packages are replaced only after source validation, using same-directory atomic swaps.")
    print_list("Checked", sorted(source_packages))
    print_list("Missing before apply", states["missing"])
    print_list("Different before apply", states["different"])
    print_list("Unchanged before apply", states["unchanged"])
    legacy_packages = installed_legacy_packages(local_dir, source_packages)
    print_list("Legacy before apply", legacy_packages)
    retired_packages = installed_retired_packages(local_dir)
    print_list("Retired before apply", retired_packages)

    if source_validation_errors:
        print_validation_errors(source_validation_errors, label="Source validation errors")
        print("Validation: failed before replace; no packages updated.")
        return 2

    updated: list[str] = []
    unchanged: list[str] = []
    validation_errors: dict[str, str] = {}

    for name in sorted(source_packages):
        source_package = source_packages[name]["dir"]
        local_package = local_dir / name

        if package_matches(source_package, local_package):
            unchanged.append(name)
        else:
            replace_package_atomic(source_package, local_package)
            updated.append(name)

        error = validate_skill(local_package, name)
        if error:
            validation_errors[name] = error

    print_list("Updated", updated)
    print_list("Unchanged", unchanged)

    if validation_errors:
        print_validation_errors(validation_errors, label="Local validation errors")
        return 2

    removed_legacy: list[str] = []
    for legacy_name in legacy_packages:
        remove_path(local_dir / legacy_name)
        removed_legacy.append(legacy_name)

    print_list("Removed legacy", removed_legacy)

    removed_retired: list[str] = []
    for retired_name in retired_packages:
        remove_path(local_dir / retired_name)
        removed_retired.append(retired_name)

    print_list("Removed retired", removed_retired)

    print("Validation: ok")
    print("Restart Codex so updated skills are reloaded.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Minimal updater for Underprotection Codex skills")
    parser.add_argument("--local-dir", help="Override local skills directory")
    parser.add_argument("--source-dir", help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="Compare source packages with the local library without writing")
    sub.add_parser("dry-run", help="Alias for status")
    sub.add_parser("apply", help="Install or overwrite local packages from the source library")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    tmp: tempfile.TemporaryDirectory[str] | None = None
    try:
        source_root, source_commit, tmp = clone_source(args)
        if args.command in {"status", "dry-run"}:
            return status_updates(args, source_root, source_commit)
        if args.command == "apply":
            return apply_updates(args, source_root, source_commit)
        parser.error(f"unknown command: {args.command}")
        return 2
    finally:
        if tmp is not None:
            tmp.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
