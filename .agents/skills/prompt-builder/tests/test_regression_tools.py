from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PACKAGE_DIR.parents[1]
CHECKER = PACKAGE_DIR / "scripts" / "check_regressions.py"
REPOSITORY_CASES = PACKAGE_DIR / "references" / "regression-cases.json"
SKILL_FILE = PACKAGE_DIR / "SKILL.md"
AGENT_CONFIG = PACKAGE_DIR / "agents" / "openai.yaml"
REFERENCE_FIXTURE_SKILL = (
    PACKAGE_DIR / "tests" / "fixtures" / "release-helper" / "SKILL.md"
)
REFERENCE_FIXTURE_VALIDATION = (
    REFERENCE_FIXTURE_SKILL.parent / "references" / "validation-contract.md"
)


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
    def test_repository_case_set_passes(self) -> None:
        result = run_checker(REPOSITORY_CASES)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("regression case(s)", result.stdout)
        self.assertIn("saved output(s)", result.stdout)

    def test_agreed_behavior_edges_are_present(self) -> None:
        data = json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))
        cases = {case["id"]: case for case in data["cases"]}
        expected_ids = {
            "empty-draft",
            "standalone-self-link-inactive",
            "quoted-marker-source-data-inactive",
            "pasted-skill-body-inactive",
            "unavailable-skill-instructions-preserved",
            "markdown-downstream-skill-remains-passive",
            "ui-multiple-downstream-skills-remain-passive",
            "wrapper-skill-remains-passive",
            "workflow-skill-contract-deduplicated",
            "direct-runtime-reference-contract-deduplicated",
            "skill-default-removed-user-delta-preserved",
            "skill-contract-conflict-asks-choice",
            "local-file-preserved-unread",
            "main-result-choice",
            "conflicting-requirements-choice",
            "discoverable-fact-delegated",
            "quoted-note-source-data",
            "future-possibility-preserved",
            "meaningful-list-preserved",
            "explicit-language-override",
            "copyable-block-line-wrap",
            "equivalent-explicit-prefix",
            "equivalent-explicit-suffix",
            "equivalent-self-link",
            "equivalent-self-link-with-transform-instruction",
            "equivalent-ui-selection",
            "closed-source-scope-preserved",
            "explicit-source-roles-preserved",
            "named-prompt-improvement-remains-task",
            "transform-instruction-user-delta-preserved",
        }

        self.assertTrue(expected_ids.issubset(cases))
        self.assertEqual(cases["empty-draft"]["expected_mode"], "input_request")
        self.assertEqual(cases["main-result-choice"]["expected_mode"], "question")
        self.assertIn(
            "[review-helper](/skills/review-helper/SKILL.md)",
            cases["unavailable-skill-instructions-preserved"]["required_contains"],
        )
        self.assertIn(
            "okunamayan-skill-hakkında-varsayım",
            cases["unavailable-skill-instructions-preserved"]["protects"],
        )
        self.assertIn(
            "skill-sözleşmesini-yeniden-anlatma",
            cases["workflow-skill-contract-deduplicated"]["protects"],
        )
        self.assertIn(
            "make the surrounding request clearer",
            cases["workflow-skill-contract-deduplicated"][
                "forbidden_contains_i"
            ],
        )
        self.assertEqual(
            cases["skill-contract-conflict-asks-choice"]["expected_mode"],
            "question",
        )
        self.assertEqual(
            cases["copyable-block-line-wrap"]["properties"][
                "max_prompt_line_chars"
            ],
            95,
        )
        for passive_case_id in (
            "multiple-skill-order-and-purpose-preserved",
            "markdown-downstream-skill-remains-passive",
            "ui-multiple-downstream-skills-remain-passive",
            "wrapper-skill-remains-passive",
        ):
            with self.subTest(case=passive_case_id):
                self.assertEqual(cases[passive_case_id]["expected_mode"], "final")
                self.assertTrue(
                    any(
                        "mevcut-turda-" in behavior
                        for behavior in cases[passive_case_id]["protects"]
                    )
                )

    def test_invocation_equivalence_group_covers_all_supported_forms(self) -> None:
        data = json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))
        members = {
            case["id"]
            for case in data["cases"]
            if case.get("equivalence_group") == "neutral-source-skill-handoff"
        }

        self.assertEqual(
            members,
            {
                "equivalent-explicit-prefix",
                "equivalent-explicit-suffix",
                "equivalent-self-link",
                "equivalent-self-link-with-transform-instruction",
                "equivalent-ui-selection",
            },
        )

    def test_examples_do_not_depend_on_personal_projects_or_product_details(
        self,
    ) -> None:
        data = json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))
        serialized_cases = json.dumps(data["cases"], ensure_ascii=False).casefold()

        for project_specific_marker in (
            "/users/underprotection",
            "ai-vault",
            "better-auth",
            "settingsheader",
        ):
            with self.subTest(marker=project_specific_marker):
                self.assertNotIn(project_specific_marker, serialized_cases)

    def test_active_cases_have_saved_outputs_and_inactive_cases_do_not(self) -> None:
        data = json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))

        for case in data["cases"]:
            with self.subTest(case=case["id"]):
                if case["expected_activation"]:
                    self.assertIsInstance(case.get("saved_output"), str)
                    self.assertTrue(case["saved_output"])
                else:
                    self.assertNotIn("saved_output", case)


