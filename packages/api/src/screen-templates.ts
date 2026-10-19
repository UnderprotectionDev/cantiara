import {
  parseWireframeDocument,
  type WireframeBlock,
  type WireframeDocument,
} from "./wireframe-document";

/**
 * Wireframe template stamping (spec 48). A template keeps structure,
 * placeholders and linked-block definitions of one exact version. It never
 * keeps anything that points back at the source Project: live record cards,
 * live Document references and Screen transitions are replaced or dropped, so
 * a Screen created from it has no live bind to the source.
 */
export function sanitizeTemplateDocument(input: unknown): WireframeDocument {
  const document = parseWireframeDocument(input);
  const blocks = document.blocks.map((block): WireframeBlock => {
    if (block.kind === "Live Card") {
      // A placeholder Card of the same placement; the record reference is dropped.
      const { props: _props, ...placement } = block;
      return {
        ...placement,
        kind: "Card",
        label: `${block.props.recordType} card`,
        props: { hasHeader: true },
      };
    }
    if (block.kind === "Text" && block.text.mode === "live") {
      return {
        ...block,
        label: "Text",
        text: { mode: "placeholder", text: "Text" },
      };
    }
    return block;
  });
  return parseWireframeDocument({
    ...document,
    animations: document.animations.filter(
      ({ kind }) => kind !== "screen-transition",
    ),
    blocks,
  });
}

/**
 * Gives the template's linked-block definitions new identities. `idMap` maps
 * each template definition id to a definition created in the target Project,
 * so the new Screen shares nothing with the source Project's definitions.
 */
export function instantiateTemplateDocument(
  template: unknown,
  idMap: ReadonlyMap<string, string>,
): WireframeDocument {
  const document = parseWireframeDocument(template);
  const mapped = (id: string) => idMap.get(id) ?? id;
  return parseWireframeDocument({
    ...document,
    blocks: document.blocks.map((block) =>
      block.link
        ? { ...block, link: { definitionId: mapped(block.link.definitionId) } }
        : block,
    ),
    linkedDefinitions: Object.fromEntries(
      Object.values(document.linkedDefinitions).map((definition) => [
        mapped(definition.id),
        { ...definition, id: mapped(definition.id), revision: 1 },
      ]),
    ),
  });
}
