#!/usr/bin/env python3
"""Regression checks for underprotection_upgrade.py using temp libraries."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("underprotection_upgrade.py")


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"command failed ({result.returncode}): {' '.join(cmd)}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result


def write_skill(source_root: Path, name: str, body: str = "Body\n", frontmatter_name: str | None = None) -> None:
    package = source_root / "skills" / name
    package.mkdir(parents=True, exist_ok=True)
    skill_name = frontmatter_name or name
    (package / "SKILL.md").write_text(
        f"---\nname: {skill_name}\ndescription: Demo skill\n---\n\n# Demo\n\n{body}",
        encoding="utf-8",
    )
    (package / "references").mkdir(exist_ok=True)
    (package / "references" / "notes.md").write_text(body, encoding="utf-8")


def init_source_repo(source_root: Path) -> None:
    run(["git", "init"], cwd=source_root)
    run(["git", "config", "user.email", "test@example.com"], cwd=source_root)
    run(["git", "config", "user.name", "Test"], cwd=source_root)
    run(["git", "add", "."], cwd=source_root)
    run(["git", "commit", "-m", "fixture"], cwd=source_root)


def command(source_root: Path, local_dir: Path, subcommand: str) -> list[str]:
    return [
        sys.executable,
        str(SCRIPT),
        "--source-dir",
        str(source_root),
        "--local-dir",
        str(local_dir),
        subcommand,
    ]


def assert_contains(text: str, needle: str) -> None:
    if needle not in text:
        raise AssertionError(f"expected {needle!r} in output:\n{text}")


def test_status_is_read_only() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "source"
        local = root / "local-skills"
        source.mkdir()
        write_skill(source, "demo")
        init_source_repo(source)

        result = run(command(source, local, "status"))

        assert_contains(result.stdout, "Underprotection upgrade STATUS")
        assert_contains(result.stdout, "Missing: demo")
        assert_contains(result.stdout, "Dry run: no local files changed.")
        if local.exists():
            raise AssertionError("status must not create the local skills directory")


def test_apply_installs_and_status_reports_unchanged() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "source"
        local = root / "local-skills"
        source.mkdir()
        write_skill(source, "demo", body="v1\n")
        init_source_repo(source)

        apply_result = run(command(source, local, "apply"))
        assert_contains(apply_result.stdout, "Updated: demo")
        assert_contains(apply_result.stdout, "Overwrite mode:")
        if not (local / "demo" / "SKILL.md").exists():
            raise AssertionError("apply should install the demo skill")

        status_result = run(command(source, local, "dry-run"))
        assert_contains(status_result.stdout, "Unchanged: demo")
        assert_contains(status_result.stdout, "Dry run: no local files changed.")


def test_source_validation_blocks_replace() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "source"
        local = root / "local-skills"
        source.mkdir()
        write_skill(source, "demo", body="bad source\n", frontmatter_name="wrong-name")
        init_source_repo(source)

        existing = local / "demo"
        existing.mkdir(parents=True)
        (existing / "SKILL.md").write_text(
            "---\nname: demo\ndescription: Existing skill\n---\n\nold local content\n",
            encoding="utf-8",
        )
        retired = local / "backend-prompt-builder"
        retired.mkdir()

        result = run(command(source, local, "apply"), check=False)

        if result.returncode != 2:
            raise AssertionError(f"expected validation failure exit 2, got {result.returncode}")
        assert_contains(result.stdout, "Source validation errors:")
        assert_contains(result.stdout, "no packages updated")
        local_text = (existing / "SKILL.md").read_text(encoding="utf-8")
        assert_contains(local_text, "old local content")
        if not retired.exists():
            raise AssertionError("failed source validation must not remove retired packages")


def test_apply_removes_retired_packages_only_after_validation() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "source"
        local = root / "local-skills"
        source.mkdir()
        write_skill(source, "demo")
        init_source_repo(source)

        retired_names = [
            "backend-prompt-builder",
            "code-review-prompt-builder",
            "frontend-prompt-builder",
            "security-review-prompt-builder",
            "test-prompt-builder",
        ]
        for name in retired_names:
            (local / name).mkdir(parents=True)

        status_result = run(command(source, local, "status"))
        assert_contains(status_result.stdout, "Retired installed: backend-prompt-builder")
        if not all((local / name).exists() for name in retired_names):
            raise AssertionError("status must not remove retired packages")

        apply_result = run(command(source, local, "apply"))
        assert_contains(apply_result.stdout, "Removed retired: backend-prompt-builder")
        if any((local / name).exists() for name in retired_names):
            raise AssertionError("apply should remove every retired package")


def main() -> int:
    tests = [
        test_status_is_read_only,
        test_apply_installs_and_status_reports_unchanged,
        test_source_validation_blocks_replace,
        test_apply_removes_retired_packages_only_after_validation,
    ]
    for test in tests:
        test()
    print(f"PASS {len(tests)} underprotection-upgrade check(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
