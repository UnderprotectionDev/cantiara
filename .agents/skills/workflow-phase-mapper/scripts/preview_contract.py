from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from copy import deepcopy
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


STABLE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")
PREVIEW_REVISION_PATTERN = re.compile(r"^pv-[0-9a-f]{20}$")
SOURCE_REVISION_PATTERN = re.compile(r"^src-[0-9a-f]{20}$")
HTML_CONTENT_DIGEST_TOKEN = "__PREVIEW_CONTENT_SHA256__"
HTML_CONTENT_DIGEST_TOKEN_PATTERN = re.compile(
    rf'(data-preview-content-sha256=")({HTML_CONTENT_DIGEST_TOKEN})(")'
)
HTML_CONTENT_DIGEST_PATTERN = re.compile(
    r'(data-preview-content-sha256=")([0-9a-f]{64})(")'
)
SOURCE_ROLES = {
    "product",
    "technical",
    "architecture",
    "terminology",
    "existing-state",
}
TECHNICAL_AUTHORITY_ROLES = {"technical", "architecture", "existing-state"}
PHASE_KINDS = {
    "product-feature",
    "cross-cutting-feature",
    "observable-system-capability",
}


class PreviewContractError(ValueError):
    """Raised when a workflow preview violates its contract."""


def resolve_source(project_root: Path, relative_path: str) -> Path:
    source_path = (project_root / relative_path).resolve()
    try:
        source_path.relative_to(project_root.resolve())
    except ValueError as error:
        raise PreviewContractError(
            f"source path escapes project root: {relative_path}"
        ) from error
    if not source_path.is_file():
        raise PreviewContractError(f"source file does not exist: {relative_path}")
    return source_path


def source_sha256(project_root: Path, relative_path: str) -> str:
    return hashlib.sha256(
        resolve_source(project_root, relative_path).read_bytes()
    ).hexdigest()


def finalize_html_content_digest(document: str) -> str:
    if len(HTML_CONTENT_DIGEST_TOKEN_PATTERN.findall(document)) != 1:
        raise PreviewContractError("HTML template must contain one content digest token")
    digest = hashlib.sha256(document.encode("utf-8")).hexdigest()
    return HTML_CONTENT_DIGEST_TOKEN_PATTERN.sub(
        lambda match: f'{match.group(1)}{digest}{match.group(3)}',
        document,
        count=1,
    )


def validate_html_content_digest(document: str, expected_digest: str) -> None:
    matches = HTML_CONTENT_DIGEST_PATTERN.findall(document)
    if len(matches) != 1 or matches[0][1] != expected_digest:
        raise PreviewContractError("index.html content digest is invalid")
    canonical, replacements = HTML_CONTENT_DIGEST_PATTERN.subn(
        lambda match: f'{match.group(1)}{HTML_CONTENT_DIGEST_TOKEN}{match.group(3)}',
        document,
        count=1,
    )
    if (
        replacements != 1
        or hashlib.sha256(canonical.encode("utf-8")).hexdigest() != expected_digest
    ):
        raise PreviewContractError("index.html content digest does not match its content")


def _require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PreviewContractError(f"{label} must be an object")
    return value


def _require_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise PreviewContractError(f"{label} must be a list")
    return value


def _require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PreviewContractError(f"{label} must be non-empty text")
    return value


def _require_stable_id(value: Any, label: str) -> str:
    stable_id = _require_text(value, label)
    if not STABLE_ID_PATTERN.fullmatch(stable_id):
        raise PreviewContractError(f"{label} must be a stable ASCII slug")
    return stable_id


def _unique(values: Iterable[Any], label: str) -> None:
    seen: set[Any] = set()
    for value in values:
        if value in seen:
            raise PreviewContractError(f"duplicate {label}: {value}")
        seen.add(value)


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def compute_source_revision(sources: list[dict[str, Any]]) -> str:
    normalized = sorted(
        (
            {
                "label": source.get("label"),
                "path": source.get("path"),
                "role": source.get("role"),
                "sha256": source.get("sha256"),
            }
            for source in sources
        ),
        key=lambda source: (
            str(source["label"]),
            str(source["path"]),
            str(source["role"]),
        ),
    )
    return f"src-{hashlib.sha256(_canonical_json(normalized)).hexdigest()[:20]}"


