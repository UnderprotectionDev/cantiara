from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = SKILL_ROOT / "scripts/run_forward_tests.py"
SPEC = importlib.util.spec_from_file_location("workflow_forward_runner", RUNNER_PATH)
assert SPEC and SPEC.loader
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


def phase(
    phase_id: str,
    kind: str = "product-feature",
    subphases: list[str] | None = None,
) -> dict:
    return {
        "id": phase_id,
        "name": phase_id.replace("-", " ").title(),
        "phaseKind": kind,
        "subphases": [
            {"id": item, "name": item.replace("-", " ").title()}
            for item in (subphases or [])
        ],
    }


class ForwardRunnerTests(unittest.TestCase):
    def test_matching_hierarchy_passes_semantic_gate(self) -> None:
        case = {
            "expected": {
                "phases": [
                    {"id": "catalog", "phaseKind": "product-feature", "subphases": []},
                    {
                        "id": "checkout",
                        "phaseKind": "product-feature",
                        "subphases": ["place-order"],
                    },
                ],
                "requiredOrder": ["catalog", "checkout"],
                "distributedBehaviors": ["validation"],
            }
        }
        output = {
            "phases": [
                phase("catalog-management"),
                phase("checkout", subphases=["place-order"]),
            ],
            "distributedBehaviors": ["record-validation"],
            "phaseOrder": ["catalog-management", "checkout"],
            "rationale": "Separate features and a real prerequisite.",
        }
        self.assertEqual([], RUNNER.validate_output(case, output))

    def test_merged_umbrella_fails_semantic_gate(self) -> None:
        case = {
            "expected": {
                "phases": [
                    {"id": "orchid", "phaseKind": "product-feature", "subphases": []},
                    {"id": "beacon", "phaseKind": "product-feature", "subphases": []},
                    {"id": "atlas", "phaseKind": "product-feature", "subphases": []},
                ],
                "forbiddenMainPhases": ["knowledge-record-management"],
            }
        }
        output = {
            "phases": [phase("knowledge-record-management")],
            "distributedBehaviors": [],
            "phaseOrder": ["knowledge-record-management"],
            "rationale": "Shared model.",
        }
        errors = RUNNER.validate_output(case, output)
        self.assertTrue(any("missing main phases" in error for error in errors))
        self.assertTrue(any("forbidden main phases" in error for error in errors))

    def test_wrong_kind_and_subphase_owner_fail(self) -> None:
        case = {
            "expected": {
                "phases": [
                    {
                        "id": "global-search",
                        "phaseKind": "cross-cutting-feature",
                        "subphases": [],
                    },
                    {
                        "id": "campaign",
                        "phaseKind": "product-feature",
                        "subphases": ["create", "delete"],
                    },
                ]
            }
        }
        output = {
            "phases": [
                phase("global-search", "product-feature", ["create"]),
                phase("campaign", subphases=["delete"]),
            ],
            "distributedBehaviors": [],
            "phaseOrder": ["global-search", "campaign"],
            "rationale": "Incorrect ownership.",
        }
        errors = RUNNER.validate_output(case, output)
        self.assertTrue(any("phase kind mismatch" in error for error in errors))
        self.assertTrue(any("missing subphases" in error for error in errors))
        self.assertTrue(any("unexpected subphases" in error for error in errors))

    def test_common_action_inflections_match_without_weakening_ownership(self) -> None:
        for expected, observed in (
            ("create", "campaign-creation"),
            ("edit", "campaign-editing"),
            ("delete", "campaign-deletion"),
            ("unpublish", "campaign-unpublishing"),
            ("receive", "part-receipt"),
            ("reserve", "part-reservation"),
            ("consume", "part-consumption"),
            ("inspect", "work-inspection"),
        ):
            with self.subTest(expected=expected, observed=observed):
                self.assertTrue(RUNNER.concept_matches(expected, observed))
        self.assertFalse(RUNNER.concept_matches("delete", "campaign-editing"))

    def test_duplicate_nested_identifiers_fail_gate(self) -> None:
        case = {
            "expected": {
                "phases": [
                    {
                        "id": "catalog",
                        "phaseKind": "product-feature",
                        "subphases": ["create"],
                    }
                ]
            }
        }
        output = {
            "phases": [phase("catalog", subphases=["create", "Create"])],
            "distributedBehaviors": [],
            "phaseOrder": ["catalog"],
            "rationale": "Duplicate labels.",
        }
        self.assertTrue(
            any(
                "duplicate subphase identifiers" in error
                for error in RUNNER.validate_output(case, output)
            )
        )

    def test_actor_prompt_does_not_reveal_expected_output(self) -> None:
        case = {
            "sourcePackage": {"prd": "raw prd", "techStack": "raw stack"},
            "expected": {
                "phases": [
                    {
                        "id": "secret-capability",
                        "phaseKind": "product-feature",
                        "subphases": [],
                    }
                ]
            },
        }
        prompt = RUNNER.build_prompt(case, SKILL_ROOT)
        self.assertIn("raw prd", prompt)
        self.assertIn("raw stack", prompt)
        self.assertNotIn("secret-capability", prompt)
        self.assertIn("Do not inspect\ntests, regression fixtures, prior outputs", prompt)

    def test_isolated_skill_copy_excludes_tests_and_expected_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            isolated = RUNNER.prepare_isolated_skill(Path(directory))
            self.assertTrue((isolated / "SKILL.md").is_file())
            self.assertTrue((isolated / "references/decomposition-grammar.md").is_file())
            self.assertFalse((isolated / "tests").exists())
            copied = "\n".join(
                path.read_text(encoding="utf-8")
                for path in isolated.rglob("*")
                if path.is_file()
            )
            self.assertNotIn("shared-model-peer-features", copied)


if __name__ == "__main__":
    unittest.main()
