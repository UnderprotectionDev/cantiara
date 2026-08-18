from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    return (SKILL_ROOT / relative_path).read_text(encoding="utf-8")


class PackageContractTests(unittest.TestCase):
    def test_invocation_is_explicit_in_skill_and_agent_metadata(self) -> None:
        skill = read("SKILL.md")
        agent_config = read("agents/openai.yaml")
        self.assertRegex(
            skill,
            r"(?m)^disable-model-invocation:\s*true\s*$",
        )
        self.assertRegex(
            agent_config,
            r"(?m)^\s*allow_implicit_invocation:\s*false\s*$",
        )

    def test_every_numbered_runtime_step_has_one_completion_criterion(self) -> None:
        sections = re.findall(
            r"(?ms)^## \d+\..*?(?=^## \d+\.|\Z)",
            read("SKILL.md"),
        )
        self.assertEqual(4, len(sections))
        for section in sections:
            with self.subTest(step=section.splitlines()[0]):
                self.assertEqual(1, section.count("**Tamamlanma ölçütü:**"))

    def test_skill_is_a_progressive_disclosure_router(self) -> None:
        skill = read("SKILL.md")
        self.assertLess(len(skill.splitlines()), 180)
        for routed in (
            "decomposition-grammar.md",
            "decomposition-decision-model.json",
            "product-archetypes.md",
            "prerequisite-sequencing.md",
            "workflow-quality.md",
            "failure-taxonomy.md",
            "output-templates.md",
        ):
            self.assertIn(routed, skill)

    def test_package_context_is_maintenance_only(self) -> None:
        context = read("CONTEXT.md")
        self.assertIn("Bakım Bağlamı", context)
        self.assertIn("runtime girdisi", context)
        self.assertIn("Tek doğruluk kaynakları", context)
        self.assertIn("regression-cases.md", context)
        self.assertNotIn("Bu skill paketindeki `CONTEXT.md`", read("SKILL.md"))

    def test_phase_kind_contract_is_exact_and_hidden_from_template(self) -> None:
        model = json.loads(read("references/decomposition-decision-model.json"))
        self.assertEqual(
            [
                "product-feature",
                "cross-cutting-feature",
                "observable-system-capability",
            ],
            model["phaseKinds"],
        )
        self.assertNotIn("phaseKind", read("templates/preview.html"))

    def test_archetype_index_routes_exactly_thirty_three_archetypes(self) -> None:
        module_dir = SKILL_ROOT / "references" / "archetypes"
        modules = sorted(module_dir.glob("*.md"))
        self.assertEqual(7, len(modules))
        rows = [
            line
            for path in modules
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith("| ") and not line.startswith("| Arketip")
            and not line.startswith("|---")
        ]
        self.assertEqual(33, len(rows))
        index = read("references/product-archetypes.md")
        for path in modules:
            self.assertIn(path.name, index)
        self.assertNotIn("phase-role-archetypes.md", index)

    def test_long_markdown_regression_suite_was_replaced_by_executable_routing(self) -> None:
        regressions = SKILL_ROOT / "references" / "regressions"
        self.assertFalse(regressions.exists() and any(regressions.iterdir()))
        routing = read("references/regression-cases.md")
        for fixture in (
            "decomposition-cases.json",
            "forward-source-cases.json",
            "test_preview_contract.py",
            "test_publish_tools.py",
        ):
            self.assertIn(fixture, routing)

    def test_preview_template_is_read_only_and_has_compact_content(self) -> None:
        template = read("templates/preview.html")
        renderer = read("scripts/prepare_preview.py")
        self.assertIn("phase-search", template)
        for required in ("Tümünü genişlet", "Tümünü daralt"):
            self.assertIn(required, renderer)
        self.assertIn("Alt Fazlar", renderer)
        self.assertNotIn("Kapsam özeti", renderer)
        for forbidden in (
            "localStorage",
            "/api/",
            "fetch(",
            "Onayla",
            "Değişiklik gerekli",
            "Kapsam Dışında",
            "source-chips",
        ):
            self.assertNotIn(forbidden, template)
        for forbidden in ("Kapsanan Davranışlar", "Gerçek Önkoşullar"):
            self.assertNotIn(forbidden, renderer)

    def test_output_contract_routes_deterministic_and_transactional_tools(self) -> None:
        output = read("references/output-templates.md")
        for required in (
            "index.html",
            "prepare_preview.py",
            "publish_phase_contexts.py",
            "NN-<stable-phase-id>",
            "previewRevision",
            "--approved-preview-revision",
            "Başarılı yayım",
        ):
            self.assertIn(required, output)
        self.assertTrue((SKILL_ROOT / "scripts/prepare_preview.py").is_file())
        self.assertTrue((SKILL_ROOT / "scripts/preview_contract.py").is_file())
        self.assertTrue((SKILL_ROOT / "scripts/phase_context_contract.py").is_file())
        self.assertTrue((SKILL_ROOT / "scripts/publish_phase_contexts.py").is_file())
        for forbidden in (
            "<!-- workflow-phase-mapper",
            "Yetkili kaynaklar",
            "Doğrudan önkoşullar",
            "Tetikleyici/amaç",
            "Auth/sahiplik",
            "Hata ve recovery",
        ):
            self.assertNotIn(forbidden, output)
        for obsolete in (
            "scripts/prepare_review.py",
            "scripts/review_contract.py",
            "scripts/review_server.py",
            "templates/review.html",
            "tests/test_review_contract.py",
            "tests/test_review_server.py",
            "tests/dom_contract_runner.mjs",
        ):
            self.assertFalse((SKILL_ROOT / obsolete).exists(), msg=obsolete)

    def test_structured_regression_manifests_have_unique_cases(self) -> None:
        for name in (
            "decomposition-cases.json",
            "forward-source-cases.json",
        ):
            manifest = json.loads(read(f"tests/{name}"))
            ids = [case["id"] for case in manifest["cases"]]
            self.assertEqual(len(ids), len(set(ids)), msg=name)

    def test_runtime_markdown_links_resolve(self) -> None:
        for source in (SKILL_ROOT / "SKILL.md", *sorted((SKILL_ROOT / "references").rglob("*.md"))):
            links = re.findall(r"\[[^\]]+\]\(([^)#]+)", source.read_text(encoding="utf-8"))
            for target in links:
                with self.subTest(source=source.relative_to(SKILL_ROOT), target=target):
                    self.assertTrue((source.parent / target).resolve().exists())

    def test_no_tautological_saved_output_fixtures_remain(self) -> None:
        for obsolete in (
            "tests/behavior-cases.json",
            "tests/phase-scenarios.json",
            "tests/phase-scenario-outputs.json",
        ):
            self.assertFalse((SKILL_ROOT / obsolete).exists(), msg=obsolete)

    def test_forward_suite_has_generalized_isolated_source_cases(self) -> None:
        manifest = json.loads(read("tests/forward-source-cases.json"))
        self.assertGreaterEqual(len(manifest["cases"]), 8)
        runner = read("scripts/run_forward_tests.py")
        for required in ("--ephemeral", "--ignore-user-config", "--output-schema"):
            self.assertIn(required, runner)

    def test_runtime_contract_has_no_repository_review_state_surface(self) -> None:
        skill = read("SKILL.md")
        output = read("references/output-templates.md")
        self.assertIn("açık yayınlama onayı", skill)
        self.assertIn("HTML onay, feedback, kalıcı state", output)
        for obsolete in ("review.json", "review-state.json"):
            self.assertNotIn(obsolete, skill)
            self.assertFalse((SKILL_ROOT / obsolete).exists())


if __name__ == "__main__":
    unittest.main()