class PromptBuilderPackageContractTests(unittest.TestCase):
    def test_invocation_is_explicit_in_skill_and_agent_metadata(self) -> None:
        skill = SKILL_FILE.read_text(encoding="utf-8")
        agent_config = AGENT_CONFIG.read_text(encoding="utf-8")

        self.assertRegex(
            skill,
            r"(?m)^disable-model-invocation:\s*true\s*$",
        )
        self.assertRegex(
            agent_config,
            r"(?m)^\s*allow_implicit_invocation:\s*false\s*$",
        )

    def test_every_numbered_runtime_step_has_one_completion_criterion(self) -> None:
        skill = SKILL_FILE.read_text(encoding="utf-8")
        sections = re.findall(
            r"(?ms)^## \d+\..*?(?=^## \d+\.|\Z)",
            skill,
        )

        self.assertTrue(sections)
        for section in sections:
            heading = section.splitlines()[0]
            with self.subTest(step=heading):
                self.assertEqual(section.count("**Tamamlanma ölçütü:**"), 1)

    def test_developer_context_is_not_a_runtime_pointer(self) -> None:
        skill = SKILL_FILE.read_text(encoding="utf-8")

        self.assertNotIn("CONTEXT.md", skill)

    def test_runtime_markdown_reference_targets_exist(self) -> None:
        for source in (
            SKILL_FILE,
            REFERENCE_FIXTURE_SKILL,
            REFERENCE_FIXTURE_VALIDATION,
        ):
            links = re.findall(
                r"\[[^\]]+\]\(([^)]+)\)",
                source.read_text(encoding="utf-8"),
            )
            self.assertTrue(links, source)
            for link in links:
                with self.subTest(source=source.name, link=link):
                    self.assertTrue((source.parent / link).is_file())

    def test_direct_reference_case_uses_resolvable_multilevel_fixture(self) -> None:
        data = json.loads(REPOSITORY_CASES.read_text(encoding="utf-8"))
        case = next(
            case
            for case in data["cases"]
            if case["id"] == "direct-runtime-reference-contract-deduplicated"
        )
        fixture_link = re.search(
            r"\[release-helper\]\(([^)]+)\)",
            case["input"],
        )

        self.assertIsNotNone(fixture_link)
        self.assertTrue((REPOSITORY_ROOT / fixture_link.group(1)).is_file())
        self.assertIn("checksum", case["forbidden_contains_i"])
        self.assertIn(
            "birden-fazla-doğrudan-runtime-referansı-okuma",
            case["protects"],
        )
        self.assertIn(
            "ikinci-düzey-referansı-sözleşme-sayma",
            case["protects"],
        )


