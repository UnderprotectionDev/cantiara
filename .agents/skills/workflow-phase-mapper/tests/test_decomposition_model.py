from __future__ import annotations

import json
import unittest
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = Path(__file__).with_name("decomposition-cases.json")
MODEL_PATH = SKILL_ROOT / "references/decomposition-decision-model.json"


def complete(fields: list[str], overrides: dict[str, bool]) -> dict[str, bool]:
    facts = {field: True for field in fields}
    unknown = set(overrides) - set(facts)
    if unknown:
        raise AssertionError(f"Unknown fields: {sorted(unknown)}")
    facts.update(overrides)
    return facts


def passes_all(facts: dict[str, bool], required: list[str]) -> bool:
    return all(facts.get(field, False) for field in required)


def passes_any(facts: dict[str, bool], fields: list[str]) -> bool:
    return any(facts.get(field, False) for field in fields)


def is_main_phase_candidate(
    model: dict[str, Any],
    gate_overrides: dict[str, bool],
) -> bool:
    gate = complete(model["deliveryGateRequiredAll"], gate_overrides)
    return passes_all(gate, model["deliveryGateRequiredAll"])


def evaluate_case(
    model: dict[str, Any],
    kind: str,
    facts: dict[str, Any],
) -> str:
    if kind == "discovery":
        return (
            "preserve"
            if passes_any(facts, model["candidatePreservationAny"])
            else "aggregate_or_lower"
        )
    if kind == "main_phase":
        return (
            "main_phase"
            if is_main_phase_candidate(model, facts.get("gateOverrides", {}))
            else "lower"
        )
    if kind == "boundary":
        for signal in model["boundaryNeutralSignals"]:
            if not isinstance(facts.get(signal), bool):
                raise AssertionError(f"Neutral signal is not boolean: {signal}")
        if passes_any(facts, model["antiMergeAny"]):
            return "separate"
        if passes_all(facts, model["parentCohesionRequiredAll"]):
            return "merge"
        return "separate"
    if kind == "subphase":
        if passes_any(facts, model["subphaseBreadthReassessmentAny"]):
            return "split_or_retest_main"
        return (
            "subphase"
            if passes_all(facts, model["subphaseRequiredAll"])
            else "behavior"
        )
    if kind == "cross_cutting":
        return (
            "main_phase"
            if passes_all(facts, model["crossCuttingRequiredAll"])
            else "distribute"
        )
    if kind == "observable_system":
        return (
            "main_phase"
            if passes_all(facts, model["observableSystemRequiredAll"])
            else "internal_mechanism"
        )
    if kind == "prerequisite":
        return (
            "hard"
            if passes_all(facts, model["hardPrerequisiteRequiredAll"])
            else "none"
        )
    if kind == "evidence":
        return (
            "integrated"
            if passes_all(facts, model["integratedEvidenceRequiredAll"])
            else "invalid"
        )
    if kind == "ambiguity":
        return (
            "ask"
            if passes_all(facts, model["ambiguityQuestionRequiredAll"])
            else "decide_with_defaults"
        )
    raise AssertionError(f"Unknown decomposition case kind: {kind}")


class DecompositionDecisionModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
        cls.manifest = json.loads(CASES_PATH.read_text(encoding="utf-8"))

    def test_complete_feature_identity_needs_no_scope_pressure(self) -> None:
        self.assertTrue(is_main_phase_candidate(self.model, {}))
        self.assertNotIn("scopePressureAny", self.model)
        self.assertIn("diagnosticScopeSignals", self.model)
        for field in self.model["deliveryGateRequiredAll"]:
            with self.subTest(field=field):
                self.assertFalse(is_main_phase_candidate(self.model, {field: False}))

    def test_anti_merge_precedes_shared_implementation(self) -> None:
        facts = {
            **{field: False for field in self.model["parentCohesionRequiredAll"]},
            **{field: False for field in self.model["antiMergeAny"]},
            **{field: True for field in self.model["boundaryNeutralSignals"]},
            "differentFeatureIdentity": True,
        }
        self.assertEqual("separate", evaluate_case(self.model, "boundary", facts))

    def test_every_subphase_signal_is_required(self) -> None:
        complete_facts = {
            **{field: True for field in self.model["subphaseRequiredAll"]},
            **{
                field: False
                for field in self.model["subphaseBreadthReassessmentAny"]
            },
        }
        self.assertEqual(
            "subphase", evaluate_case(self.model, "subphase", complete_facts)
        )
        for field in self.model["subphaseRequiredAll"]:
            facts = dict(complete_facts)
            facts[field] = False
            self.assertEqual(
                "behavior", evaluate_case(self.model, "subphase", facts)
            )

    def test_every_breadth_signal_reopens_the_boundary(self) -> None:
        for field in self.model["subphaseBreadthReassessmentAny"]:
            facts = {
                **{item: True for item in self.model["subphaseRequiredAll"]},
                **{
                    item: False
                    for item in self.model["subphaseBreadthReassessmentAny"]
                },
                field: True,
            }
            self.assertEqual(
                "split_or_retest_main",
                evaluate_case(self.model, "subphase", facts),
            )

    def test_cross_cutting_and_observable_system_gates_require_all_signals(self) -> None:
        for kind, field_name, negative in (
            ("cross_cutting", "crossCuttingRequiredAll", "distribute"),
            (
                "observable_system",
                "observableSystemRequiredAll",
                "internal_mechanism",
            ),
        ):
            required = self.model[field_name]
            facts = {field: True for field in required}
            self.assertEqual("main_phase", evaluate_case(self.model, kind, facts))
            for field in required:
                incomplete = dict(facts)
                incomplete[field] = False
                self.assertEqual(negative, evaluate_case(self.model, kind, incomplete))

    def test_generic_cases_are_executable_and_unique(self) -> None:
        ids = [case["id"] for case in self.manifest["cases"]]
        self.assertEqual(len(ids), len(set(ids)))
        for case in self.manifest["cases"]:
            self.assertTrue(case["description"], msg=case["id"])
            self.assertEqual(
                case["expected"],
                evaluate_case(self.model, case["kind"], case["facts"]),
                msg=case["id"],
            )

    def test_boundary_neutral_signals_never_change_the_decision(self) -> None:
        for case in self.manifest["cases"]:
            if case["kind"] != "boundary":
                continue
            baseline = evaluate_case(self.model, case["kind"], case["facts"])
            for signal in self.model["boundaryNeutralSignals"]:
                mutated = dict(case["facts"])
                mutated[signal] = not mutated[signal]
                self.assertEqual(
                    baseline,
                    evaluate_case(self.model, case["kind"], mutated),
                    msg=f"{case['id']} / {signal}",
                )

    def test_model_is_routed_and_uses_exact_phase_kinds(self) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        grammar = (
            SKILL_ROOT / "references/decomposition-grammar.md"
        ).read_text(encoding="utf-8")
        failures = (
            SKILL_ROOT / "references/failure-taxonomy.md"
        ).read_text(encoding="utf-8")
        self.assertIn("decomposition-decision-model.json", skill)
        self.assertIn("decomposition-decision-model.json", grammar)
        self.assertEqual(
            [
                "product-feature",
                "cross-cutting-feature",
                "observable-system-capability",
            ],
            self.model["phaseKinds"],
        )
        for required in (
            "FEATURE_IDENTITY_LOSS",
            "SCOPE_PRESSURE_DEMOTION",
            "TECHNICAL_FOUNDATION_PROMOTION",
            "MECHANICAL_SUBPHASE_TEMPLATE",
            "PREVIEW_FINAL_DRIFT",
        ):
            self.assertIn(required, failures)

    def test_cases_do_not_freeze_example_project_names(self) -> None:
        manifest_text = CASES_PATH.read_text(encoding="utf-8")
        for project_term in (
            "AI Vault",
            "Prompt",
            "Skill",
            "Loop",
            "Oto servis",
        ):
            self.assertNotIn(project_term, manifest_text)


if __name__ == "__main__":
    unittest.main()
