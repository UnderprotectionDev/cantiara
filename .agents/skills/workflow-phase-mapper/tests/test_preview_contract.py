from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = SKILL_ROOT / "scripts" / "preview_contract.py"


def load_contract():
    spec = importlib.util.spec_from_file_location(
        "workflow_preview_contract",
        CONTRACT_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load preview contract")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


CONTRACT = load_contract()


def source(label: str, role: str, path: str, digest: str) -> dict[str, Any]:
    return {
        "label": label,
        "role": role,
        "path": path,
        "sha256": digest * 64,
    }


def phase(
    phase_id: str,
    order: int,
    *,
    prerequisites: dict[str, Any] | None = None,
    decisions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    value = {
        "id": phase_id,
        "order": order,
        "phaseKind": "product-feature",
        "name": phase_id.replace("-", " ").title(),
        "summary": f"{phase_id} delivers whole value within its feature boundary.",
        "prerequisites": prerequisites or {"allOf": [], "anyOf": []},
        "subphases": [
            {
                "id": f"{phase_id}-create",
                "order": 1,
                "name": "Create",
                "outcome": "A valid result exists.",
            }
        ],
    }
    if decisions is not None:
        value["openDecisions"] = decisions
    return value


def valid_preview() -> dict[str, Any]:
    semantic = {
        "title": "Fixture",
        "description": "Review the phase fragment.",
        "sources": [
            source("PRD", "product", "docs/prd.md", "a"),
            source("Stack", "technical", "package.json", "b"),
        ],
        "phases": [
            phase("catalog", 1),
            phase(
                "checkout",
                2,
                prerequisites={
                    "allOf": [
                        {
                            "phaseId": "catalog",
                            "requiredOutcome": "Selectable product",
                        }
                    ],
                    "anyOf": [],
                },
            ),
        ],
    }
    return CONTRACT.finalize_preview_metadata(semantic)


class PreviewContractTests(unittest.TestCase):
    def test_validates_direct_prerequisites(self) -> None:
        preview = valid_preview()
        CONTRACT.validate_preview(preview)
        self.assertRegex(preview["previewRevision"], r"^pv-[0-9a-f]{20}$")
        self.assertRegex(preview["sourceRevision"], r"^src-[0-9a-f]{20}$")

    def test_metadata_is_deterministic_and_tamper_evident(self) -> None:
        first = valid_preview()
        second = valid_preview()
        self.assertEqual(first["previewRevision"], second["previewRevision"])
        self.assertEqual(first["sourceRevision"], second["sourceRevision"])
        first["phases"][0]["name"] = "Changed"
        with self.assertRaisesRegex(CONTRACT.PreviewContractError, "previewRevision"):
            CONTRACT.validate_preview(first)

    def test_requires_product_and_technical_authority(self) -> None:
        preview = valid_preview()
        preview["sources"] = [source("PRD", "product", "docs/prd.md", "a")]
        preview = CONTRACT.finalize_preview_metadata(preview)
        with self.assertRaisesRegex(CONTRACT.PreviewContractError, "technical authority"):
            CONTRACT.validate_preview(preview)

    def test_requires_supported_hidden_phase_kind(self) -> None:
        preview = valid_preview()
        preview["phases"][0]["phaseKind"] = "screen"
        preview = CONTRACT.finalize_preview_metadata(preview)
        with self.assertRaisesRegex(CONTRACT.PreviewContractError, "phaseKind"):
            CONTRACT.validate_preview(preview)

    def test_rejects_unresolved_decision_before_html(self) -> None:
        semantic = valid_preview()
        semantic["phases"][0]["openDecisions"] = [
            {"id": "decision-search-boundary"}
        ]
        semantic = CONTRACT.finalize_preview_metadata(semantic)
        with self.assertRaisesRegex(CONTRACT.PreviewContractError, "conversation first"):
            CONTRACT.validate_preview(semantic)

    def test_rejects_dependency_cycle(self) -> None:
        preview = valid_preview()
        preview["phases"][0]["prerequisites"]["allOf"] = [
            {"phaseId": "checkout", "requiredOutcome": "Checkout result"}
        ]
        preview = CONTRACT.finalize_preview_metadata(preview)
        with self.assertRaisesRegex(
            CONTRACT.PreviewContractError,
            "dependency cycle|before a required phase",
        ):
            CONTRACT.validate_preview(preview)

    def test_rejects_non_contiguous_order(self) -> None:
        preview = valid_preview()
        preview["phases"][1]["order"] = 3
        preview = CONTRACT.finalize_preview_metadata(preview)
        with self.assertRaisesRegex(CONTRACT.PreviewContractError, "contiguous"):
            CONTRACT.validate_preview(preview)

    def test_parses_machine_metadata_from_preview_html(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "index.html"
            path.write_text(
                (
                    '<!doctype html><html data-workflow-preview="1" '
                    'data-preview-revision="pv-11111111111111111111" '
                    'data-source-revision="src-PLACEHOLDER" '
                    'data-preview-content-sha256="__PREVIEW_CONTENT_SHA256__">'
                    '<head><meta name="workflow-source" data-label="PRD" '
                    'data-role="product" data-path="docs/prd.md" '
                    f'data-sha256="{"a" * 64}">'
                    '<meta name="workflow-source" data-label="Stack" '
                    'data-role="technical" data-path="package.json" '
                    f'data-sha256="{"b" * 64}"></head>'
                    '<body><article data-phase-id="catalog" data-phase-order="1" '
                    'data-phase-name="Catalog">'
                    '<div data-subphase-id="catalog-create" data-subphase-order="1" '
                    'data-subphase-name="Create" '
                    'data-subphase-outcome="A valid result exists."></div>'
                    "</article></body></html>"
                ),
                encoding="utf-8",
            )
            sources = [
                source("PRD", "product", "docs/prd.md", "a"),
                source("Stack", "technical", "package.json", "b"),
            ]
            source_revision = CONTRACT.compute_source_revision(sources)
            document = path.read_text(encoding="utf-8").replace(
                "src-PLACEHOLDER",
                source_revision,
            )
            path.write_text(
                CONTRACT.finalize_html_content_digest(document),
                encoding="utf-8",
            )
            parsed = CONTRACT.parse_preview_html(path)
            self.assertEqual("pv-11111111111111111111", parsed["previewRevision"])
            self.assertEqual(
                [
                    {
                        "id": "catalog",
                        "order": 1,
                        "name": "Catalog",
                        "subphases": [
                            {
                                "id": "catalog-create",
                                "order": 1,
                                "name": "Create",
                                "outcome": "A valid result exists.",
                            }
                        ],
                    }
                ],
                parsed["phases"],
            )


if __name__ == "__main__":
    unittest.main()
