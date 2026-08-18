from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parents[1]
CHECKER = PACKAGE_DIR / "scripts" / "check_structure_fixtures.py"
BEHAVIOR_RUNNER = PACKAGE_DIR / "scripts" / "run_behavior_evals.py"


def structure(tree: str) -> str:
    return f"# structure.md\n\n```text\n{tree}\n```"


class FixtureCheckerTests(unittest.TestCase):
    def write_case(
        self,
        root: Path,
        *,
        case_id: str,
        output: str,
        expected_mode: str = "structure",
        metadata: dict[str, object] | None = None,
    ) -> Path:
        case_dir = root / case_id
        (case_dir / "sources").mkdir(parents=True)
        (case_dir / "expected").mkdir()
        (case_dir / "sources" / "product-brief.md").write_text(
            "# Product brief\n\nUsers manage orders.\n", encoding="utf-8"
        )
        output_name = "structure.md" if expected_mode == "structure" else "response.md"
        (case_dir / "expected" / output_name).write_text(output, encoding="utf-8")
        case = {
            "version": 3,
            "id": case_id,
            "description": "Test fixture",
            "invocation": "explicit",
            "user_input": "$project-tree-writer Kaynaklardan structure.md oluştur.",
            "expected_activation": True,
            "expected_mode": expected_mode,
            "output_file": f"expected/{output_name}",
            "source_dir": "sources",
            **(metadata or {}),
        }
        if expected_mode == "question":
            case.setdefault("question_axis", "Repo modeli")
        (case_dir / "case.json").write_text(
            json.dumps(case, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return root

    def run_checker(self, fixture_root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(CHECKER), str(fixture_root)],
            check=False,
            capture_output=True,
            text=True,
        )

    def assert_rejected(self, output: str, expected_error: str, **kwargs: object) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(root, case_id="invalid-case", output=output, **kwargs)
            result = self.run_checker(root)

        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(expected_error, result.stderr)

    def test_rejects_files_before_directories(self) -> None:
        self.assert_rejected(
            structure(".\n├── package.json\n└── src/"),
            "directories must appear before files",
        )

    def test_rejects_invalid_tree_connectors(self) -> None:
        self.assert_rejected(
            structure(".\nxxxx├── src/"),
            "invalid tree prefix",
        )

    def test_rejects_unapproved_generic_directories(self) -> None:
        self.assert_rejected(
            structure(".\n└── src/\n    └── utils/"),
            "generic directory requires source evidence: src/utils/",
        )

    def test_allows_source_backed_generic_directories(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="allowed-generic",
                output=structure(".\n└── src/\n    └── config/"),
                metadata={
                    "generic_path_evidence": {
                        "src/config/": "product-brief.md"
                    }
                },
            )
            result = self.run_checker(root)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_modules_and_route_local_product_implementation(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── src/\n"
                "    ├── app/\n"
                "    │   └── orders/\n"
                "    │       ├── _components/\n"
                "    │       └── actions.ts\n"
                "    └── modules/"
            ),
            "primary JS/TS structure must not use modules/",
            metadata={"properties": {"primary_js_features_first": True}},
        )

    def test_rejects_direct_route_local_product_directories(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── src/\n"
                "    └── app/\n"
                "        └── orders/\n"
                "            └── components/"
            ),
            "route-local product implementation is not allowed",
            metadata={"properties": {"primary_js_features_first": True}},
        )

    def test_rejects_undeclared_files_under_route_roots(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── src/\n"
                "    └── app/\n"
                "        └── orders/\n"
                "            ├── page.tsx\n"
                "            └── schemas.ts"
            ),
            "undeclared file under route root: src/app/orders/schemas.ts",
            metadata={
                "route_roots": ["src/app/"],
                "route_entry_paths": ["src/app/orders/page.tsx"],
                "properties": {"primary_js_features_first": True},
            },
        )

    def test_rejects_features_outside_monorepo_apps(self) -> None:
        self.assert_rejected(
            structure(
                ".\n├── apps/\n"
                "│   └── web/\n"
                "└── features/\n"
                "    └── orders/"
            ),
            "monorepo feature must be owned by an app or scoped Nx library",
            metadata={"properties": {"monorepo_ownership": True}},
        )

    def test_rejects_malformed_apps_feature_root(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── apps/\n"
                "    └── features/\n"
                "        └── orders/"
            ),
            "monorepo feature must be under apps/<app>/src/features/",
            metadata={"properties": {"monorepo_ownership": True}},
        )

    def test_rejects_undeclared_nx_feature_roots(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── libs/\n"
                "    └── web/\n"
                "        ├── feature-billing/\n"
                "        └── feature-orders/"
            ),
            "undeclared Nx app-scoped feature root: libs/web/feature-billing/",
            metadata={
                "nx_feature_roots": ["libs/web/feature-orders/"],
                "properties": {"monorepo_ownership": True},
            },
        )

    def test_route_feature_map_requires_the_declared_feature(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── src/\n"
                "    ├── app/\n"
                "    │   └── settings/\n"
                "    │       └── tags/\n"
                "    │           └── page.tsx\n"
                "    └── features/\n"
                "        └── settings/"
            ),
            "mapped feature path is missing: src/features/tags/",
            metadata={
                "route_feature_map": {
                    "src/app/settings/tags/page.tsx": "src/features/tags/"
                }
            },
        )

    def test_question_requires_two_or_three_options_and_one_recommendation(self) -> None:
        self.assert_rejected(
            "**Repo modeli:** Hangisini kullanalım?\n"
            "- A) Normal repo (önerim): Daha küçük yapı.\n"
            "- B) Monorepo: Birden fazla app.\n"
            "- C) Workspace: Paketler.\n"
            "- D) Karışık: Hepsi.",
            "question must contain 2 or 3 options",
            expected_mode="question",
        )

    def test_question_must_match_the_declared_decision_axis(self) -> None:
        self.assert_rejected(
            "**Ürün kapsamı:** Hangi capability'leri içermeli?\n"
            "- A) Brief paylaş (önerim): Gerçek scope çıkarılır.\n"
            "- B) Liste yaz: Verilen adlar değerlendirilir.",
            "question axis was 'Ürün kapsamı', expected 'Repo modeli'",
            expected_mode="question",
        )

    def test_question_rejects_text_outside_the_decision_and_options(self) -> None:
        self.assert_rejected(
            "**Repo modeli:** Hangisini kullanalım?\n"
            "Önce kısa bir not.\n"
            "- A) Normal repo (önerim): Daha küçük yapı.\n"
            "- B) Monorepo: Birden fazla deployable.",
            "question options must use '- A)' syntax",
            expected_mode="question",
        )

    def test_question_options_require_short_rationales(self) -> None:
        self.assert_rejected(
            "**Repo modeli:** Hangisini kullanalım?\n"
            "- A) Normal repo (önerim)\n"
            "- B) Monorepo",
            "question option must include a rationale after ':'",
            expected_mode="question",
        )

    def test_recommendation_marker_must_be_inside_one_option(self) -> None:
        self.assert_rejected(
            "**Repo modeli (önerim):** Hangisini kullanalım?\n"
            "- A) Normal repo: Daha küçük yapı.\n"
            "- B) Monorepo: Birden fazla app.",
            "recommendation marker must appear inside exactly one option",
            expected_mode="question",
        )

    def test_grouped_leaf_packages_require_src(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── packages/\n"
                "    └── libraries/\n"
                "        └── math/\n"
                "            └── package.json"
            ),
            "leaf package must contain src/: packages/libraries/math/",
            metadata={
                "package_roots": ["packages/libraries/math/"],
                "properties": {"grouped_packages": True},
            },
        )

    def test_grouped_leaf_packages_require_a_manifest(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── packages/\n"
                "    └── contracts/\n"
                "        └── orders-api/\n"
                "            └── src/"
            ),
            "leaf package must contain package.json: packages/contracts/orders-api/",
            metadata={
                "package_roots": ["packages/contracts/orders-api/"],
                "properties": {"grouped_packages": True},
            },
        )

    def test_grouped_leaf_packages_require_declared_exports(self) -> None:
        self.assert_rejected(
            structure(
                ".\n└── packages/\n"
                "    └── contracts/\n"
                "        └── orders-api/\n"
                "            ├── src/\n"
                "            │   └── schemas.ts\n"
                "            └── package.json"
            ),
            "leaf package must declare public exports: packages/contracts/orders-api/",
            metadata={
                "package_roots": ["packages/contracts/orders-api/"],
                "properties": {"grouped_packages": True},
            },
        )

    def test_grouped_leaf_package_export_target_must_be_source_backed_and_visible(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="missing-export-target",
                output=structure(
                    ".\n└── packages/\n"
                    "    └── contracts/\n"
                    "        └── orders-api/\n"
                    "            ├── src/\n"
                    "            └── package.json"
                ),
                metadata={
                    "package_roots": ["packages/contracts/orders-api/"],
                    "package_exports": {
                        "packages/contracts/orders-api/": {
                            "./contract": "src/contract.ts"
                        }
                    },
                    "properties": {"grouped_packages": True},
                },
            )
            source_package = (
                root
                / "missing-export-target"
                / "sources"
                / "packages"
                / "contracts"
                / "orders-api"
            )
            source_package.mkdir(parents=True)
            (source_package / "package.json").write_text(
                json.dumps({"exports": {"./contract": "./src/contract.ts"}}),
                encoding="utf-8",
            )
            result = self.run_checker(root)

        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(
            "package export has no visible source target: "
            "packages/contracts/orders-api/src/contract.ts",
            result.stderr,
        )

    def test_conditional_package_export_allows_omitted_build_targets(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="conditional-export",
                output=structure(
                    ".\n└── packages/\n"
                    "    └── contracts/\n"
                    "        └── orders-api/\n"
                    "            ├── src/\n"
                    "            │   └── index.ts\n"
                    "            └── package.json"
                ),
                metadata={
                    "package_roots": ["packages/contracts/orders-api/"],
                    "package_exports": {
                        "packages/contracts/orders-api/": {".": "src/index.ts"}
                    },
                    "properties": {"grouped_packages": True},
                },
            )
            source_package = (
                root
                / "conditional-export"
                / "sources"
                / "packages"
                / "contracts"
                / "orders-api"
            )
            source_package.mkdir(parents=True)
            (source_package / "package.json").write_text(
                json.dumps(
                    {
                        "exports": {
                            ".": {
                                "types": "./src/index.ts",
                                "import": "./dist/index.js",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_checker(root)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_package_export_source_mapping_must_match_the_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="mismatched-export-source",
                output=structure(
                    ".\n└── packages/\n"
                    "    └── contracts/\n"
                    "        └── orders-api/\n"
                    "            ├── src/\n"
                    "            │   └── unrelated.ts\n"
                    "            └── package.json"
                ),
                metadata={
                    "package_roots": ["packages/contracts/orders-api/"],
                    "package_exports": {
                        "packages/contracts/orders-api/": {
                            "./contract": "src/unrelated.ts"
                        }
                    },
                    "properties": {"grouped_packages": True},
                },
            )
            source_package = (
                root
                / "mismatched-export-source"
                / "sources"
                / "packages"
                / "contracts"
                / "orders-api"
            )
            source_package.mkdir(parents=True)
            (source_package / "package.json").write_text(
                json.dumps({"exports": {"./contract": "./src/contract.ts"}}),
                encoding="utf-8",
            )
            result = self.run_checker(root)

        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(
            "package export source target is not declared by manifest: "
            "packages/contracts/orders-api/./contract -> ./src/unrelated.ts",
            result.stderr,
        )

    def test_fixture_invocation_metadata_matches_explicit_only_runtime(self) -> None:
        self.assert_rejected(
            structure(".\n└── package.json"),
            "implicit invocation must not activate the explicit-only skill",
            metadata={
                "invocation": "implicit",
                "user_input": "Structure çıkar.",
                "expected_activation": True,
            },
        )

    def test_explicit_invocation_requires_the_exact_skill_token(self) -> None:
        self.assert_rejected(
            structure(".\n└── package.json"),
            "explicit invocation user_input must contain $project-tree-writer",
            metadata={
                "user_input": "$project-tree-writer-extra Structure çıkar."
            },
        )

    def test_skill_and_agent_invocation_controls_match(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8")
        frontmatter = skill.split("---", 2)[1]
        agent = (PACKAGE_DIR / "agents" / "openai.yaml").read_text(encoding="utf-8")

        self.assertRegex(frontmatter, r"(?m)^disable-model-invocation: true$")
        self.assertRegex(agent, r"(?m)^\s+allow_implicit_invocation: false$")
        self.assertIn("$project-tree-writer", agent)

    def test_package_context_is_reachable_and_maintenance_only(self) -> None:
        skill = (PACKAGE_DIR / "SKILL.md").read_text(encoding="utf-8")
        context = (PACKAGE_DIR / "CONTEXT.md").read_text(encoding="utf-8")
        extraction = (PACKAGE_DIR / "references" / "source-extraction-rules.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("[bakım sözlüğünü](CONTEXT.md)", skill)
        self.assertIn("runtime girdisi değildir", context)
        self.assertIn("yalnız hedef projede", extraction)

    def test_package_local_markdown_references_resolve(self) -> None:
        reference_pattern = re.compile(
            r"`((?:references|scripts|tests|fixtures)/[^`\s]+)"
        )
        missing: list[str] = []
        for markdown in PACKAGE_DIR.rglob("*.md"):
            content = markdown.read_text(encoding="utf-8")
            for raw_path in reference_pattern.findall(content):
                if "<" in raw_path:
                    continue
                if "*" in raw_path:
                    if not list(PACKAGE_DIR.glob(raw_path)):
                        missing.append(f"{markdown.relative_to(PACKAGE_DIR)} -> {raw_path}")
                    continue
                if not (PACKAGE_DIR / raw_path).exists():
                    missing.append(f"{markdown.relative_to(PACKAGE_DIR)} -> {raw_path}")
            for raw_path in re.findall(r"\]\(([^)]+)\)", content):
                if "://" in raw_path or raw_path.startswith("#"):
                    continue
                target = (markdown.parent / raw_path.split("#", 1)[0]).resolve()
                try:
                    target.relative_to(PACKAGE_DIR.resolve())
                except ValueError:
                    missing.append(
                        f"{markdown.relative_to(PACKAGE_DIR)} -> outside package: {raw_path}"
                    )
                    continue
                if not target.exists():
                    missing.append(f"{markdown.relative_to(PACKAGE_DIR)} -> {raw_path}")
        self.assertEqual(missing, [])


class BehaviorEvalTests(unittest.TestCase):
    write_case = FixtureCheckerTests.write_case

    def run_behavior_eval(
        self, fixture_root: Path, *args: str
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(BEHAVIOR_RUNNER), str(fixture_root), *args],
            check=False,
            capture_output=True,
            text=True,
        )

    def test_validate_only_accepts_directory_fixture_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="valid-case",
                output=structure(".\n└── src/\n    └── features/\n        └── orders/"),
                metadata={"required_paths": ["src/features/orders/"]},
            )
            result = self.run_behavior_eval(root, "--validate-only")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("VALID 1 behavior case(s)", result.stdout)

    def test_captured_real_output_is_graded_semantically(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            self.write_case(
                root,
                case_id="orders-case",
                output=structure(".\n└── src/\n    └── features/\n        └── orders/"),
                metadata={"required_paths": ["src/features/orders/"]},
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "orders-case",
                                "activated": True,
                                "output_path": "structure.md",
                                "output": structure(
                                    ".\n└── src/\n"
                                    "    └── features/\n"
                                    "        └── billing/"
                                ),
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 1)
        self.assertIn("required path is missing: src/features/orders/", result.stderr)

    def test_captured_structure_must_write_relative_to_target_root(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            expected = structure(".\n└── package.json")
            self.write_case(
                root,
                case_id="wrong-root",
                output=expected,
                metadata={"target_root": "/requested-project"},
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "wrong-root",
                                "activated": True,
                                "output_path": "structure.md",
                                "output": expected,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "output_path was 'structure.md', expected "
            "'/requested-project/structure.md' relative to target_root",
            result.stderr,
        )

    def test_captured_question_is_graded_against_the_fixture_axis(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            expected = (
                "**Repo modeli:** Hangisini kullanalım?\n"
                "- A) Normal repo (önerim): Daha küçük yapı.\n"
                "- B) Monorepo: Birden fazla deployable."
            )
            self.write_case(
                root,
                case_id="repo-question",
                output=expected,
                expected_mode="question",
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "repo-question",
                                "activated": True,
                                "output": (
                                    "**Ürün kapsamı:** Neleri içermeli?\n"
                                    "- A) Brief paylaş (önerim): Scope çıkarılır.\n"
                                    "- B) Liste yaz: Adlar değerlendirilir."
                                ),
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "question axis was 'Ürün kapsamı', expected 'Repo modeli'",
            result.stderr,
        )

    def test_captured_question_must_not_report_a_write_path(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            expected = (
                "**Repo modeli:** Hangisini kullanalım?\n"
                "- A) Normal repo (önerim): Daha küçük yapı.\n"
                "- B) Monorepo: Birden fazla deployable."
            )
            self.write_case(
                root,
                case_id="question-write",
                output=expected,
                expected_mode="question",
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "question-write",
                                "activated": True,
                                "output_path": "structure.md",
                                "output": expected,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 1)
        self.assertIn("question results must not write an output_path", result.stderr)

    def test_external_runner_receives_sources_and_can_pass(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            expected = structure(".\n└── src/\n    └── features/\n        └── orders/")
            self.write_case(
                root,
                case_id="runner-case",
                output=expected,
                metadata={"required_paths": ["src/features/orders/"]},
            )
            runner = root / "runner.py"
            runner.write_text(
                "#!/usr/bin/env python3\n"
                "import json, sys\n"
                "case = json.load(sys.stdin)\n"
                "assert 'product-brief.md' in case['sources']\n"
                "assert case['target_root'] == '.'\n"
                f"json.dump({{'activated': True, 'output_path': 'structure.md', "
                f"'output': {expected!r}}}, sys.stdout)\n",
                encoding="utf-8",
            )
            runner.chmod(0o755)
            result = self.run_behavior_eval(root, "--runner", str(runner))

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PASS 1 behavior case(s)", result.stdout)

    def test_inactive_explicit_only_case_needs_no_expected_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            case_dir = root / "implicit-call"
            (case_dir / "sources").mkdir(parents=True)
            (case_dir / "sources" / "README.md").write_text(
                "# Product\n", encoding="utf-8"
            )
            (case_dir / "case.json").write_text(
                json.dumps(
                    {
                        "version": 3,
                        "id": "implicit-call",
                        "description": "Explicit-only skill stays inactive.",
                        "invocation": "implicit",
                        "user_input": "Full-stack repo yapımı çıkar.",
                        "expected_activation": False,
                        "expected_mode": "none",
                        "source_dir": "sources",
                    }
                ),
                encoding="utf-8",
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {"id": "implicit-call", "activated": False, "output": ""}
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_inactive_result_cannot_hide_a_write(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            root = Path(raw_directory)
            case_dir = root / "implicit-write"
            (case_dir / "sources").mkdir(parents=True)
            (case_dir / "sources" / "README.md").write_text(
                "# Product\n", encoding="utf-8"
            )
            (case_dir / "case.json").write_text(
                json.dumps(
                    {
                        "version": 3,
                        "id": "implicit-write",
                        "description": "Inactive skill must have no side effect.",
                        "invocation": "implicit",
                        "user_input": "Full-stack repo yapımı çıkar.",
                        "expected_activation": False,
                        "expected_mode": "none",
                        "source_dir": "sources",
                    }
                ),
                encoding="utf-8",
            )
            results = root / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "results": [
                            {
                                "id": "implicit-write",
                                "activated": False,
                                "output_path": "structure.md",
                                "output": "unexpected",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_behavior_eval(root, str(results))

        self.assertEqual(result.returncode, 1)
        self.assertIn("inactive results must not write an output_path", result.stderr)
        self.assertIn("inactive results must not return output", result.stderr)


if __name__ == "__main__":
    unittest.main()