class RegressionToolTests(unittest.TestCase):
    def write_cases(
        self, directory: Path, cases: list[dict[str, object]]
    ) -> Path:
        path = directory / "cases.json"
        path.write_text(
            json.dumps({"version": 1, "cases": cases}, ensure_ascii=False),
            encoding="utf-8",
        )
        return path

    def base_final_case(self, output: str) -> dict[str, object]:
        return {
            "id": "final-case",
            "invocation": "text",
            "input": "$prompt-builder E-postayı kısalt.",
            "expected_activation": True,
            "expected_mode": "final",
            "saved_output": output,
            "required_contains_i": ["e-posta"],
            "properties": {"final_block_only": True},
            "protects": ["çıktı-sözleşmesi"],
        }

    def test_final_mode_requires_a_text_fence(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            path = self.write_cases(
                directory,
                [
                    self.base_final_case(
                        "### Nihai Prompt\n\n```markdown\nE-postayı kısalt.\n```"
                    )
                ],
            )

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("text fence", result.stderr)

    def test_final_mode_rejects_prompt_lines_that_overflow_the_copyable_block(
        self,
    ) -> None:
        case = self.base_final_case(
            "### Nihai Prompt\n\n```text\n"
            "Verilen uzun görev taslağını kapsamını büyütmeden açık ve uygulanabilir "
            "bir prompta dönüştür; kopyalanmaya hazır olmasını sağla.\n```"
        )
        case["properties"]["max_prompt_line_chars"] = 95
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("prompt line has", result.stderr)
        self.assertIn("above max_prompt_line_chars 95", result.stderr)

    def test_question_mode_requires_two_or_three_options_and_a_reasoned_recommendation(
        self,
    ) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": "Ne yapılmalı?",
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["seçeneksiz-soru"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("ordered A/B or A/B/C options", result.stderr)
        self.assertIn("explicit recommendation", result.stderr)
        self.assertIn("explicit rationale", result.stderr)

    def test_question_mode_accepts_the_agreed_contract(self) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": (
                "Hedef ne olmalı?\n\n"
                "A. Yalnız inceleme\n"
                "B. Doğrudan uygulama\n\n"
                "**Önerim:** A. **Gerekçe:** Önce mevcut durumu gösterir."
            ),
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["ana-karar"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_question_mode_rejects_non_lettered_options(self) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": (
                "Hedef ne olmalı?\n\n"
                "1. Yalnız inceleme\n"
                "2. Doğrudan uygulama\n\n"
                "**Önerim:** 1. **Gerekçe:** Önce mevcut durumu gösterir."
            ),
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["seçenek-etiketi-sözleşmesi"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("ordered A/B or A/B/C options", result.stderr)

    def test_question_mode_rejects_skipped_option_labels(self) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": (
                "Hedef ne olmalı?\n\n"
                "A. Yalnız inceleme\n"
                "C. Doğrudan uygulama\n\n"
                "**Önerim:** A. **Gerekçe:** Önce mevcut durumu gösterir."
            ),
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["sırasız-seçenek-etiketi"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("ordered A/B or A/B/C options", result.stderr)

    def test_question_mode_requires_recommendation_to_select_a_listed_option(
        self,
    ) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": (
                "Hedef ne olmalı?\n\n"
                "A. Yalnız inceleme\n"
                "B. Doğrudan uygulama\n\n"
                "**Önerim:** C. **Gerekçe:** Önce mevcut durumu gösterir."
            ),
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["listelenmeyen-öneri"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "recommendation must select one of the listed options",
            result.stderr,
        )

    def test_question_mode_requires_recommendation_to_name_an_option(self) -> None:
        case = {
            "id": "question-case",
            "invocation": "text",
            "input": "$prompt-builder İncele veya uygula.",
            "expected_activation": True,
            "expected_mode": "question",
            "saved_output": (
                "Hedef ne olmalı?\n\n"
                "A. Yalnız inceleme\n"
                "B. Doğrudan uygulama\n\n"
                "**Önerim:** Yalnız inceleme. "
                "**Gerekçe:** Önce mevcut durumu gösterir."
            ),
            "properties": {
                "single_question_only": True,
                "requires_options": True,
                "requires_recommendation": True,
                "requires_rationale": True,
            },
            "protects": ["etiketsiz-öneri"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "recommendation must select an explicit option label",
            result.stderr,
        )

    def test_input_request_mode_accepts_only_the_canonical_sentence(self) -> None:
        case = {
            "id": "empty",
            "invocation": "text",
            "input": "$prompt-builder",
            "expected_activation": True,
            "expected_mode": "input_request",
            "saved_output": "Lütfen bir taslak paylaş.",
            "properties": {"input_request_only": True},
            "protects": ["boş-taslak"],
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("input request must be exactly", result.stderr)

    def test_malformed_fields_fail_without_a_traceback(self) -> None:
        case = {
            "id": "malformed",
            "invocation": "text",
            "input": "$prompt-builder Taslağı düzelt.",
            "expected_activation": True,
            "expected_mode": "final",
            "saved_output": "### Nihai Prompt\n\n```text\nTaslağı düzelt.\n```",
            "required_regex": ["["],
            "protects": 42,
            "properties": {"unknown": True},
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("invalid regex", result.stderr)
        self.assertIn("protects must be an array", result.stderr)
        self.assertIn("unknown property", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_equivalence_group_accepts_matching_semantic_contracts(self) -> None:
        first = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        first["id"] = "first"
        first["equivalence_group"] = "same-task"
        second = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-posta metnini kısalt.\n```"
        )
        second["id"] = "second"
        second["equivalence_group"] = "same-task"
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [first, second])

            result = run_checker(path)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_equivalence_group_rejects_different_semantic_contracts(self) -> None:
        first = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        first["id"] = "first"
        first["equivalence_group"] = "same-task"
        second = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı resmileştir.\n```"
        )
        second["id"] = "second"
        second["equivalence_group"] = "same-task"
        second["required_contains_i"] = ["resmileştir"]
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [first, second])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("<equivalence group same-task>", result.stderr)
        self.assertIn("required_contains_i", result.stderr)

    def test_equivalence_group_rejects_different_output_properties(self) -> None:
        first = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        first["id"] = "first"
        first["equivalence_group"] = "same-task"
        second = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-posta metnini kısalt.\n```"
        )
        second["id"] = "second"
        second["equivalence_group"] = "same-task"
        second["properties"] = {
            "final_block_only": True,
            "max_chars": 320,
        }
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [first, second])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("<equivalence group same-task>", result.stderr)
        self.assertIn("properties", result.stderr)

    def test_equivalence_group_rejects_a_single_case(self) -> None:
        case = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        case["equivalence_group"] = "single"
        with tempfile.TemporaryDirectory() as raw_directory:
            path = self.write_cases(Path(raw_directory), [case])

            result = run_checker(path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("must contain at least two cases", result.stderr)

    def test_captured_result_uses_properties_not_saved_output_equality(self) -> None:
        case = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı ana mesajını koruyarak kısalt.\n```"
        )
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            case_path = self.write_cases(directory, [case])
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
                                    "### Nihai Prompt\n\n```text\n"
                                    "E-posta metnini kısalt.\n```"
                                ),
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            result = run_checker(case_path, "--results", results_path)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("captured result(s)", result.stdout)

    def test_captured_result_rejects_missing_required_behavior(self) -> None:
        case = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            case_path = self.write_cases(directory, [case])
            results_path = directory / "results.json"
            results_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "final-case",
                                "activated": True,
                                "output": "### Nihai Prompt\n\n```text\nMetni düzenle.\n```",
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            result = run_checker(case_path, "--results", results_path)

        self.assertEqual(result.returncode, 1)
        self.assertIn("missing required text", result.stderr)

    def test_executable_runner_protocol_is_supported(self) -> None:
        case = self.base_final_case(
            "### Nihai Prompt\n\n```text\nE-postayı kısalt.\n```"
        )
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            case_path = self.write_cases(directory, [case])
            runner_path = directory / "runner.py"
            runner_path.write_text(
                "#!/usr/bin/env python3\n"
                "import json, sys\n"
                "json.load(sys.stdin)\n"
                "print(json.dumps({'activated': True, 'output': "
                "'### Nihai Prompt\\n\\n```text\\nE-postayı kısalt.\\n```'}))\n",
                encoding="utf-8",
            )
            runner_path.chmod(0o755)

            result = run_checker(case_path, "--runner", runner_path)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("captured result(s)", result.stdout)


if __name__ == "__main__":
    unittest.main()