def compute_preview_revision(preview: dict[str, Any]) -> str:
    payload = deepcopy(preview)
    payload.pop("previewRevision", None)
    return f"pv-{hashlib.sha256(_canonical_json(payload)).hexdigest()[:20]}"


def finalize_preview_metadata(preview: dict[str, Any]) -> dict[str, Any]:
    candidate = deepcopy(preview)
    sources = _require_list(candidate.get("sources"), "sources")
    candidate["sourceRevision"] = compute_source_revision(sources)
    candidate["previewRevision"] = compute_preview_revision(candidate)
    return candidate


def _dependency(
    value: Any,
    *,
    phase_ids: set[str],
    owner_id: str,
    label: str,
) -> str:
    dependency = _require_object(value, label)
    phase_id = _require_stable_id(dependency.get("phaseId"), f"{label}.phaseId")
    _require_text(dependency.get("requiredOutcome"), f"{label}.requiredOutcome")
    condition = dependency.get("condition")
    if condition is not None:
        _require_text(condition, f"{label}.condition")
    if phase_id == owner_id:
        raise PreviewContractError(f"{label} cannot depend on its own phase")
    if phase_id not in phase_ids:
        raise PreviewContractError(f"{label} references unknown phase {phase_id}")
    return phase_id


def _find_cycle(edges: dict[str, set[str]]) -> list[str] | None:
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node: str) -> list[str] | None:
        if node in visiting:
            start = stack.index(node)
            return [*stack[start:], node]
        if node in visited:
            return None
        visiting.add(node)
        stack.append(node)
        for dependency in edges[node]:
            cycle = visit(dependency)
            if cycle:
                return cycle
        stack.pop()
        visiting.remove(node)
        visited.add(node)
        return None

    for node in edges:
        cycle = visit(node)
        if cycle:
            return cycle
    return None


