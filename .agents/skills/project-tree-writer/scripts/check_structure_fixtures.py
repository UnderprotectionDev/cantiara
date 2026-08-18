#!/usr/bin/env python3
"""Validate directory-based project-tree-writer regression fixtures."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


EXPECTED_MODES = {"none", "structure", "question"}
INVOCATION_MODES = {"explicit", "implicit"}
FIXTURE_VERSION = 3
CASE_KEYS = {
    "version",
    "id",
    "description",
    "invocation",
    "user_input",
    "expected_activation",
    "expected_mode",
    "question_axis",
    "target_root",
    "output_file",
    "source_dir",
    "required_paths",
    "forbidden_paths",
    "generic_path_evidence",
    "package_roots",
    "package_exports",
    "nx_feature_roots",
    "route_roots",
    "route_entry_paths",
    "route_feature_map",
    "properties",
}
PATH_LIST_FIELDS = {
    "required_paths",
    "forbidden_paths",
    "package_roots",
    "nx_feature_roots",
    "route_roots",
    "route_entry_paths",
}
BOOL_PROPERTIES = {
    "primary_js_features_first",
    "monorepo_ownership",
    "grouped_packages",
}
GENERIC_DIRECTORY_NAMES = {
    "common",
    "config",
    "global",
    "services",
    "shared",
    "utils",
}
ROUTE_LOCAL_PRODUCT_NAMES = {
    "_components",
    "_hooks",
    "_lib",
    "components",
    "data",
    "forms",
    "hooks",
    "lib",
    "server",
    "store",
    "views",
    "action.ts",
    "action.tsx",
    "actions.ts",
    "actions.tsx",
}
TREE_LINE_RE = re.compile(
    r"^(?P<prefix>(?:(?:│   )|(?:    ))*)(?P<marker>├──|└──) (?P<name>.+)$"
)
STRUCTURE_RE = re.compile(
    r"# structure\.md\n\n```text\n(?P<tree>.*)\n```\s*", flags=re.DOTALL
)
OPTION_RE = re.compile(r"^-\s+([A-Z])\)\s+(.+)$")
QUESTION_LINE_RE = re.compile(r"^\*\*(?P<axis>[^*:\n]+):\*\*\s+.+\?$")
EXPLICIT_INVOCATION_RE = re.compile(
    r"(?<![\w-])\$project-tree-writer(?![\w-])"
)


@dataclass(frozen=True)
class TreeNode:
    path: str
    parent: str
    name: str
    depth: int
    is_dir: bool
    marker: str


@dataclass(frozen=True)
class CaseMetadata:
    id: str
    description: str
    invocation: str
    user_input: str
    expected_activation: bool
    expected_mode: str
    question_axis: str | None
    source_dir: str
    output_file: str | None
    required_paths: tuple[str, ...]
    forbidden_paths: tuple[str, ...]
    generic_path_evidence: dict[str, str]
    package_roots: tuple[str, ...]
    package_exports: dict[str, dict[str, str]]
    nx_feature_roots: tuple[str, ...]
    route_roots: tuple[str, ...]
    route_entry_paths: tuple[str, ...]
    route_feature_map: dict[str, str]
    properties: dict[str, bool]
    target_root: str

    @classmethod
    def from_mapping(cls, value: dict[str, Any]) -> "CaseMetadata":
        return cls(
            id=value["id"],
            description=value["description"],
            invocation=value["invocation"],
            user_input=value["user_input"],
            expected_activation=value["expected_activation"],
            expected_mode=value["expected_mode"],
            question_axis=value.get("question_axis"),
            source_dir=value["source_dir"],
            output_file=value.get("output_file"),
            required_paths=tuple(value.get("required_paths", [])),
            forbidden_paths=tuple(value.get("forbidden_paths", [])),
            generic_path_evidence=dict(value.get("generic_path_evidence", {})),
            package_roots=tuple(value.get("package_roots", [])),
            package_exports={
                root: dict(exports)
                for root, exports in value.get("package_exports", {}).items()
            },
            nx_feature_roots=tuple(value.get("nx_feature_roots", [])),
            route_roots=tuple(value.get("route_roots", [])),
            route_entry_paths=tuple(value.get("route_entry_paths", [])),
            route_feature_map=dict(value.get("route_feature_map", {})),
            properties=dict(value.get("properties", {})),
            target_root=value.get("target_root", "."),
        )


@dataclass(frozen=True)
class FixtureCase:
    directory: Path
    metadata: CaseMetadata
    output: str

    @property
    def id(self) -> str:
        return self.metadata.id


def read_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path}: top-level JSON value must be an object")
    return value


def _resolve_inside(directory: Path, relative: str, field: str) -> Path:
    candidate = (directory / relative).resolve()
    try:
        candidate.relative_to(directory.resolve())
    except ValueError as exc:
        raise ValueError(f"{field} must stay inside the fixture directory") from exc
    return candidate


def _validate_string_list(metadata: dict[str, Any], field: str, errors: list[str]) -> None:
    if field not in metadata:
        return
    value = metadata[field]
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item for item in value
    ):
        errors.append(f"{field} must be an array of non-empty strings")


def validate_case_metadata(directory: Path, metadata: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    unknown = sorted(set(metadata) - CASE_KEYS)
    if unknown:
        errors.append(f"unknown case key(s): {', '.join(unknown)}")
    if metadata.get("version") != FIXTURE_VERSION:
        errors.append(f"version must be {FIXTURE_VERSION}")
    if not isinstance(metadata.get("id"), str) or not metadata.get("id"):
        errors.append("id must be a non-empty string")
    if not isinstance(metadata.get("description"), str) or not metadata.get("description"):
        errors.append("description must be a non-empty string")
    if metadata.get("invocation") not in INVOCATION_MODES:
        errors.append(f"invocation must be one of {sorted(INVOCATION_MODES)}")
    if not isinstance(metadata.get("user_input"), str) or not metadata.get("user_input"):
        errors.append("user_input must be a non-empty string")
    if not isinstance(metadata.get("expected_activation"), bool):
        errors.append("expected_activation must be boolean")
    if metadata.get("expected_mode") not in EXPECTED_MODES:
        errors.append(f"expected_mode must be one of {sorted(EXPECTED_MODES)}")
    if metadata.get("expected_activation") is False and metadata.get("expected_mode") != "none":
        errors.append("inactive cases must use expected_mode 'none'")
    if metadata.get("expected_activation") is True and metadata.get("expected_mode") == "none":
        errors.append("active cases must use structure or question expected_mode")
    invocation = metadata.get("invocation")
    expected_activation = metadata.get("expected_activation")
    user_input = metadata.get("user_input")
    has_explicit_marker = (
        isinstance(user_input, str)
        and EXPLICIT_INVOCATION_RE.search(user_input) is not None
    )
    if invocation == "explicit":
        if expected_activation is not True:
            errors.append("explicit invocation must activate the explicit-only skill")
        if not has_explicit_marker:
            errors.append("explicit invocation user_input must contain $project-tree-writer")
    if invocation == "implicit":
        if expected_activation is not False:
            errors.append("implicit invocation must not activate the explicit-only skill")
        if has_explicit_marker:
            errors.append("implicit invocation user_input must not contain $project-tree-writer")

    question_axis = metadata.get("question_axis")
    if metadata.get("expected_mode") == "question":
        if not isinstance(question_axis, str) or not question_axis.strip():
            errors.append("question cases must declare a non-empty question_axis")
    elif question_axis is not None:
        errors.append("question_axis is only valid for question cases")
    if expected_activation is False and "output_file" in metadata:
        errors.append("inactive cases must not declare output_file")
    output_file = metadata.get("output_file")
    expected_output_file = {
        "structure": "expected/structure.md",
        "question": "expected/response.md",
    }.get(metadata.get("expected_mode"))
    if expected_output_file is not None and output_file != expected_output_file:
        errors.append(
            f"{metadata.get('expected_mode')} cases must use "
            f"output_file {expected_output_file!r}"
        )
    target_root = metadata.get("target_root", ".")
    if not isinstance(target_root, str) or not target_root:
        errors.append("target_root must be a non-empty POSIX path")
    elif ".." in PurePosixPath(target_root).parts:
        errors.append("target_root must not contain parent traversal")
    for field in PATH_LIST_FIELDS:
        _validate_string_list(metadata, field, errors)

    route_map = metadata.get("route_feature_map", {})
    if not isinstance(route_map, dict) or not all(
        isinstance(route, str)
        and route
        and isinstance(feature, str)
        and feature
        for route, feature in route_map.items()
    ):
        errors.append("route_feature_map must be an object of non-empty path strings")

    generic_evidence = metadata.get("generic_path_evidence", {})
    if not isinstance(generic_evidence, dict) or not all(
        isinstance(tree_path, str)
        and tree_path
        and isinstance(source_path, str)
        and source_path
        for tree_path, source_path in generic_evidence.items()
    ):
        errors.append("generic_path_evidence must map tree paths to source paths")

    package_exports = metadata.get("package_exports", {})
    if not isinstance(package_exports, dict) or not all(
        isinstance(package_root, str)
        and package_root
        and isinstance(exports, dict)
        and exports
        and all(
            isinstance(export_name, str)
            and export_name
            and isinstance(source_path, str)
            and source_path
            for export_name, source_path in exports.items()
        )
        for package_root, exports in package_exports.items()
    ):
        errors.append(
            "package_exports must map package roots to export-name/source-path objects"
        )
    elif isinstance(metadata.get("package_roots", []), list):
        undeclared_export_roots = sorted(
            set(package_exports) - set(metadata.get("package_roots", []))
        )
        if undeclared_export_roots:
            errors.append(
                "package_exports contains undeclared package root(s): "
                + ", ".join(undeclared_export_roots)
            )

    properties = metadata.get("properties", {})
    if not isinstance(properties, dict):
        errors.append("properties must be an object")
    else:
        unknown_properties = sorted(set(properties) - BOOL_PROPERTIES)
        if unknown_properties:
            errors.append(f"unknown property key(s): {', '.join(unknown_properties)}")
        for name, value in properties.items():
            if name in BOOL_PROPERTIES and not isinstance(value, bool):
                errors.append(f"property {name} must be boolean")

    required_path_fields = ["source_dir"]
    if metadata.get("expected_activation") is not False:
        required_path_fields.append("output_file")
    for field in required_path_fields:
        value = metadata.get(field)
        if not isinstance(value, str) or not value:
            errors.append(f"{field} must be a non-empty relative path")
            continue
        try:
            target = _resolve_inside(directory, value, field)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if field == "source_dir":
            if not target.is_dir():
                errors.append("source_dir must reference an existing directory")
            elif not any(path.is_file() for path in target.rglob("*")):
                errors.append("source_dir must contain at least one source file")
        elif not target.is_file():
            errors.append("output_file must reference an existing file")

    source_dir = metadata.get("source_dir")
    if isinstance(source_dir, str) and source_dir:
        try:
            source_root = _resolve_inside(directory, source_dir, "source_dir")
        except ValueError:
            source_root = None
        if source_root is not None and source_root.is_dir() and isinstance(
            generic_evidence, dict
        ):
            for tree_path, relative_source in generic_evidence.items():
                if not isinstance(tree_path, str) or not isinstance(relative_source, str):
                    continue
                try:
                    evidence_path = _resolve_inside(
                        source_root, relative_source, "generic_path_evidence"
                    )
                except ValueError as exc:
                    errors.append(str(exc))
                    continue
                if not evidence_path.is_file():
                    errors.append(
                        f"generic path evidence file is missing for {tree_path}: "
                        f"{relative_source}"
                    )

    return errors


def load_fixture_cases(root: Path) -> tuple[list[FixtureCase], list[tuple[str, list[str]]]]:
    failures: list[tuple[str, list[str]]] = []
    if not root.is_dir():
        return [], [(str(root), ["fixture root must be a directory"])]
    case_files = sorted(root.glob("*/case.json"))
    if not case_files:
        return [], [(str(root), ["fixture root must contain */case.json files"])]

    cases: list[FixtureCase] = []
    seen_ids: set[str] = set()
    for case_file in case_files:
        try:
            metadata = read_json_object(case_file)
        except ValueError as exc:
            failures.append((case_file.parent.name, [str(exc)]))
            continue
        label = str(metadata.get("id") or case_file.parent.name)
        errors = validate_case_metadata(case_file.parent, metadata)
        case_id = metadata.get("id")
        if isinstance(case_id, str) and case_id:
            if case_id in seen_ids:
                errors.append(f"duplicate fixture id: {case_id}")
            seen_ids.add(case_id)
        if errors:
            failures.append((label, errors))
            continue
        parsed_metadata = CaseMetadata.from_mapping(metadata)
        output = ""
        if parsed_metadata.output_file is not None:
            output_path = _resolve_inside(
                case_file.parent, parsed_metadata.output_file, "output_file"
            )
            output = output_path.read_text(encoding="utf-8")
        cases.append(
            FixtureCase(
                directory=case_file.parent,
                metadata=parsed_metadata,
                output=output,
            )
        )
    return cases, failures


def extract_structure_tree(output: str) -> tuple[str | None, list[str]]:
    match = STRUCTURE_RE.fullmatch(output)
    if not match:
        return None, ["structure output must be exactly '# structure.md' plus one text block"]
    tree = match.group("tree")
    if "```" in tree:
        return None, ["tree block must not contain nested fences"]
    return tree, []


def parse_tree(output: str) -> tuple[list[TreeNode], list[str]]:
    tree, errors = extract_structure_tree(output)
    if tree is None:
        return [], errors
    lines = tree.splitlines()
    if not lines or lines[0] != ".":
        return [], [*errors, "tree block first line must be '.'"]
    if len(lines) == 1:
        return [], [*errors, "tree must contain at least one node"]

    nodes: list[TreeNode] = []
    stack: list[TreeNode] = []
    children: dict[str, list[TreeNode]] = {}
    paths: set[str] = set()

    for line in lines[1:]:
        match = TREE_LINE_RE.fullmatch(line)
        if not match:
            errors.append(f"invalid tree prefix or node syntax: {line!r}")
            continue
        prefix = match.group("prefix")
        marker = match.group("marker")
        raw_name = match.group("name")
        depth = len(prefix) // 4
        chunks = [prefix[index : index + 4] for index in range(0, len(prefix), 4)]

        if depth > len(stack):
            errors.append(f"tree depth jumps without a parent: {line!r}")
            continue
        if depth > 0 and (depth - 1 >= len(stack) or not stack[depth - 1].is_dir):
            errors.append(f"tree node parent must be a directory: {line!r}")
            continue
        for index, chunk in enumerate(chunks):
            if index >= len(stack):
                break
            expected = "│   " if stack[index].marker == "├──" else "    "
            if chunk != expected:
                errors.append(f"invalid tree prefix connector: {line!r}")
                break

        name = raw_name.rstrip("/")
        is_dir = raw_name.endswith("/")
        if not name or name in {".", ".."}:
            errors.append(f"invalid tree node name: {raw_name!r}")
            continue
        if "#" in raw_name or "\t" in raw_name or raw_name != raw_name.strip():
            errors.append(f"tree node must not contain comments or surrounding whitespace: {raw_name!r}")
            continue

        parent = "" if depth == 0 else stack[depth - 1].path
        path = f"{parent}{name}{'/' if is_dir else ''}"
        if path in paths:
            errors.append(f"duplicate tree path: {path}")
        paths.add(path)
        node = TreeNode(
            path=path,
            parent=parent,
            name=name,
            depth=depth,
            is_dir=is_dir,
            marker=marker,
        )
        nodes.append(node)
        children.setdefault(parent, []).append(node)
        stack = stack[:depth]
        stack.append(node)

    for parent, siblings in children.items():
        file_seen = False
        for index, node in enumerate(siblings):
            expected_marker = "└──" if index == len(siblings) - 1 else "├──"
            if node.marker != expected_marker:
                errors.append(f"invalid sibling connector for {node.path}: expected {expected_marker}")
            if node.is_dir and file_seen:
                errors.append(f"directories must appear before files under {parent or '.'}")
            if not node.is_dir:
                file_seen = True

    return nodes, errors


def validate_question(output: str, expected_axis: str | None) -> list[str]:
    errors: list[str] = []
    if "```" in output:
        errors.append("question output must not contain a fenced code block")
    if output.count("?") != 1:
        errors.append("question output must contain exactly one question mark")
    lines = output.strip().splitlines()
    first_line = lines[0] if lines else ""
    question_line = QUESTION_LINE_RE.fullmatch(first_line)
    if question_line is None:
        errors.append("question must start with one bold decision axis and end with '?'")
    elif expected_axis is not None and question_line.group("axis") != expected_axis:
        errors.append(
            f"question axis was {question_line.group('axis')!r}, expected {expected_axis!r}"
        )
    options = [OPTION_RE.fullmatch(line) for line in lines[1:]]
    if not 2 <= len(options) <= 3:
        errors.append("question must contain 2 or 3 options")
    elif any(option is None for option in options):
        errors.append("question options must use '- A)' syntax")
    else:
        labels = [option.group(1) for option in options if option is not None]
        expected_labels = [chr(ord("A") + index) for index in range(len(labels))]
        if labels != expected_labels:
            errors.append("question option labels must be sequential from A")
        for option in options:
            if option is None:
                continue
            body = option.group(2)
            if ":" not in body or not body.split(":", 1)[1].strip():
                errors.append("question option must include a rationale after ':'")
    option_bodies = [option.group(2) for option in options if option is not None]
    if sum("(önerim)" in body for body in option_bodies) != 1:
        errors.append("recommendation marker must appear inside exactly one option")
    if output.count("(önerim)") != 1:
        errors.append("question must mark exactly one option with '(önerim)'")
    return errors


def _node_path_set(nodes: Iterable[TreeNode]) -> set[str]:
    return {node.path for node in nodes}


def _validate_generic_directories(
    nodes: list[TreeNode], allowed_paths: set[str]
) -> list[str]:
    errors: list[str] = []
    for node in nodes:
        if (
            node.is_dir
            and node.name.casefold() in GENERIC_DIRECTORY_NAMES
            and node.path not in allowed_paths
        ):
            errors.append(f"generic directory requires source evidence: {node.path}")
    return errors


def _validate_primary_js_features_first(nodes: list[TreeNode]) -> list[str]:
    errors: list[str] = []
    for node in nodes:
        segments = node.path.strip("/").split("/")
        if node.is_dir and node.name == "modules":
            errors.append("primary JS/TS structure must not use modules/")
        if node.name not in ROUTE_LOCAL_PRODUCT_NAMES:
            continue
        if "app" in segments[:-1] or "routes" in segments[:-1]:
            errors.append(f"route-local product implementation is not allowed: {node.path}")
    return errors


def _validate_monorepo_ownership(nodes: list[TreeNode]) -> list[str]:
    errors: list[str] = []
    for node in nodes:
        if not node.is_dir:
            continue
        segments = node.path.strip("/").split("/")
        if len(segments) < 2 or segments[-2] != "features":
            continue
        if (
            len(segments) == 5
            and segments[0] == "apps"
            and segments[2] == "src"
            and segments[3] == "features"
        ):
            continue
        if segments[0] == "apps":
            errors.append(
                f"monorepo feature must be under apps/<app>/src/features/: {node.path}"
            )
        else:
            errors.append(
                f"monorepo feature must be owned by an app or scoped Nx library: {node.path}"
            )
    return errors


def _validate_grouped_packages(
    nodes: list[TreeNode], case: FixtureCase
) -> list[str]:
    metadata = case.metadata
    errors: list[str] = []
    paths = _node_path_set(nodes)
    directories = {node.path for node in nodes if node.is_dir}
    declared_roots = set(metadata.package_roots)
    discovered_roots = {
        node.path
        for node in nodes
        if node.is_dir
        and len(node.path.strip("/").split("/")) == 3
        and node.path.startswith("packages/")
    }
    if not declared_roots:
        errors.append("grouped_packages requires package_roots")
    for unexpected in sorted(discovered_roots - declared_roots):
        errors.append(f"undeclared leaf package root: {unexpected}")
    for missing in sorted(declared_roots - discovered_roots):
        errors.append(f"declared leaf package root is missing: {missing}")

    package_exports = metadata.package_exports
    for package_root in sorted(declared_roots):
        segments = package_root.strip("/").split("/")
        if len(segments) != 3 or segments[0] != "packages":
            errors.append(f"leaf package must live under a content group: {package_root}")
        if package_root not in directories:
            continue
        if f"{package_root}src/" not in paths:
            errors.append(f"leaf package must contain src/: {package_root}")
        if f"{package_root}package.json" not in paths:
            errors.append(f"leaf package must contain package.json: {package_root}")
        if package_root not in package_exports:
            errors.append(f"leaf package must declare public exports: {package_root}")
            continue

        source_manifest = (
            case.directory
            / metadata.source_dir
            / package_root
            / "package.json"
        )
        if not source_manifest.is_file():
            errors.append(
                f"leaf package export evidence is missing: "
                f"{source_manifest.relative_to(case.directory)}"
            )
            continue
        try:
            manifest = read_json_object(source_manifest)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        manifest_exports = manifest.get("exports")
        for export_name, source_path in package_exports[package_root].items():
            if isinstance(manifest_exports, str) and export_name == ".":
                raw_target: Any = manifest_exports
            elif isinstance(manifest_exports, dict):
                raw_target = manifest_exports.get(export_name)
            else:
                raw_target = None
            manifest_targets = _string_leaves(raw_target)
            if not manifest_targets:
                errors.append(
                    f"declared package export is missing from source manifest: "
                    f"{package_root}{export_name}"
                )
                continue
            manifest_source_path = f"./{source_path}"
            if manifest_source_path not in manifest_targets:
                errors.append(
                    f"package export source target is not declared by manifest: "
                    f"{package_root}{export_name} -> {manifest_source_path}"
                )
                continue
            if source_path.startswith("/") or ".." in Path(source_path).parts:
                errors.append(
                    f"package export source path must stay package-relative: "
                    f"{package_root}{source_path}"
                )
                continue
            tree_target = f"{package_root}{source_path}"
            if tree_target not in paths:
                errors.append(
                    f"package export has no visible source target: "
                    f"{tree_target}"
                )
    return errors


def _string_leaves(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        leaves: list[str] = []
        for nested in value.values():
            leaves.extend(_string_leaves(nested))
        return leaves
    return []


def _validate_nx_feature_roots(
    nodes: list[TreeNode], declared_roots: list[str]
) -> list[str]:
    errors: list[str] = []
    directories = {node.path for node in nodes if node.is_dir}
    discovered_roots = {
        node.path
        for node in nodes
        if node.is_dir
        and len(node.path.strip("/").split("/")) == 3
        and node.path.strip("/").split("/")[0] == "libs"
        and node.name.startswith("feature-")
    }
    declared = set(declared_roots)
    for unexpected in sorted(discovered_roots - declared):
        errors.append(f"undeclared Nx app-scoped feature root: {unexpected}")
    for missing in sorted(declared - discovered_roots):
        errors.append(f"declared Nx app-scoped feature root is missing: {missing}")
    for root in declared_roots:
        segments = root.strip("/").split("/")
        if (
            len(segments) != 3
            or segments[0] != "libs"
            or not segments[2].startswith("feature-")
        ):
            errors.append(f"invalid Nx app-scoped feature root: {root}")
        elif root not in directories:
            errors.append(f"Nx app-scoped feature root is missing: {root}")
    return errors


def _validate_route_entries(
    nodes: list[TreeNode], route_roots: list[str], route_entries: list[str]
) -> list[str]:
    errors: list[str] = []
    directories = {node.path for node in nodes if node.is_dir}
    files = {node.path for node in nodes if not node.is_dir}
    declared_entries = set(route_entries)
    for root in route_roots:
        if root not in directories:
            errors.append(f"declared route root is missing: {root}")
            continue
        for file_path in sorted(path for path in files if path.startswith(root)):
            if file_path not in declared_entries:
                errors.append(f"undeclared file under route root: {file_path}")
    for entry in sorted(declared_entries):
        if entry not in files:
            errors.append(f"declared route entry is missing: {entry}")
        elif not any(entry.startswith(root) for root in route_roots):
            errors.append(f"route entry is outside declared route roots: {entry}")
    return errors


def validate_fixture(case: FixtureCase) -> list[str]:
    mode = case.metadata.expected_mode
    if mode == "none":
        return []
    if mode == "question":
        return validate_question(case.output, case.metadata.question_axis)

    nodes, errors = parse_tree(case.output)
    if errors:
        return errors
    paths = _node_path_set(nodes)

    for required in case.metadata.required_paths:
        if required not in paths:
            errors.append(f"required path is missing: {required}")
    for forbidden in case.metadata.forbidden_paths:
        if forbidden in paths:
            errors.append(f"forbidden path is present: {forbidden}")

    generic_evidence = case.metadata.generic_path_evidence
    errors.extend(_validate_generic_directories(nodes, set(generic_evidence)))
    for route, feature in case.metadata.route_feature_map.items():
        if route not in paths:
            errors.append(f"mapped route path is missing: {route}")
        if feature not in paths:
            errors.append(f"mapped feature path is missing: {feature}")

    properties = case.metadata.properties
    if properties.get("primary_js_features_first"):
        errors.extend(_validate_primary_js_features_first(nodes))
        detected_route_roots = {
            node.path
            for node in nodes
            if node.is_dir
            and node.name in {"app", "routes"}
            and "/server/routes/" not in f"/{node.path}"
        }
        declared_route_roots = list(case.metadata.route_roots)
        if detected_route_roots and not declared_route_roots:
            errors.append("primary JS/TS fixture must declare route_roots")
        errors.extend(
            _validate_route_entries(
                nodes,
                declared_route_roots,
                list(case.metadata.route_entry_paths),
            )
        )
    if properties.get("monorepo_ownership"):
        errors.extend(_validate_monorepo_ownership(nodes))
        errors.extend(
            _validate_nx_feature_roots(
                nodes, list(case.metadata.nx_feature_roots)
            )
        )
    if properties.get("grouped_packages"):
        errors.extend(_validate_grouped_packages(nodes, case))
    return errors


def validate_cases(cases: list[FixtureCase]) -> list[tuple[str, list[str]]]:
    failures: list[tuple[str, list[str]]] = []
    for case in cases:
        errors = validate_fixture(case)
        if errors:
            failures.append((case.id, errors))
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "fixture_root",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "fixtures",
        help="Directory containing one fixture folder per scenario",
    )
    args = parser.parse_args()
    cases, load_failures = load_fixture_cases(args.fixture_root)
    failures = [*load_failures, *validate_cases(cases)]
    if failures:
        for case_id, errors in failures:
            print(f"[FAIL] {case_id}", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"OK: {len(cases)} project-tree-writer fixture(s) passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
