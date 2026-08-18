from __future__ import annotations

import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock


SKILL_ROOT = Path(__file__).resolve().parents[1]
PREPARE = SKILL_ROOT / "scripts" / "prepare_preview.py"
PUBLISH = SKILL_ROOT / "scripts" / "publish_phase_contexts.py"


def load_publisher():
    scripts = str(SKILL_ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    spec = importlib.util.spec_from_file_location("workflow_phase_publisher", PUBLISH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load publisher")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


PUBLISHER = load_publisher()


def semantic_preview() -> dict[str, Any]:
    return {
        "title": "Tool fixture",
        "description": "Preview and publish one phase.",
        "sources": [
            {"label": "PRD", "role": "product", "path": "docs/prd.md"},
            {"label": "Stack", "role": "technical", "path": "package.json"},
        ],
        "phases": [
            {
                "id": "records",
                "order": 1,
                "phaseKind": "product-feature",
                "name": "Records",
                "summary": "Records deliver complete value within their feature boundary.",
                "prerequisites": {"allOf": [], "anyOf": []},
                "subphases": [
                    {
                        "id": "record-create",
                        "order": 1,
                        "name": "Create record",
                        "outcome": "A valid record exists.",
                    }
                ],
            }
        ],
    }


class PreviewPreparationAndPublishingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / "docs").mkdir()
        (self.root / "docs" / "prd.md").write_text("# Product\n", encoding="utf-8")
        (self.root / "package.json").write_text(
            '{"name":"fixture"}\n',
            encoding="utf-8",
        )
        self.workflow_dir = self.root / "docs" / "workflow"
        self.semantic_path = self.root / "semantic-preview.json"
        self.semantic_path.write_text(
            json.dumps(semantic_preview()),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def run_prepare(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(PREPARE),
                str(self.semantic_path),
                "--project-root",
                str(self.root),
                "--workflow-dir",
                str(self.workflow_dir),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def run_publish(
        self,
        staging: Path,
        approved_preview_revision: str | None,
    ) -> subprocess.CompletedProcess[str]:
        command = [
            "python3",
            str(PUBLISH),
            "--workflow-dir",
            str(self.workflow_dir),
            "--staging-dir",
            str(staging),
        ]
        if approved_preview_revision is not None:
            command.extend(
                ["--approved-preview-revision", approved_preview_revision]
            )
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )

    def prepared_metadata(self) -> tuple[str, str]:
        self.assertEqual(0, self.run_prepare().returncode)
        html = (self.workflow_dir / "index.html").read_text(encoding="utf-8")
        preview = re.search(r'data-preview-revision="(pv-[0-9a-f]{20})"', html)
        source = re.search(r'data-source-revision="(src-[0-9a-f]{20})"', html)
        self.assertIsNotNone(preview)
        self.assertIsNotNone(source)
        return preview.group(1), source.group(1)

    def staging_for(self, preview_revision: str) -> Path:
        staging = self.root / "staging"
        if staging.exists():
            shutil.rmtree(staging)
        directory = staging / "01-records"
        directory.mkdir(parents=True)
        (directory / "phase-context.md").write_text(
            (
                "# Records\n\n"
                "Records give the user a complete, observable result within a clear "
                "feature boundary.\n\n"
                "## Alt Fazlar\n\n"
                "### Create record\n\n"
                "The user creates a valid record and can observe the saved result.\n\n"
                "## Tamamlanma Ölçütleri\n\n"
                "- The complete records feature produces its intended result.\n\n"
                "## Kapsam Sınırları\n\n"
                "- Technical layers do not become phases.\n"
            ),
            encoding="utf-8",
        )
        return staging

    def test_prepare_creates_only_self_contained_index_and_is_idempotent(self) -> None:
        first = self.run_prepare()
        self.assertEqual(0, first.returncode, msg=first.stdout + first.stderr)
        index_path = self.workflow_dir / "index.html"
        first_index = index_path.read_bytes()
        html = first_index.decode("utf-8")
        self.assertRegex(html, r'data-preview-revision="pv-[0-9a-f]{20}"')
        self.assertRegex(html, r'data-source-revision="src-[0-9a-f]{20}"')
        self.assertRegex(html, r'data-preview-content-sha256="[0-9a-f]{64}"')
        self.assertIn("Records deliver complete value", html)
        self.assertEqual(1, html.count("Records deliver complete value"))
        self.assertNotIn("Kapsam özeti", html)
        self.assertIn("Create record", html)
        self.assertNotIn("Kapsanan Davranışlar", html)
        self.assertNotIn("Gerçek Önkoşullar", html)
        self.assertNotIn("source-chips", html)
        self.assertNotIn("Kapsam Dışında", html)
        self.assertNotIn("Onayla", html)
        self.assertNotIn("localStorage", html)
        self.assertEqual(["index.html"], sorted(path.name for path in self.workflow_dir.iterdir()))

        second = self.run_prepare()
        self.assertEqual(0, second.returncode, msg=second.stdout + second.stderr)
        self.assertEqual(first_index, index_path.read_bytes())

    def test_atomic_phase_has_no_empty_disclosure_control(self) -> None:
        semantic = semantic_preview()
        semantic["phases"][0]["subphases"] = []
        self.semantic_path.write_text(json.dumps(semantic), encoding="utf-8")

        result = self.run_prepare()

        self.assertEqual(0, result.returncode, msg=result.stdout + result.stderr)
        html = (self.workflow_dir / "index.html").read_text(encoding="utf-8")
        self.assertIn('class="phase-summary atomic"', html)
        self.assertNotIn("<details", html)
        self.assertNotIn('class="chevron"', html)
        self.assertNotIn("Tümünü genişlet", html)
        self.assertNotIn("Tümünü daralt", html)

    def test_source_change_creates_new_preview_revision(self) -> None:
        first_preview, first_source = self.prepared_metadata()
        (self.root / "docs" / "prd.md").write_text(
            "# Changed product\n",
            encoding="utf-8",
        )
        second_preview, second_source = self.prepared_metadata()
        self.assertNotEqual(first_source, second_source)
        self.assertNotEqual(first_preview, second_preview)
        self.assertEqual(["index.html"], sorted(path.name for path in self.workflow_dir.iterdir()))

    def test_publish_replaces_only_marker_owned_outputs_and_removes_preview(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        old = self.workflow_dir / "09-old-phase"
        old.mkdir()
        (old / "phase-context.md").write_text(
            "<!-- workflow-phase-mapper "
            "phaseId=old-phase previewRevision=pv-00000000000000000000 -->\n# Old\n",
            encoding="utf-8",
        )
        result = self.run_publish(self.staging_for(preview_revision), preview_revision)
        self.assertEqual(0, result.returncode, msg=result.stdout + result.stderr)
        self.assertIn(
            f"PUBLISHED_PREVIEW_REVISION={preview_revision}",
            result.stdout,
        )
        self.assertFalse(old.exists())
        self.assertFalse((self.workflow_dir / "index.html").exists())
        published = self.workflow_dir / "01-records" / "phase-context.md"
        self.assertTrue(published.is_file())
        self.assertNotIn("workflow-phase-mapper", published.read_text(encoding="utf-8"))

    def test_publish_replaces_legacy_marker_owned_outputs(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        old = self.workflow_dir / "09-old-phase"
        old.mkdir()
        (old / "phase-context.md").write_text(
            "<!-- workflow-phase-mapper schema=3 "
            "phaseId=old-phase reviewRevision=wf-00000000000000000000 -->\n# Old\n",
            encoding="utf-8",
        )
        result = self.run_publish(self.staging_for(preview_revision), preview_revision)
        self.assertEqual(0, result.returncode, msg=result.stdout + result.stderr)
        self.assertFalse(old.exists())

    def test_publish_refuses_unmarked_collision_without_losing_it(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        collision = self.workflow_dir / "01-records"
        collision.mkdir()
        user_file = collision / "notes.md"
        user_file.write_text("user content\n", encoding="utf-8")
        result = self.run_publish(self.staging_for(preview_revision), preview_revision)
        self.assertNotEqual(0, result.returncode)
        self.assertEqual("user content\n", user_file.read_text(encoding="utf-8"))
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_rejects_preview_final_hierarchy_drift(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        old = self.workflow_dir / "02-old"
        old.mkdir()
        old_context = old / "phase-context.md"
        old_context.write_text(
            "<!-- workflow-phase-mapper "
            "phaseId=old previewRevision=pv-00000000000000000000 -->\n# Old\n",
            encoding="utf-8",
        )
        staging = self.staging_for(preview_revision)
        context = staging / "01-records" / "phase-context.md"
        context.write_text(
            context.read_text(encoding="utf-8").replace(
                "### Create record",
                "### Rename record",
            ),
            encoding="utf-8",
        )
        result = self.run_publish(staging, preview_revision)
        self.assertNotEqual(0, result.returncode)
        self.assertIn("subphase hierarchy mismatch", result.stderr)
        self.assertTrue(old_context.is_file())
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_second_publish_refuses_markerless_owned_set_fail_closed(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        first = self.run_publish(self.staging_for(preview_revision), preview_revision)
        self.assertEqual(0, first.returncode, msg=first.stdout + first.stderr)
        self.semantic_path.write_text(
            json.dumps(semantic_preview()),
            encoding="utf-8",
        )
        second_preview, _ = self.prepared_metadata()
        second = self.run_publish(self.staging_for(second_preview), second_preview)
        self.assertNotEqual(0, second.returncode)
        self.assertIn("ownership is unknown", second.stderr)
        self.assertTrue((self.workflow_dir / "01-records" / "phase-context.md").is_file())
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_rejects_mechanical_final_contract(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        for label in ("Auth/sahiplik", "Hata", "Recovery"):
            with self.subTest(label=label):
                staging = self.staging_for(preview_revision)
                context = staging / "01-records" / "phase-context.md"
                context.write_text(
                    context.read_text(encoding="utf-8").replace(
                        "The user creates a valid record",
                        f"**{label}:** The user creates a valid record",
                    ),
                    encoding="utf-8",
                )
                result = self.run_publish(staging, preview_revision)
                self.assertNotEqual(0, result.returncode)
                self.assertIn("forbidden mechanical label", result.stderr)
                self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_rejects_headings_outside_visible_contract(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        staging = self.staging_for(preview_revision)
        context = staging / "01-records" / "phase-context.md"
        context.write_text(
            context.read_text(encoding="utf-8").replace(
                "The user creates a valid record",
                "#### Internal trace\n\nThe user creates a valid record",
            ),
            encoding="utf-8",
        )

        result = self.run_publish(staging, preview_revision)

        self.assertNotEqual(0, result.returncode)
        self.assertIn("outside the visible contract", result.stderr)
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_rejects_sources_changed_after_preview(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        staging = self.staging_for(preview_revision)
        (self.root / "docs" / "prd.md").write_text(
            "# Changed after preview\n",
            encoding="utf-8",
        )
        result = self.run_publish(staging, preview_revision)
        self.assertNotEqual(0, result.returncode)
        self.assertIn("regenerate index.html", result.stderr)
        self.assertFalse((self.workflow_dir / "01-records").exists())
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_rejects_preview_content_changed_after_preparation(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        staging = self.staging_for(preview_revision)
        index_path = self.workflow_dir / "index.html"
        index_path.write_text(
            index_path.read_text(encoding="utf-8").replace(
                "Records deliver complete value within their feature boundary.",
                "Records deliver changed value.",
            ),
            encoding="utf-8",
        )

        result = self.run_publish(staging, preview_revision)

        self.assertNotEqual(0, result.returncode)
        self.assertIn("content digest", result.stderr)
        self.assertFalse((self.workflow_dir / "01-records").exists())
        self.assertTrue(index_path.is_file())

    def test_publish_requires_current_approved_preview_revision(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        staging = self.staging_for(preview_revision)

        missing = self.run_publish(staging, None)
        self.assertNotEqual(0, missing.returncode)
        self.assertIn("--approved-preview-revision", missing.stderr)

        mismatched = self.run_publish(staging, "pv-00000000000000000000")
        self.assertNotEqual(0, mismatched.returncode)
        self.assertIn("does not match current index.html", mismatched.stderr)
        self.assertFalse((self.workflow_dir / "01-records").exists())
        self.assertTrue((self.workflow_dir / "index.html").is_file())

    def test_publish_cleans_transaction_if_staging_copy_fails(self) -> None:
        preview_revision, _ = self.prepared_metadata()
        staging = self.staging_for(preview_revision)

        with mock.patch.object(
            PUBLISHER.shutil,
            "copytree",
            side_effect=OSError("copy failed"),
        ):
            with self.assertRaisesRegex(OSError, "copy failed"):
                PUBLISHER.publish(
                    self.workflow_dir,
                    staging,
                    preview_revision,
                )

        self.assertEqual([], list(self.workflow_dir.glob(".phase-publish.*")))
        self.assertTrue((self.workflow_dir / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