def validate_preview(preview: dict[str, Any]) -> None:
    _require_object(preview, "preview")
    for field in ("title", "description", "previewRevision", "sourceRevision"):
        _require_text(preview.get(field), field)
    if not PREVIEW_REVISION_PATTERN.fullmatch(preview["previewRevision"]):
        raise PreviewContractError("previewRevision is invalid")
    if not SOURCE_REVISION_PATTERN.fullmatch(preview["sourceRevision"]):
        raise PreviewContractError("sourceRevision is invalid")

    sources = _require_list(preview.get("sources"), "sources")
    if not sources:
        raise PreviewContractError("sources must not be empty")
    labels: list[str] = []
    roles: set[str] = set()
    for index, source_value in enumerate(sources):
        source = _require_object(source_value, f"sources[{index}]")
        labels.append(_require_text(source.get("label"), f"sources[{index}].label"))
        _require_text(source.get("path"), f"sources[{index}].path")
        role = _require_text(source.get("role"), f"sources[{index}].role")
        if role not in SOURCE_ROLES:
            raise PreviewContractError(f"sources[{index}].role is unsupported: {role}")
        roles.add(role)
        sha256 = _require_text(source.get("sha256"), f"sources[{index}].sha256")
        if not re.fullmatch(r"[0-9a-f]{64}", sha256):
            raise PreviewContractError(f"sources[{index}].sha256 must be a full SHA-256")
    _unique(labels, "source label")
    if "product" not in roles:
        raise PreviewContractError("at least one product authority source is required")
    if not roles & TECHNICAL_AUTHORITY_ROLES:
        raise PreviewContractError("at least one technical authority source is required")
    if preview["sourceRevision"] != compute_source_revision(sources):
        raise PreviewContractError("sourceRevision does not match source metadata")

    phases = _require_list(preview.get("phases"), "phases")
    if not phases:
        raise PreviewContractError("preview must contain at least one phase")
    phase_ids = {
        _require_stable_id(_require_object(phase, "phase").get("id"), "phase.id")
        for phase in phases
    }
    if len(phase_ids) != len(phases):
        raise PreviewContractError("duplicate phase id")

    orders: list[int] = []
    phase_order: dict[str, int] = {}
    all_of_edges: dict[str, set[str]] = {phase_id: set() for phase_id in phase_ids}
    alternative_groups: dict[str, list[list[str]]] = {phase_id: [] for phase_id in phase_ids}
    for phase_index, phase_value in enumerate(phases):
        phase = _require_object(phase_value, f"phases[{phase_index}]")
        phase_id = _require_stable_id(phase.get("id"), f"phases[{phase_index}].id")
        order = phase.get("order")
        if not isinstance(order, int) or order < 1:
            raise PreviewContractError(f"phase {phase_id}.order must be positive")
        orders.append(order)
        phase_order[phase_id] = order
        phase_kind = _require_text(phase.get("phaseKind"), f"phase {phase_id}.phaseKind")
        if phase_kind not in PHASE_KINDS:
            raise PreviewContractError(f"phase {phase_id}.phaseKind is unsupported")
        for field in ("name", "summary"):
            _require_text(phase.get(field), f"phase {phase_id}.{field}")
        if phase.get("openDecisions"):
            raise PreviewContractError(
                f"phase {phase_id} has an unresolved decision; ask in conversation first"
            )

        subphases = _require_list(phase.get("subphases"), f"phase {phase_id}.subphases")
        subphase_ids: list[str] = []
        subphase_orders: list[int] = []
        for subphase_index, subphase_value in enumerate(subphases):
            subphase = _require_object(
                subphase_value,
                f"phase {phase_id}.subphases[{subphase_index}]",
            )
            subphase_id = _require_stable_id(
                subphase.get("id"),
                f"phase {phase_id}.subphases[{subphase_index}].id",
            )
            subphase_ids.append(subphase_id)
            subphase_order = subphase.get("order")
            if not isinstance(subphase_order, int) or subphase_order < 1:
                raise PreviewContractError(
                    f"subphase {phase_id}/{subphase_id}.order must be positive"
                )
            subphase_orders.append(subphase_order)
            _require_text(subphase.get("name"), f"subphase {phase_id}/{subphase_id}.name")
            _require_text(
                subphase.get("outcome"),
                f"subphase {phase_id}/{subphase_id}.outcome",
            )
        _unique(subphase_ids, f"subphase id in phase {phase_id}")
        _unique(subphase_orders, f"subphase order in phase {phase_id}")
        if subphase_orders != list(range(1, len(subphase_orders) + 1)):
            raise PreviewContractError(
                f"subphase order must be contiguous and array-ordered in phase {phase_id}"
            )

        prerequisites = _require_object(
            phase.get("prerequisites"),
            f"phase {phase_id}.prerequisites",
        )
        all_of = _require_list(prerequisites.get("allOf"), f"phase {phase_id}.allOf")
        for dependency_index, dependency_value in enumerate(all_of):
            dependency_id = _dependency(
                dependency_value,
                phase_ids=phase_ids,
                owner_id=phase_id,
                label=f"phase {phase_id}.allOf[{dependency_index}]",
            )
            all_of_edges[phase_id].add(dependency_id)
        any_of = _require_list(prerequisites.get("anyOf"), f"phase {phase_id}.anyOf")
        for group_index, group_value in enumerate(any_of):
            group = _require_list(group_value, f"phase {phase_id}.anyOf[{group_index}]")
            if not group:
                raise PreviewContractError(f"phase {phase_id}.anyOf[{group_index}] is empty")
            alternative_groups[phase_id].append(
                [
                    _dependency(
                        dependency_value,
                        phase_ids=phase_ids,
                        owner_id=phase_id,
                        label=f"phase {phase_id}.anyOf[{group_index}][{index}]",
                    )
                    for index, dependency_value in enumerate(group)
                ]
            )

    _unique(orders, "phase order")
    if orders != list(range(1, len(phases) + 1)):
        raise PreviewContractError("phase order must be contiguous and array-ordered from 1")
    cycle = _find_cycle(all_of_edges)
    if cycle:
        raise PreviewContractError(f"dependency cycle: {' -> '.join(cycle)}")
    for phase_id, dependencies in all_of_edges.items():
        if any(phase_order[item] >= phase_order[phase_id] for item in dependencies):
            raise PreviewContractError(
                f"phase order places {phase_id} before a required phase"
            )
    for phase_id, groups in alternative_groups.items():
        for group in groups:
            if not any(phase_order[item] < phase_order[phase_id] for item in group):
                raise PreviewContractError(
                    f"phase order provides no earlier alternative for {phase_id}"
                )
    if preview["previewRevision"] != compute_preview_revision(preview):
        raise PreviewContractError("previewRevision does not match preview content")


