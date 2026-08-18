from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parents[1]
CHECKER = PACKAGE_DIR / "scripts" / "check_regressions.py"
REPOSITORY_CASES = PACKAGE_DIR / "evals" / "regression-cases.json"
FORWARD_CASES = PACKAGE_DIR / "evals" / "forward-cases.json"
FORWARD_RUNNER = PACKAGE_DIR / "scripts" / "run_forward_evals.py"


def run_checker(
    case_file: Path, *extra_args: str | Path
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(CHECKER),
            str(case_file),
            *(str(argument) for argument in extra_args),
        ],
        check=False,
        capture_output=True,
        text=True,
    )


class RegressionDatasetTests(unittest.TestCase):
    def data(self) -> dict[str, object]:
        return json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))

    def test_package_layers_and_runtime_pointers_are_explicit(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8")
        runtime_targets = {
            target
            for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", skill)
            if not target.startswith(("http://", "https://", "#"))
        }
        reference_files = set((PACKAGE_DIR / "references").iterdir())

        self.assertTrue(runtime_targets)
        self.assertTrue(all(target.startswith("references/") for target in runtime_targets))
        self.assertTrue(all(path.suffix == ".md" for path in reference_files))
        self.assertEqual(
            {(PACKAGE_DIR / target).resolve() for target in runtime_targets},
            {path.resolve() for path in reference_files},
        )

        context = (PACKAGE_DIR / "CONTEXT.md").read_text(encoding="utf-8")
        context_targets = {
            target
            for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", context)
            if not target.startswith(("http://", "https://", "#"))
        }
        self.assertTrue(runtime_targets.issubset(context_targets))
        self.assertTrue(
            {
                "SKILL.md",
                "agents/openai.yaml",
                "evals/regression-cases.json",
                "evals/forward-cases.json",
                "docs/forward-evaluation-protocol.md",
            }.issubset(context_targets)
        )

    def test_every_runtime_step_has_one_completion_criterion(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8")
        sections = re.findall(
            r"(?ms)^## ([1-8])\. .*?(?=^## (?:[1-8]\. |Sessiz Kalite Kapısı))",
            skill,
        )
        self.assertEqual(sections, [str(index) for index in range(1, 9)])

        for index in range(1, 9):
            following = f"{index + 1}\\. " if index < 8 else "Sessiz Kalite Kapısı"
            section = re.search(
                rf"(?ms)^## {index}\. .*?(?=^## (?:{following}))",
                skill,
            )
            self.assertIsNotNone(section)
            self.assertEqual(section.group(0).count("**Tamamlanma ölçütü:**"), 1)

    def test_conditional_rules_have_single_runtime_owners(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8").casefold()
        discovery = (
            PACKAGE_DIR / "references/discovery-intent-boundary.md"
        ).read_text(encoding="utf-8").casefold()
        source_boundary = (
            PACKAGE_DIR / "references/downstream-skill-boundary.md"
        ).read_text(encoding="utf-8").casefold()

        self.assertIn("karar uzayını keşfetmeyi", skill)
        self.assertNotIn("dosya uzantısı", discovery)
        self.assertNotIn("keşif yapma", discovery)
        self.assertEqual(source_boundary.count("**kaynak ayrıntısı aktarım kuralı:**"), 1)
        self.assertNotIn("**kaynak ayrıntısı aktarım kuralı:**", skill)
        self.assertNotIn("çözülmüş yolu yaz", skill)
        self.assertIn("birden çok bağımsız karar yuvasını", skill)
        self.assertIn("kapsanmayan bağımsız maddi bağ kalmadığında", skill)
        self.assertIn("yalnız seçilmiş veya geniş yetkili olması", skill)
        self.assertIn("alıcı açısından maddi anlamını", skill)

    def test_runtime_contract_does_not_name_evaluation_scenarios(self) -> None:
        runtime = "\n".join(
            path.read_text(encoding="utf-8").casefold()
            for path in (PACKAGE_DIR / "SKILL.md", *(PACKAGE_DIR / "references").glob("*.md"))
        )

        for scenario_name in (
            "co-selected-grill-me-is-enriched-and-delegated",
            "grill-me",
            "checkout-failure",
            "runtime-fixture",
        ):
            with self.subTest(scenario_name=scenario_name):
                self.assertNotIn(scenario_name, runtime)

    def test_runtime_migration_fixture_exercises_dependency_compatibility(self) -> None:
        package = json.loads(
            (
                PACKAGE_DIR / "tests/fixtures/node-project/package.json"
            ).read_text(encoding="utf-8")
        )

        self.assertTrue(package.get("dependencies") or package.get("devDependencies"))

    def test_all_package_markdown_links_resolve(self) -> None:
        for document in PACKAGE_DIR.rglob("*.md"):
            text = document.read_text(encoding="utf-8")
            for raw_target in re.findall(r"\[[^]]+\]\(([^)]+)\)", text):
                target = raw_target.split("#", 1)[0]
                if not target or target.startswith(("http://", "https://", "mailto:")):
                    continue
                with self.subTest(document=document, target=raw_target):
                    self.assertTrue((document.parent / target).resolve().exists())

    def test_repository_case_set_passes(self) -> None:
        result = run_checker(REPOSITORY_CASES)
        data = self.data()
        case_count = len(data["cases"])
        saved_count = sum(
            1 for case in data["cases"] if isinstance(case.get("saved_output"), str)
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            f"PASS {case_count} regression case(s); {saved_count} saved output(s)",
            result.stdout,
        )

    def test_core_behavior_groups_are_protected(self) -> None:
        cases = self.data()["cases"]
        protects = {item for case in cases for item in case["protects"]}

        self.assertTrue(
            {
                "çağrı-eşdeğerliği",
                "negatif-aktivasyon",
                "çıktı-sözleşmesi",
                "kaynak-inceleme",
                "kanıtlı-derinleştirme",
                "araştırma",
                "downstream-sınırı",
                "pasif-devir-yeterliliği",
                "karar-modu",
                "karar-cephesi",
                "sonuç-odaklı-sınır",
                "zorunlu-kapsam-türevi",
                "maddi-gereksinim-koruması",
                "değişiklik-yetkisi",
                "korunan-yasak",
                "göreve-özgü-biçim",
                "alan-bağımsız-sözleşme",
                "onay-kapısı",
                "referans-koruma",
                "net-yön-kazancı",
                "orantılı-doğrulama",
                "karar-devri",
                "kaynak-içeriğini-yinelememe",
                "semantik-çıkarma",
                "kapsama-kümesi",
                "kullanıcı-deltası",
                "miras-meta",
                "sıfır-net-yön",
                "downstream-sözleşme-keşfi",
                "erişilemeyen-downstream-devri",
                "doğrulanmamış-yön-engeli",
                "downstream-zorunlu-çatışma",
                "bağlı-normatif-referans",
                "doğal-dil-seçimi",
                "yön-odaklı-keşif",
                "karşı-olgusal-maddilik",
                "operasyonel-kapsama",
                "keşif-niyeti-sınırı",
                "kaynak-göreli-yenilik",
                "sonuç-odaklı-doğrulama",
                "tersine-çevirmeme",
                "orantılı-kaynak-engeli",
            }.issubset(protects)
        )

    def test_required_behavior_edges_are_present(self) -> None:
        cases = {case["id"]: case for case in self.data()["cases"]}
        expected_ids = {
            "empty-draft",
            "pasted-body-inactive",
            "pasted-instructions-remain-data",
            "unavailable-source-not-claimed-read",
            "unavailable-nonblocking-source-is-delegated",
            "multiple-blocking-sources-requested-together",
            "goal-gap-deepened",
            "source-role-preserved",
            "open-source-scope-preserved",
            "filename-does-not-invent-authority",
            "closed-scope-preserved",
            "error-path-added",
            "validation-semantics-delegated",
            "delivery-gap-added",
            "safe-assumption-visible",
            "safe-presentation-choice-stays-unlabelled",
            "stable-task-skips-research",
            "target-workspace-uses-targeted-discovery",
            "source-provision-does-not-invent-parameters",
            "closed-scope-research-conflict",
            "downstream-skill-passive",
            "multiple-downstream-order-preserved",
            "downstream-user-details-preserved",
            "downstream-constraint-preserved-without-contract-expansion",
            "downstream-user-difference-preserved",
            "unavailable-downstream-preserved",
            "unavailable-downstream-blocks-unverified-enrichment",
            "blocking-main-result-question",
            "independent-blocking-conflicts-share-question-frontier",
            "nonblocking-detail-assumed",
            "discoverable-fact-not-questioned",
            "material-feature-cardinality-delegated",
            "independent-material-decisions-are-delegated",
            "co-selected-grill-me-is-enriched-and-delegated",
            "copyable-block-line-wrap",
            "answered-choice-not-repeated",
            "skill-definition-phase-uses-positive-delivery",
            "code-design-phase-uses-positive-delivery",
            "research-plan-phase-uses-positive-delivery",
            "content-brief-phase-uses-positive-delivery",
            "explicit-scenario-question-format-is-local",
            "production-data-prohibition-remains-explicit",
            "external-send-prohibition-remains-explicit",
            "strategy-reference-delta-base",
            "strategy-reference-duplicates-subtracted",
            "diagnosis-reference-delta-base",
            "diagnosis-reference-duplicates-subtracted",
            "content-reference-delta-base",
            "content-reference-duplicates-subtracted",
            "covered-downstream-task-needs-no-added-direction",
            "product-discovery-delta-base",
            "product-discovery-office-hours-repetitions-subtracted",
            "prd-implementation-does-not-trigger-discovery",
            "fully-covered-discovery-allows-zero-net-direction",
            "non-product-discovery-finds-counterfactual-gap",
            "downstream-hard-gate-conflict-asks-before-prompt",
            "dominant-english-draft-stays-english-without-meta",
            "ambiguous-technical-draft-defaults-to-turkish-without-meta",
        }

        self.assertTrue(expected_ids.issubset(cases))
        self.assertEqual(cases["empty-draft"]["expected_mode"], "input_request")
        self.assertEqual(
            cases["downstream-constraint-preserved-without-contract-expansion"][
                "expected_mode"
            ],
            "final",
        )
        self.assertEqual(
            cases["independent-material-decisions-are-delegated"]["expected_mode"],
            "final",
        )
        self.assertEqual(
            cases["copyable-block-line-wrap"]["properties"][
                "max_prompt_line_chars"
            ],
            95,
        )
        self.assertIn(
            "kaynak-otoritesi", cases["open-source-scope-preserved"]["protects"]
        )
        self.assertNotIn(
            "gereksinimleri esas al",
            cases["open-source-scope-preserved"]["saved_output"],
        )
        self.assertIn("karar-devri", cases["safe-assumption-visible"]["protects"])

    def test_scope_language_is_domain_independent_and_authority_aware(self) -> None:
        cases = {case["id"]: case for case in self.data()["cases"]}
        positive_cases = {
            "skill-definition-phase-uses-positive-delivery",
            "code-design-phase-uses-positive-delivery",
            "research-plan-phase-uses-positive-delivery",
            "content-brief-phase-uses-positive-delivery",
        }

        for case_id in positive_cases:
            with self.subTest(case=case_id):
                case = cases[case_id]
                self.assertIn("sonuç-odaklı-sınır", case["protects"])
                self.assertNotIn("bu aşamada", case["saved_output"].casefold())

        design = cases["skill-definition-phase-uses-positive-delivery"]
        self.assertNotIn("örnek senaryo", design["saved_output"].casefold())
        self.assertIn("onay-kapısı", design["protects"])
        self.assertIn("onayıma sun", design["input"].casefold())
        for requirement in (
            "product design pluginini davranış ve iş akışı referansı",
            "prd'den prototip üretme",
            "izlenmesini",
            "kullanıcı akışlarına",
            "bilgi mimarisine",
            "ux ile ui kararlarının tutarlılığını",
            "üç alternatif",
            "canlı url klonlama",
        ):
            with self.subTest(requirement=requirement):
                self.assertIn(requirement, design["required_contains_i"])
                self.assertIn(requirement, design["saved_output"].casefold())

        for case_id in positive_cases - {"skill-definition-phase-uses-positive-delivery"}:
            with self.subTest(no_approval_gate=case_id):
                self.assertIn("önce", cases[case_id]["input"].casefold())
                forbidden = cases[case_id]["forbidden_contains_i"]
                self.assertIn("onay", forbidden)
                self.assertIn("approval", forbidden)
                self.assertIn("yanıtımı bekle", forbidden)

        explicit_format = cases["explicit-scenario-question-format-is-local"]
        self.assertIn("örnek senaryoyla", explicit_format["saved_output"].casefold())

        no_write = cases[
            "downstream-constraint-preserved-without-contract-expansion"
        ]
        self.assertIn("dosya oluşturma", no_write["saved_output"].casefold())
        self.assertIn("değişiklik-yetkisi", no_write["protects"])
        self.assertIn("korunan-yasak", no_write["protects"])
        self.assertIn("pasif-devir-yeterliliği", no_write["protects"])
        for expansion in (
            "dizin oluşturma",
            "hiçbir yazma",
            "mevcut dosyaları değiştirme",
            "yapılmış gibi",
            "hedef proje",
            "ayrıntı düzeyi",
            "erişilebilir görev",
            "mimari sınır",
            "giriş noktaları",
            "uydurma",
        ):
            with self.subTest(forbidden_expansion=expansion):
                self.assertIn(expansion, no_write["forbidden_contains_i"])
                self.assertNotIn(expansion, no_write["saved_output"].casefold())

        production = cases["production-data-prohibition-remains-explicit"]
        self.assertIn("production verisini silme", production["saved_output"].casefold())
        self.assertIn("korunan-yasak", production["protects"])

        external = cases["external-send-prohibition-remains-explicit"]
        self.assertIn(
            "müşterilere gönderme veya yayımlama",
            external["saved_output"].casefold(),
        )
        self.assertIn("korunan-yasak", external["protects"])

        frontier = cases["independent-blocking-conflicts-share-question-frontier"]
        self.assertIn("karar-cephesi", frontier["protects"])
        self.assertIn("1. bu turun ana sonucu", frontier["saved_output"].casefold())
        self.assertIn("2. nihai promptun dili", frontier["saved_output"].casefold())

    def test_equivalence_group_covers_every_supported_call_form(self) -> None:
        members = {
            case["id"]
            for case in self.data()["cases"]
            if case.get("equivalence_group") == "source-backed-release-brief"
        }

        self.assertEqual(
            members,
            {
                "equivalent-explicit-prefix",
                "equivalent-explicit-suffix",
                "equivalent-self-link",
                "equivalent-self-link-with-transform",
                "equivalent-ui-selection",
            },
        )

    def test_semantic_subtraction_is_cross_domain_and_meta_clean(self) -> None:
        cases = {case["id"]: case for case in self.data()["cases"]}
        pairs = (
            ("strategy-reference-delta-base", "strategy-reference-duplicates-subtracted"),
            ("diagnosis-reference-delta-base", "diagnosis-reference-duplicates-subtracted"),
            ("content-reference-delta-base", "content-reference-duplicates-subtracted"),
            (
                "product-discovery-delta-base",
                "product-discovery-office-hours-repetitions-subtracted",
            ),
        )

        for base_id, repeated_id in pairs:
            with self.subTest(group=base_id):
                base = cases[base_id]
                repeated = cases[repeated_id]
                self.assertEqual(base["saved_output"], repeated["saved_output"])
                self.assertGreater(len(repeated["input"]), len(base["input"]))
                self.assertIn("semantik-çıkarma", repeated["protects"])
                self.assertNotIn("türkçe yürüt", repeated["saved_output"].casefold())

        product = cases["product-discovery-delta-base"]
        self.assertIn("karşı-olgusal-maddilik", product["protects"])
        self.assertIn("operasyonel-kapsama", product["protects"])
        self.assertIn("kaynak-göreli-yenilik", product["protects"])
        self.assertIn("önceki gerekçeyi koruma", product["saved_output"].casefold())
        for repeated_phrase in product["forbidden_contains_i"]:
            with self.subTest(product_repetition=repeated_phrase):
                self.assertNotIn(
                    repeated_phrase.casefold(), product["saved_output"].casefold()
                )

        implementation = cases["prd-implementation-does-not-trigger-discovery"]
        self.assertIn("keşif-niyeti-sınırı", implementation["protects"])
        for discovery_padding in implementation["forbidden_contains_i"]:
            with self.subTest(discovery_padding=discovery_padding):
                self.assertNotIn(
                    discovery_padding.casefold(),
                    implementation["saved_output"].casefold(),
                )

        covered_discovery = cases[
            "fully-covered-discovery-allows-zero-net-direction"
        ]
        self.assertIn("sıfır-net-yön", covered_discovery["protects"])
        self.assertIn("operasyonel-kapsama", covered_discovery["protects"])
        self.assertIn("yeniden oku", covered_discovery["forbidden_contains_i"])
        for padding in covered_discovery["forbidden_contains_i"]:
            with self.subTest(covered_discovery_padding=padding):
                self.assertNotIn(
                    padding.casefold(), covered_discovery["saved_output"].casefold()
                )

        non_product = cases["non-product-discovery-finds-counterfactual-gap"]
        self.assertIn("alan-bağımsız-sözleşme", non_product["protects"])
        self.assertIn("karşı-olgusal-maddilik", non_product["protects"])
        self.assertIn(
            "sayısal görünen kimliklerin", non_product["saved_output"].casefold()
        )
        for product_lens in non_product["forbidden_contains_i"]:
            with self.subTest(non_product_lens=product_lens):
                self.assertNotIn(
                    product_lens.casefold(), non_product["saved_output"].casefold()
                )

        discovery_skill = (
            PACKAGE_DIR / "tests/fixtures/downstream-product-discovery/SKILL.md"
        ).read_text(encoding="utf-8")
        discovery_contract = (
            PACKAGE_DIR
            / "tests/fixtures/downstream-product-discovery/references/runtime-contract.md"
        ).read_text(encoding="utf-8")
        self.assertIn("references/runtime-contract.md", discovery_skill)
        self.assertIn("actual demand", discovery_skill)
        self.assertIn("one at a time", discovery_contract)

        covered = cases["covered-downstream-task-needs-no-added-direction"]
        self.assertIn("sıfır-net-yön", covered["protects"])
        for padding in covered["forbidden_contains_i"]:
            with self.subTest(padding=padding):
                self.assertNotIn(padding.casefold(), covered["saved_output"].casefold())

        strategy_skill = (
            PACKAGE_DIR
            / "tests/fixtures/downstream-strategy-review/SKILL.md"
        ).read_text(encoding="utf-8")
        normative = (
            PACKAGE_DIR
            / "tests/fixtures/downstream-strategy-review/references/runtime-contract.md"
        ).read_text(encoding="utf-8")
        illustrative = (
            PACKAGE_DIR
            / "tests/fixtures/downstream-strategy-review/examples/sample-scorecard.md"
        ).read_text(encoding="utf-8")
        self.assertIn("references/runtime-contract.md", strategy_skill)
        self.assertIn("examples/sample-scorecard.md", strategy_skill)
        self.assertIn("one at a time", normative)
        self.assertIn("pirate metrics", illustrative)
        for case_id in (
            "strategy-reference-delta-base",
            "strategy-reference-duplicates-subtracted",
            "covered-downstream-task-needs-no-added-direction",
        ):
            with self.subTest(nonnormative_example=case_id):
                output = cases[case_id]["saved_output"].casefold()
                self.assertNotIn("pirate metrics", output)
                self.assertNotIn("freemium", output)

    def test_unavailable_conflicting_and_language_edges_match_contract(self) -> None:
        cases = {case["id"]: case for case in self.data()["cases"]}
        unavailable = cases["unavailable-downstream-preserved"]
        self.assertIn("erişilebilir olduktan sonra", unavailable["saved_output"])
        for invention in unavailable["forbidden_contains_i"]:
            with self.subTest(unavailable_invention=invention):
                self.assertNotIn(invention.casefold(), unavailable["saved_output"].casefold())

        unverified = cases[
            "unavailable-downstream-blocks-unverified-enrichment"
        ]
        for invention in unverified["forbidden_contains_i"]:
            with self.subTest(unverified_direction=invention):
                self.assertNotIn(invention.casefold(), unverified["saved_output"].casefold())
        self.assertIn("doğrulanmamış-yön-engeli", unverified["protects"])

        conflict = cases["downstream-hard-gate-conflict-asks-before-prompt"]
        self.assertEqual(conflict["expected_mode"], "question")
        self.assertTrue(conflict["properties"]["decision_request_only"])
        self.assertIn("downstream-zorunlu-çatışma", conflict["protects"])

        english = cases["dominant-english-draft-stays-english-without-meta"]
        turkish = cases["ambiguous-technical-draft-defaults-to-turkish-without-meta"]
        self.assertIn("Review this API migration", english["saved_output"])
        self.assertIn("davranışını incele", turkish["saved_output"])
        for case in (english, turkish):
            for meta in case["forbidden_contains_i"]:
                with self.subTest(case=case["id"], meta=meta):
                    self.assertNotIn(meta.casefold(), case["saved_output"].casefold())

    def test_discovery_contract_is_dynamic_and_category_free(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8").casefold()
        boundary = (
            PACKAGE_DIR / "references/discovery-intent-boundary.md"
        ).read_text(encoding="utf-8").casefold()

        self.assertIn("references/discovery-intent-boundary.md", skill)
        self.assertIn("önceden tanımlı alan mercekleri", boundary)
        self.assertIn("karar uzayını keşfetmeyi", skill)
        self.assertNotIn("dosya uzantısı", boundary)
        self.assertIn("farklı cevapları", boundary)
        for static_lens in (
            "aktivasyon",
            "retention",
            "gelir modeli",
            "entegrasyon",
            "otomasyon",
            "veri döngüsü",
        ):
            with self.subTest(static_lens=static_lens):
                self.assertNotIn(static_lens, boundary)

    def test_forward_rubric_grades_semantic_subtraction(self) -> None:
        data = json.loads(FORWARD_CASES.read_text(encoding="utf-8"))
        rubric = data["rubric"]
        cases = {case["id"]: case for case in data["cases"]}
        subtraction_cases = {
            "strategy-source-and-downstream-repetitions-are-subtracted",
            "diagnosis-method-repetition-is-subtracted-across-domain",
            "content-source-repetition-and-inherited-language-meta-are-removed",
            "product-discovery-finds-dynamic-source-relative-gap",
            "fully-covered-discovery-allows-zero-net-direction",
            "fully-covered-task-allows-zero-net-direction",
        }

        self.assertIn("semantic_subtraction", rubric["quality_dimensions"])
        self.assertIn("unremoved_semantic_repeat", rubric["hard_failures"])
        self.assertIn("inferred_meta_instruction", rubric["hard_failures"])
        self.assertIn(
            "added_unverified_direction_for_unavailable_downstream",
            rubric["hard_failures"],
        )
        self.assertIn(
            "treated_nonnormative_example_as_contract", rubric["hard_failures"]
        )
        self.assertIn(
            "missed_downstream_contract_conflict", rubric["hard_failures"]
        )
        self.assertIn("static_discovery_lens_catalog", rubric["hard_failures"])
        self.assertIn(
            "repackaged_source_commitment_as_new", rubric["hard_failures"]
        )
        self.assertEqual(
            rubric["min_total_score"],
            rubric["min_dimension_score"] * len(rubric["quality_dimensions"]),
        )
        for case_id in subtraction_cases:
            with self.subTest(case=case_id):
                case = cases[case_id]
                self.assertIn("semantic_subtraction", case["quality_focus"])
                self.assertIn("downstream_contract", case["required_tools"])
                self.assertGreaterEqual(len(case["fixtures"]), 2)

        strategy = cases[
            "strategy-source-and-downstream-repetitions-are-subtracted"
        ]
        self.assertIn("linked-normative-contract", strategy["risk_areas"])
        self.assertEqual(len(strategy["fixtures"]), 4)
        unavailable = cases[
            "unavailable-downstream-preserves-only-verified-user-delta"
        ]
        self.assertEqual(unavailable["fixtures"], [])
        self.assertIn("unavailable-downstream-handoff", unavailable["risk_areas"])
        conflict = cases["downstream-hard-gate-conflict-enters-question-mode"]
        self.assertEqual(conflict["expected_modes"], ["question"])
        self.assertIn("downstream-contract-conflict", conflict["risk_areas"])
        discovery = cases["product-discovery-finds-dynamic-source-relative-gap"]
        self.assertIn("dynamic-decision-space", discovery["risk_areas"])
        self.assertIn("discovery-intent-boundary", discovery["risk_areas"])
        implementation = cases["prd-artifact-alone-does-not-trigger-discovery"]
        self.assertNotIn("downstream_contract", implementation["required_tools"])
        self.assertIn("discovery-intent-boundary", implementation["risk_areas"])
        covered_discovery = cases[
            "fully-covered-discovery-allows-zero-net-direction"
        ]
        self.assertIn("zero-net-direction", covered_discovery["risk_areas"])
        self.assertIn("operational-coverage", covered_discovery["risk_areas"])
        non_product = cases["non-product-discovery-finds-counterfactual-gap"]
        self.assertNotIn("downstream_contract", non_product["required_tools"])
        self.assertIn("dynamic-decision-space", non_product["risk_areas"])

        co_selected = cases["co-selected-grill-me-is-delegated-and-directed"]
        co_selected_requirements = " ".join(co_selected["hard_requirements"]).casefold()
        self.assertIn("birbirinden bağımsız en az üç", co_selected_requirements)
        self.assertNotIn("güven, sürtünme", co_selected_requirements)

        local_source = cases["local-task-source-directs-without-restatement"]
        local_source_requirements = " ".join(local_source["hard_requirements"]).casefold()
        self.assertIn("kullanıcının verdiği kaynak referansını", local_source_requirements)
        self.assertIn("mutlak yola çevrilmek zorunda değildir", local_source_requirements)

    def test_directional_contract_replaces_noop_and_product_questions(self) -> None:
        cases = {case["id"]: case for case in self.data()["cases"]}
        simple = cases["simple-final-contract"]
        cardinality = cases["material-feature-cardinality-delegated"]

        self.assertNotEqual(
            simple["saved_output"],
            "```text\nHaftalık ekip güncellemesi yaz.\n```",
        )
        self.assertIn("net-yön-kazancı", simple["protects"])
        self.assertEqual(cardinality["expected_mode"], "final")
        self.assertIn("karar-devri", cardinality["protects"])
        self.assertNotIn("\nA. ", cardinality["saved_output"])

    def test_active_cases_have_outputs_and_negative_cases_have_no_output_contract(self) -> None:
        output_fields = {
            "expected_mode",
            "saved_output",
            "required_contains",
            "required_contains_i",
            "forbidden_contains",
            "forbidden_contains_i",
            "required_regex",
            "forbidden_regex",
            "properties",
        }
        for case in self.data()["cases"]:
            with self.subTest(case=case["id"]):
                if case["expected_activation"]:
                    self.assertIsInstance(case.get("saved_output"), str)
                    self.assertTrue(case["saved_output"])
                else:
                    self.assertFalse(output_fields & set(case))

    def test_dataset_exercises_all_four_output_modes(self) -> None:
        modes = {
            case.get("expected_mode")
            for case in self.data()["cases"]
            if case["expected_activation"]
        }

        self.assertEqual(
            modes, {"final", "question", "input_request", "source_request"}
        )

    def test_declared_protections_are_covered(self) -> None:
        data = self.data()
        covered = {item for case in data["cases"] for item in case["protects"]}

        self.assertTrue(set(data["required_protections"]).issubset(covered))

    def test_forward_case_set_and_all_risk_areas_pass(self) -> None:
        result = run_checker(REPOSITORY_CASES, "--forward-cases", FORWARD_CASES)
        data = json.loads(FORWARD_CASES.read_text(encoding="utf-8"))
        covered = {item for case in data["cases"] for item in case["risk_areas"]}

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            f"PASS {len(data['cases'])} forward case definition(s)", result.stdout
        )
        self.assertEqual(set(data["required_risk_areas"]), covered)
        self.assertTrue(all(case["required_runs"] == 2 for case in data["cases"]))
        self.assertTrue(all("saved_output" not in case for case in data["cases"]))

    def test_forward_fixtures_exist_inside_package(self) -> None:
        data = json.loads(FORWARD_CASES.read_text(encoding="utf-8"))

        for case in data["cases"]:
            for fixture in case["fixtures"]:
                with self.subTest(case=case["id"], fixture=fixture):
                    self.assertTrue((PACKAGE_DIR / fixture).is_file())

    def test_malformed_forward_schema_fails_without_traceback(self) -> None:
        data = json.loads(FORWARD_CASES.read_text(encoding="utf-8"))
        data["rubric"]["quality_dimensions"] = 42
        data["cases"][0]["risk_areas"] = [[]]
        data["cases"][0]["invocation"] = []
        data["cases"][0]["capability_profile"] = {}
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "forward-cases.json"
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = run_checker(REPOSITORY_CASES, "--forward-cases", path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("quality_dimensions", result.stderr)
        self.assertIn("risk_areas", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


class RegressionToolTests(unittest.TestCase):
    def write_cases(
        self, directory: Path, cases: list[dict[str, object]], **extra: object
    ) -> Path:
        path = directory / "cases.json"
        protections = sorted(
            {
                item
                for case in cases
                if isinstance(case.get("protects"), list)
                for item in case["protects"]
                if isinstance(item, str)
            }
        )
        path.write_text(
            json.dumps(
                {
                    "version": 2,
                    "required_protections": protections,
                    "cases": cases,
                    **extra,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return path

    def final_case(self, output: str | None = None) -> dict[str, object]:
        return {
            "id": "final-case",
            "invocation": "text",
            "input": "$deep-prompt-builder E-postayı hazırla.",
            "expected_activation": True,
            "expected_mode": "final",
            "saved_output": output
            or "```text\nE-postayı hazırla.\n```",
            "required_contains_i": ["e-posta"],
            "properties": {"final_block_only": True},
            "protects": ["çıktı-sözleşmesi"],
        }

    def question_case(self, output: str) -> dict[str, object]:
        return {
            "id": "question-case",
            "invocation": "text",
            "input": "$deep-prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": output,
            "properties": {
                "decision_request_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["karar-modu"],
        }

    def source_request_case(self, output: str) -> dict[str, object]:
        return {
            "id": "source-request-case",
            "invocation": "text",
            "input": "$deep-prompt-builder Yalnız private://roadmap kaynağını kullan.",
            "expected_activation": True,
            "expected_mode": "source_request",
            "saved_output": output,
            "properties": {"source_request_only": True},
            "protects": ["kaynak-isteği"],
        }

    def test_final_mode_requires_only_one_text_fence(self) -> None:
        case = self.final_case(
            "### Kapsamlı Prompt\n\n```text\nE-postayı hazırla.\n```"
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("only one non-empty text fence", result.stderr)

    def test_final_mode_rejects_overlong_divisible_prompt_line(self) -> None:
        case = self.final_case(
            "```text\n"
            "Bu satır anlamlı boşluklardan bölünebileceği halde doksan beş karakteri "
            "aşacak kadar gereksiz biçimde uzatılmış bir görev talimatıdır.\n```"
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("above max_prompt_line_chars 95", result.stderr)

    def test_indivisible_items_may_exceed_default_line_limit(self) -> None:
        long_url = "https://example.com/" + "a" * 110
        items = {
            "url": long_url,
            "markdown-link": f"[kaynak]({long_url})",
            "file-path": "/tmp/" + "nested-directory/" * 8 + "source.md",
            "inline-code": "`" + "long_identifier_" * 8 + "`",
        }
        for label, item in items.items():
            with self.subTest(item=label), tempfile.TemporaryDirectory() as raw:
                case = self.final_case(f"```text\n{item}\n```")
                case.pop("required_contains_i")
                result = run_checker(self.write_cases(Path(raw), [case]))

            self.assertEqual(result.returncode, 0, result.stderr)

    def test_analysis_language_inside_prompt_is_not_wrapper_leakage(self) -> None:
        case = self.final_case(
            "```text\nAnaliz: Veriyi sınıflandır ve özetle.\n```"
        )
        case.pop("required_contains_i")
        case["properties"]["no_public_analysis"] = True
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_question_mode_accepts_ordered_options_and_reasoned_recommendation(self) -> None:
        case = self.question_case(
            "1. Ana sonuç ne olmalı?\n\n"
            "A. Yalnız inceleme\n"
            "B. Doğrudan uygulama\n\n"
            "Önerim: A. Gerekçe: Önce riski görünür kılar."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_question_mode_accepts_wrapped_rationale(self) -> None:
        case = self.question_case(
            "1. Bir kayıt kaç etiket taşıyabilsin?\n\n"
            "A. Birden fazla etiket\n"
            "B. Yalnızca bir etiket\n\n"
            "Önerim: A.\n"
            "Gerekçe: Birden fazla etiket farklı bağlamlarda filtrelemeyi sağlar ve\n"
            "  sonradan veri modeli değişikliği gerektirme olasılığını azaltır."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_question_mode_rejects_unnumbered_single_decision(self) -> None:
        case = self.question_case(
            "Ana sonuç ne olmalı?\n\n"
            "A. Yalnız inceleme\n"
            "B. Doğrudan uygulama\n\n"
            "Önerim: A. Gerekçe: Önce riski görünür kılar."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("sequentially numbered decision frontier", result.stderr)

    def test_question_mode_accepts_numbered_independent_frontier(self) -> None:
        case = self.question_case(
            "1. Bir kayıt kaç etiket taşıyabilmeli?\n\n"
            "A. Birden fazla etiket\n"
            "B. Yalnız bir etiket\n\n"
            "Önerim: A. Gerekçe: Çoklu sınıflandırmayı destekler.\n\n"
            "2. Etiketleri kimler görebilmeli?\n\n"
            "A. Yalnız oluşturan kullanıcı\n"
            "B. İçeriğe erişebilen herkes\n\n"
            "Önerim: A. Gerekçe: Daha dar görünürlüğü korur."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_question_mode_rejects_bad_options_and_unselected_recommendation(self) -> None:
        case = self.question_case(
            "1. Ana sonuç ne olmalı?\n\n"
            "A. Yalnız inceleme\n"
            "C. Doğrudan uygulama\n\n"
            "Önerim: İnceleme. Gerekçe: Daha güvenli."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("ordered A/B", result.stderr)
        self.assertIn("recommend one listed option", result.stderr)

    def test_question_mode_rejects_extra_wrapper_text(self) -> None:
        case = self.question_case(
            "1. Ana sonuç ne olmalı?\n\n"
            "A. Yalnız inceleme\n"
            "B. Doğrudan uygulama\n\n"
            "Önerim: A. Gerekçe: Önce riski görünür kılar.\n\n"
            "Analiz: Bu ek bölüm sözleşme dışıdır."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("must contain only", result.stderr)

    def test_question_mode_rejects_unlabelled_text_after_rationale(self) -> None:
        case = self.question_case(
            "1. Ana sonuç ne olmalı?\n\n"
            "A. Yalnız inceleme\n"
            "B. Doğrudan uygulama\n\n"
            "Önerim: A.\n"
            "Gerekçe: Önce riski görünür kılar.\n"
            "Gizli analiz burada sızıyor."
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("must contain only", result.stderr)

    def test_input_request_requires_canonical_sentence(self) -> None:
        case = {
            "id": "empty",
            "invocation": "text",
            "input": "$deep-prompt-builder",
            "expected_activation": True,
            "expected_mode": "input_request",
            "saved_output": "Lütfen taslak paylaş.",
            "properties": {"input_request_only": True},
            "protects": ["boş-taslak"],
        }
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("input request must be exactly", result.stderr)

    def test_source_request_requires_canonical_sentence_and_source_bullets(self) -> None:
        valid = self.source_request_case(
            "Promptu hazırlamak için şu kaynaklara erişmem gerekiyor. Lütfen erişilebilir "
            "hâle getir veya içeriklerini paylaş:\n\n- private://roadmap\n- private://budget"
        )
        invalid = self.source_request_case(
            "Hangi kaynağı paylaşacaksın?\n\nA. private://roadmap\nB. Hiçbiri"
        )
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            valid_result = run_checker(self.write_cases(directory, [valid]))
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            invalid_result = run_checker(self.write_cases(directory, [invalid]))

        self.assertEqual(valid_result.returncode, 0, valid_result.stderr)
        self.assertEqual(invalid_result.returncode, 1)
        self.assertIn("canonical source-request sentence", invalid_result.stderr)
        self.assertIn("bullet source list", invalid_result.stderr)

    def test_source_request_rejects_empty_bullet(self) -> None:
        case = self.source_request_case(
            "Promptu hazırlamak için şu kaynaklara erişmem gerekiyor. Lütfen erişilebilir "
            "hâle getir veya içeriklerini paylaş:\n\n- \n- private://roadmap"
        )
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("non-empty bullet", result.stderr)

    def test_declared_required_protection_must_be_covered(self) -> None:
        case = self.final_case()
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(
                self.write_cases(
                    Path(raw), [case], required_protections=["eksik-dal"]
                )
            )

        self.assertEqual(result.returncode, 1)
        self.assertIn("uncovered protection", result.stderr)

    def test_malformed_json_fails_without_traceback(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "cases.json"
            path.write_text("{broken", encoding="utf-8")
            result = run_checker(path)

        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid JSON", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_unknown_top_level_case_and_property_keys_fail(self) -> None:
        case = self.final_case()
        case["mystery"] = True
        case["properties"]["mystery"] = True
        with tempfile.TemporaryDirectory() as raw:
            path = self.write_cases(Path(raw), [case], mystery=True)
            result = run_checker(path)

        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown top-level key", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

        with tempfile.TemporaryDirectory() as raw:
            path = self.write_cases(Path(raw), [case])
            result = run_checker(path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("unknown case key", result.stderr)
        self.assertIn("unknown property", result.stderr)

    def test_bad_field_types_duplicate_ids_and_regex_fail_without_traceback(self) -> None:
        first = self.final_case()
        first["protects"] = 42
        first["required_regex"] = ["["]
        second = self.final_case()
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [first, second]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("protects must be an array", result.stderr)
        self.assertIn("invalid regex", result.stderr)
        self.assertIn("duplicate case id", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_active_case_requires_saved_output(self) -> None:
        case = self.final_case()
        case.pop("saved_output")
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("active cases must define", result.stderr)

    def test_selected_skills_require_ui_invocation_and_unique_names(self) -> None:
        invalid = self.final_case()
        invalid["selected_skills"] = ["deep-prompt-builder", "deep-prompt-builder"]
        with tempfile.TemporaryDirectory() as raw:
            invalid_result = run_checker(self.write_cases(Path(raw), [invalid]))

        self.assertEqual(invalid_result.returncode, 1)
        self.assertIn("selected_skills must not contain duplicates", invalid_result.stderr)
        self.assertIn("selected_skills requires ui_selected", invalid_result.stderr)

        valid = self.final_case()
        valid["invocation"] = "ui_selected"
        valid["selected_skills"] = ["deep-prompt-builder", "grill-me"]
        with tempfile.TemporaryDirectory() as raw:
            valid_result = run_checker(self.write_cases(Path(raw), [valid]))

        self.assertEqual(valid_result.returncode, 0, valid_result.stderr)

    def test_inactive_case_forbids_mode_output_and_output_properties(self) -> None:
        case = {
            "id": "inactive",
            "invocation": "text",
            "input": "Deep Prompt Builder nedir?",
            "expected_activation": False,
            "expected_mode": "final",
            "saved_output": "not allowed",
            "required_contains": ["x"],
            "properties": {"final_block_only": True},
            "protects": ["negatif-aktivasyon"],
        }
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [case]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("must not define expected_mode", result.stderr)
        self.assertIn("must not define saved_output", result.stderr)
        self.assertIn("output contract field", result.stderr)
        self.assertIn("output properties", result.stderr)

    def test_equivalence_compares_semantics_not_saved_output_text(self) -> None:
        first = self.final_case()
        first["id"] = "first"
        first["equivalence_group"] = "same"
        second = self.final_case(
            "```text\nE-posta metnini hazırla.\n```"
        )
        second["id"] = "second"
        second["equivalence_group"] = "same"
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [first, second]))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_equivalence_rejects_different_deterministic_properties(self) -> None:
        first = self.final_case()
        first["id"] = "first"
        first["equivalence_group"] = "same"
        second = self.final_case()
        second["id"] = "second"
        second["equivalence_group"] = "same"
        second["properties"]["max_prompt_line_chars"] = 95
        with tempfile.TemporaryDirectory() as raw:
            result = run_checker(self.write_cases(Path(raw), [first, second]))

        self.assertEqual(result.returncode, 1)
        self.assertIn("properties", result.stderr)

    def test_results_are_graded_semantically_not_against_saved_output(self) -> None:
        case = self.final_case()
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_cases(directory, [case])
            results_path = directory / "results.json"
            results_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "final-case",
                                "activated": True,
                                "output": (
                                    "```text\n"
                                    "E-posta metnini hazırla.\n```"
                                ),
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            result = run_checker(cases_path, "--results", results_path)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("captured result(s)", result.stdout)

    def test_runner_success_protocol(self) -> None:
        case = self.final_case()
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_cases(directory, [case])
            runner = directory / "runner.py"
            runner.write_text(
                "#!/usr/bin/env python3\n"
                "import json, sys\n"
                "payload = json.load(sys.stdin)\n"
                "assert set(payload) == {'id', 'invocation', 'input'}\n"
                "print(json.dumps({'activated': True, 'output': "
                "'```text\\nE-posta hazırla.\\n```'}))\n",
                encoding="utf-8",
            )
            runner.chmod(0o755)
            result = run_checker(cases_path, "--runner", runner)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_runner_error_invalid_json_timeout_and_missing_file_have_no_traceback(self) -> None:
        case = self.final_case()
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_cases(directory, [case])
            runners = {
                "error.py": "#!/usr/bin/env python3\nimport sys\nsys.exit(7)\n",
                "invalid.py": "#!/usr/bin/env python3\nprint('not json')\n",
                "timeout.py": (
                    "#!/usr/bin/env python3\nimport time\ntime.sleep(2)\n"
                    "print('{}')\n"
                ),
            }
            results: list[subprocess.CompletedProcess[str]] = []
            for name, body in runners.items():
                runner = directory / name
                runner.write_text(body, encoding="utf-8")
                runner.chmod(0o755)
                extra: tuple[str | Path, ...] = ("--runner", runner)
                if name == "timeout.py":
                    extra += ("--timeout-seconds", "1")
                results.append(run_checker(cases_path, *extra))
            results.append(run_checker(cases_path, "--runner", directory / "missing"))

        self.assertTrue(all(result.returncode == 2 for result in results))
        combined = "\n".join(result.stderr for result in results)
        self.assertIn("runner failed", combined)
        self.assertIn("invalid JSON", combined)
        self.assertIn("timed out", combined)
        self.assertIn("could not execute runner", combined)
        self.assertNotIn("Traceback", combined)


class ForwardResultTests(unittest.TestCase):
    def data(self) -> dict[str, object]:
        return json.loads(FORWARD_CASES.read_text(encoding="utf-8"))

    def output_for(self, case: dict[str, object]) -> str | None:
        if not case["expected_activation"]:
            return None
        mode = case["expected_modes"][0]
        if mode == "final":
            return "```text\nGörevi kaynaklara göre uygula.\n```"
        if mode == "question":
            return (
                "1. Ana karar hangisi olmalı?\n\nA. Birinci seçenek\nB. İkinci seçenek"
                "\n\nÖnerim: A. Gerekçe: Daha düşük yan etkilidir."
            )
        if mode == "source_request":
            return (
                "Promptu hazırlamak için şu kaynaklara erişmem gerekiyor. Lütfen "
                "erişilebilir hâle getir veya içeriklerini paylaş:\n\n- private://roadmap"
            )
        return "Derinleştirmemi istediğin taslağı paylaş."

    def passing_results(self) -> dict[str, object]:
        data = self.data()
        dimensions = data["rubric"]["quality_dimensions"]
        results = []
        for case in data["cases"]:
            runs = []
            for number in (1, 2):
                runs.append(
                    {
                        "run_id": f"{case['id']}-{number}",
                        "generator_id": f"generator-{number}",
                        "evaluator_id": f"evaluator-{number}",
                        "status": "completed",
                        "activated": case["expected_activation"],
                        "output": self.output_for(case),
                        "hard_failures": [],
                        "requirement_evidence": {
                            requirement: "Kör değerlendirme kanıtı"
                            for requirement in case["hard_requirements"]
                        },
                        "scores": {dimension: 4 for dimension in dimensions},
                        "evidence": ["Bağımsız değerlendirici kanıtı"],
                    }
                )
            results.append({"id": case["id"], "runs": runs})
        return {
            "version": 1,
            "evaluation_method": "blind_external_attestation",
            "results": results,
        }

    def run_results(self, directory: Path, data: dict[str, object]):
        path = directory / "forward-results.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return run_checker(
            REPOSITORY_CASES,
            "--forward-cases",
            FORWARD_CASES,
            "--forward-results",
            path,
        )

    def write_runner_forward_cases(self, directory: Path) -> Path:
        path = directory / "forward-cases.json"
        path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "description": "runner protocol test",
                    "required_risk_areas": ["runner"],
                    "rubric": {
                        "hard_failures": ["wrong_output"],
                        "quality_dimensions": ["quality"],
                        "min_dimension_score": 4,
                        "min_total_score": 4,
                        "score_max": 5,
                    },
                    "cases": [
                        {
                            "id": "runner-case",
                            "description": "exercise blind adapters",
                            "invocation": "text",
                            "input": "$deep-prompt-builder E-posta taslağı yaz.",
                            "expected_activation": True,
                            "expected_modes": ["final"],
                            "required_tools": [],
                            "capability_profile": "standard",
                            "fixtures": [],
                            "risk_areas": ["runner"],
                            "hard_requirements": ["Yalnız text bloğu üretmeli."],
                            "quality_focus": ["quality"],
                            "required_runs": 2,
                        }
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return path

    def test_forward_runner_uses_blind_independent_adapters_and_adjudicates(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_runner_forward_cases(directory)
            generator = directory / "generator.py"
            generator.write_text(
                "import json, sys\n"
                "request = json.load(sys.stdin)\n"
                "assert request['role'] == 'generator'\n"
                "assert 'expected_modes' not in request['case']\n"
                "assert 'hard_requirements' not in request['case']\n"
                "suffix = request['run_id'].rsplit('-', 1)[-1]\n"
                "print(json.dumps({'generator_id': 'generator-' + suffix, "
                "'activated': True, 'output': '```text\\nE-posta taslağı yaz.\\n```'}))\n",
                encoding="utf-8",
            )
            evaluator = directory / "evaluator.py"
            evaluator.write_text(
                "import json, sys\n"
                "request = json.load(sys.stdin)\n"
                "assert request['role'] == 'evaluator'\n"
                "assert request['case']['hard_requirements']\n"
                "suffix = request['run_id'].rsplit('-', 1)[-1]\n"
                "score = 2 if suffix == '2' else 4\n"
                "requirements = request['case']['hard_requirements']\n"
                "dimensions = request['rubric']['quality_dimensions']\n"
                "print(json.dumps({'evaluator_id': 'evaluator-' + suffix, "
                "'status': 'completed', 'hard_failures': [], "
                "'requirement_evidence': {item: 'output evidence' for item in requirements}, "
                "'scores': {item: score for item in dimensions}, "
                "'evidence': ['independent evidence']}))\n",
                encoding="utf-8",
            )
            output = directory / "forward-results.json"
            command = [
                sys.executable,
                str(FORWARD_RUNNER),
                str(cases_path),
                "--generator-command",
                f"{shlex.quote(sys.executable)} {shlex.quote(str(generator))}",
                "--evaluator-command",
                f"{shlex.quote(sys.executable)} {shlex.quote(str(evaluator))}",
                "--output",
                str(output),
            ]
            result = subprocess.run(command, capture_output=True, text=True, check=False)

            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(output.read_text(encoding="utf-8"))
            runs = data["results"][0]["runs"]
            self.assertEqual(len(runs), 3)
            self.assertEqual(
                {run["generator_id"] for run in runs[:2]},
                {"generator-1", "generator-2"},
            )
            self.assertEqual(
                {run["evaluator_id"] for run in runs},
                {"evaluator-1", "evaluator-2", "evaluator-3"},
            )
            checked = run_checker(
                REPOSITORY_CASES,
                "--forward-cases",
                cases_path,
                "--forward-results",
                output,
            )
            self.assertEqual(checked.returncode, 0, checked.stderr)

            repeated = subprocess.run(
                command, capture_output=True, text=True, check=False
            )
            self.assertEqual(repeated.returncode, 2)
            self.assertIn("output already exists", repeated.stderr)

    def test_forward_runner_adapter_errors_have_no_traceback(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_runner_forward_cases(directory)
            invalid = directory / "invalid.py"
            invalid.write_text("print('not json')\n", encoding="utf-8")
            command_text = f"{shlex.quote(sys.executable)} {shlex.quote(str(invalid))}"
            result = subprocess.run(
                [
                    sys.executable,
                    str(FORWARD_RUNNER),
                    str(cases_path),
                    "--generator-command",
                    command_text,
                    "--evaluator-command",
                    command_text,
                    "--output",
                    str(directory / "results.json"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid JSON", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_forward_runner_retains_blocked_evidence_and_fails_gate(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases_path = self.write_runner_forward_cases(directory)
            generator = directory / "generator.py"
            generator.write_text(
                "import json, sys\n"
                "request = json.load(sys.stdin)\n"
                "suffix = request['run_id'].rsplit('-', 1)[-1]\n"
                "print(json.dumps({'generator_id': 'generator-' + suffix, "
                "'activated': True, 'output': '```text\\nTaslak\\n```'}))\n",
                encoding="utf-8",
            )
            evaluator = directory / "evaluator.py"
            evaluator.write_text(
                "import json, sys\n"
                "request = json.load(sys.stdin)\n"
                "suffix = request['run_id'].rsplit('-', 1)[-1]\n"
                "print(json.dumps({'evaluator_id': 'evaluator-' + suffix, "
                "'status': 'blocked', 'hard_failures': [], "
                "'requirement_evidence': {}, 'scores': {}, "
                "'evidence': ['Evaluator could not inspect the output.']}))\n",
                encoding="utf-8",
            )
            output = directory / "blocked-results.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(FORWARD_RUNNER),
                    str(cases_path),
                    "--generator-command",
                    f"{shlex.quote(sys.executable)} {shlex.quote(str(generator))}",
                    "--evaluator-command",
                    f"{shlex.quote(sys.executable)} {shlex.quote(str(evaluator))}",
                    "--output",
                    str(output),
                ],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 1)
            self.assertTrue(output.is_file())
            evidence = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(
                [run["status"] for run in evidence["results"][0]["runs"]],
                ["blocked", "blocked"],
            )
            self.assertIn("release gate is incomplete", result.stderr)
            self.assertIn("WROTE failing evidence", result.stderr)
            self.assertNotIn("Traceback", result.stderr)

    def test_two_passing_independent_runs_pass(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), self.passing_results())

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            f"PASS {len(self.data()['cases'])} forward result(s)", result.stdout
        )

    def test_blocked_run_keeps_release_gate_incomplete(self) -> None:
        data = self.passing_results()
        data["results"][0]["runs"][0] = {
            "run_id": "blocked",
            "status": "blocked",
        }
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("release gate is incomplete", result.stderr)

    def test_hard_failure_cannot_be_hidden_by_quality_scores(self) -> None:
        data = self.passing_results()
        data["results"][0]["runs"][0]["hard_failures"] = [
            "fabricated_source_content"
        ]
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("hard failure", result.stderr)

    def test_hard_failure_cannot_be_overridden_by_third_adjudication(self) -> None:
        data = self.passing_results()
        result_entry = data["results"][0]
        result_entry["runs"][0]["hard_failures"] = ["fabricated_source_content"]
        third = dict(result_entry["runs"][1])
        third["run_id"] = "third-adjudication"
        third["evaluator_id"] = "adjudicator-3"
        result_entry["runs"].append(third)
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("hard failure", result.stderr)

    def test_forward_attestation_requires_independent_identity_and_requirement_evidence(self) -> None:
        data = self.passing_results()
        run = data["results"][0]["runs"][0]
        run["evaluator_id"] = run["generator_id"]
        run["requirement_evidence"] = {}
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("different actors", result.stderr)
        self.assertIn("cover every hard requirement", result.stderr)

    def test_forward_results_reject_bad_identifier_types_without_traceback(self) -> None:
        data = self.passing_results()
        data["results"][0]["runs"][0]["run_id"] = []
        data["results"][0]["runs"][1]["status"] = []
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("run_id must be", result.stderr)
        self.assertIn("status must be", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_first_two_forward_runs_need_distinct_evaluators(self) -> None:
        data = self.passing_results()
        runs = data["results"][0]["runs"]
        runs[1]["evaluator_id"] = runs[0]["evaluator_id"]
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_results(Path(raw), data)

        self.assertEqual(result.returncode, 1)
        self.assertIn("distinct evaluator_id", result.stderr)

    def test_disagreement_requires_passing_third_adjudication(self) -> None:
        data = self.passing_results()
        result_entry = data["results"][0]
        first_dimension = next(iter(result_entry["runs"][0]["scores"]))
        result_entry["runs"][0]["scores"][first_dimension] = 2
        with tempfile.TemporaryDirectory() as raw:
            missing_third = self.run_results(Path(raw), data)

        self.assertEqual(missing_third.returncode, 1)
        self.assertIn("require a third adjudication", missing_third.stderr)

        third = dict(result_entry["runs"][1])
        third["run_id"] = "third-adjudication"
        third["evaluator_id"] = "adjudicator-3"
        result_entry["runs"].append(third)
        with tempfile.TemporaryDirectory() as raw:
            resolved = self.run_results(Path(raw), data)

        self.assertEqual(resolved.returncode, 0, resolved.stderr)


if __name__ == "__main__":
    unittest.main()