class _PreviewHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.root: dict[str, str] | None = None
        self.sources: list[dict[str, str]] = []
        self.phases: list[dict[str, Any]] = []
        self.current_phase: dict[str, Any] | None = None

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "html" and values.get("data-workflow-preview") == "1":
            self.root = values
        elif tag == "meta" and values.get("name") == "workflow-source":
            self.sources.append(
                {
                    "label": values.get("data-label", ""),
                    "role": values.get("data-role", ""),
                    "path": values.get("data-path", ""),
                    "sha256": values.get("data-sha256", ""),
                }
            )
        elif tag == "article" and "data-phase-id" in values:
            try:
                order = int(values.get("data-phase-order", ""))
            except ValueError:
                order = 0
            self.current_phase = {
                "id": values["data-phase-id"],
                "order": order,
                "name": values.get("data-phase-name", ""),
                "subphases": [],
            }
            self.phases.append(self.current_phase)
        elif "data-subphase-id" in values and self.current_phase is not None:
            try:
                order = int(values.get("data-subphase-order", ""))
            except ValueError:
                order = 0
            self.current_phase["subphases"].append(
                {
                    "id": values["data-subphase-id"],
                    "order": order,
                    "name": values.get("data-subphase-name", ""),
                    "outcome": values.get("data-subphase-outcome", ""),
                }
            )

    def handle_endtag(self, tag: str) -> None:
        if tag == "article":
            self.current_phase = None


def parse_preview_html(path: Path) -> dict[str, Any]:
    parser = _PreviewHTMLParser()
    document = path.read_text(encoding="utf-8")
    parser.feed(document)
    if parser.root is None:
        raise PreviewContractError("index.html is not a workflow preview")
    preview_revision = parser.root.get("data-preview-revision", "")
    source_revision = parser.root.get("data-source-revision", "")
    content_digest = parser.root.get("data-preview-content-sha256", "")
    if not re.fullmatch(r"pv-[0-9a-f]{20}", preview_revision):
        raise PreviewContractError("index.html preview revision is invalid")
    if not re.fullmatch(r"src-[0-9a-f]{20}", source_revision):
        raise PreviewContractError("index.html source revision is invalid")
    if not re.fullmatch(r"[0-9a-f]{64}", content_digest):
        raise PreviewContractError("index.html content digest is invalid")
    validate_html_content_digest(document, content_digest)
    if not parser.sources:
        raise PreviewContractError("index.html has no source metadata")
    if source_revision != compute_source_revision(parser.sources):
        raise PreviewContractError("index.html source metadata is inconsistent")
    if not parser.phases:
        raise PreviewContractError("index.html has no phase metadata")
    ids = [phase["id"] for phase in parser.phases]
    orders = [phase["order"] for phase in parser.phases]
    for phase in parser.phases:
        phase_id = _require_stable_id(phase["id"], "index.html phase id")
        _require_text(phase["name"], f"index.html phase {phase_id} name")
        subphase_ids: list[str] = []
        subphase_orders: list[int] = []
        for subphase in phase["subphases"]:
            subphase_id = _require_stable_id(
                subphase["id"], f"index.html phase {phase_id} subphase id"
            )
            subphase_ids.append(subphase_id)
            subphase_orders.append(subphase["order"])
            _require_text(
                subphase["name"],
                f"index.html phase {phase_id} subphase {subphase_id} name",
            )
            _require_text(
                subphase["outcome"],
                f"index.html phase {phase_id} subphase {subphase_id} outcome",
            )
        _unique(subphase_ids, f"index.html subphase id in {phase_id}")
        if subphase_orders != list(range(1, len(subphase_orders) + 1)):
            raise PreviewContractError(
                f"index.html subphase order is invalid in phase {phase_id}"
            )
    _unique(ids, "index.html phase id")
    if orders != list(range(1, len(orders) + 1)):
        raise PreviewContractError("index.html phase order is invalid")
    return {
        "previewRevision": preview_revision,
        "sourceRevision": source_revision,
        "sources": parser.sources,
        "phases": parser.phases,
    }
