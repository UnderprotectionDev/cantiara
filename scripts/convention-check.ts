import { posix } from "node:path";
import ts from "typescript";

import {
  type ControlRule,
  type ConventionRules,
  type FeatureFolder,
  STRUCTURE_PATH,
  type SubstituteBanId,
  TECH_STACK_PATH,
} from "./convention-rules";

export interface Violation {
  file: string;
  /** Identity used to compare head with base; never holds a line number. */
  key: string;
  line: number;
  message: string;
  rule: string;
  severity: "error" | "review";
  source: string;
}

const TREE_SOURCE = `${STRUCTURE_PATH} › One feature across layers`;
const FOLDER_SOURCE = `${STRUCTURE_PATH} › Rules › Web folders`;
const IMPORT_SOURCE = `${STRUCTURE_PATH} › Rules › Imports`;
const TEST_SOURCE = `${STRUCTURE_PATH} › Tests`;
const FORM_SOURCE = `${TECH_STACK_PATH} › TanStack Form`;
const DEPENDENCY_SOURCE = `${TECH_STACK_PATH} › Bağlayıcı seçim sözleşmesi`;
const REJECTED_SOURCE = `${TECH_STACK_PATH} › Bilinçli olarak eklenmeyenler`;
const TANSTACK_FORM_PACKAGE = "@tanstack/react-form";
const GENERIC_PACKAGE_TOKENS = new Set([
  "api",
  "cli",
  "core",
  "devtools",
  "dom",
  "js",
  "lite",
  "plugin",
  "react",
  "types",
  "ui",
]);

const CODE_FILE = /\.tsx?$/;
const TEST_FILE = /\.(test|e2e)\.tsx?$/;
const KEBAB_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXTENSION = /\.[^.]+$/;
const TRAILING_SLASH = /\/$/;
const APP_SOURCE = /^(apps\/[^/]+\/src\/)/;
const USE_STATE = /(^|\.)useState$/;
const PREVENT_DEFAULT = /\.preventDefault$/;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const WORD_SEPARATOR = /[^a-z0-9]+/;
const NAME_SEPARATOR = /[^a-z0-9ğüşıöç]+/;
const SCOPE = /^@([^/]+)\//;
const WEB_TSX = /^apps\/web\/src\/.+\.tsx$/;
const EXTENSION_TSX = /^apps\/extension\/(src|entrypoints)\/.+\.tsx$/;

function violation(
  file: string,
  rule: string,
  key: string,
  message: string,
  source: string,
  line = 1,
  severity: Violation["severity"] = "error",
): Violation {
  return { file, key: `${rule}:${key}`, line, message, rule, severity, source };
}

function lineOf(source: ts.SourceFile, node: ts.Node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

interface ParsedSource {
  hasJsx: boolean;
  imports: { line: number; specifier: string }[];
  source: ts.SourceFile;
}

function importSpecifier(node: ts.Node) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  const [argument] = ts.isCallExpression(node) ? node.arguments : [];
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    argument &&
    ts.isStringLiteral(argument)
  ) {
    return argument.text;
  }
}

function parse(path: string, content: string): ParsedSource {
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let hasJsx = false;
  const imports: ParsedSource["imports"] = [];
  const visit = (node: ts.Node) => {
    hasJsx ||=
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node);
    const specifier = importSpecifier(node);
    if (specifier) {
      imports.push({ line: lineOf(source, node), specifier });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { hasJsx, imports, source };
}

function featureOf(path: string, root: string) {
  if (!path.startsWith(root)) {
    return;
  }
  const [feature, ...rest] = path.slice(root.length).split("/");
  return feature && rest.length > 0 ? { feature, rest } : undefined;
}

function checkFeatureName(
  path: string,
  feature: string,
  rules: ConventionRules,
) {
  const problems: Violation[] = [];
  if (!KEBAB_NAME.test(feature)) {
    problems.push(
      violation(
        path,
        "feature-name",
        feature,
        `Feature folder \`${feature}\` is not kebab-case.`,
        TREE_SOURCE,
      ),
    );
  }
  if (rules.structure.forbiddenFeatureNames.includes(feature)) {
    problems.push(
      violation(
        path,
        "feature-name",
        feature,
        `\`${feature}\` is listed as not a feature name; name the feature after its CONTEXT.md term.`,
        `${STRUCTURE_PATH} › Rules › Feature`,
      ),
    );
  }
  return problems;
}

function isBarrel(name: string, rules: ConventionRules) {
  return (
    CODE_FILE.test(name) &&
    rules.structure.barrelStems.includes(name.replace(EXTENSION, ""))
  );
}

function folderList(folders: FeatureFolder[]) {
  return folders.map((entry) => `\`${entry.folder}\``).join(", ");
}

function checkWebTest(path: string, rest: string[], rules: ConventionRules) {
  const { structure } = rules;
  const relative = rest.join("/");
  const testsIndex = rest.indexOf(
    structure.testsFolder.replace(TRAILING_SLASH, ""),
  );
  if (testsIndex < 0) {
    return [
      violation(
        path,
        "test-home",
        relative,
        `Move the test into \`${rest.slice(0, -1).join("/")}/${structure.testsFolder}\` next to the code it tests.`,
        TEST_SOURCE,
      ),
    ];
  }
  const owner = `${rest.slice(0, testsIndex).join("/")}/`;
  if (!structure.web.folders.some((entry) => entry.folder === owner)) {
    return [
      violation(
        path,
        "test-home",
        relative,
        `Tests belong in a \`${structure.testsFolder}\` folder inside one of ${folderList(structure.web.folders)}.`,
        TEST_SOURCE,
      ),
    ];
  }
  if (testsIndex !== rest.length - 2) {
    return [
      violation(
        path,
        "test-home",
        relative,
        `\`${owner}${structure.testsFolder}\` is flat; move this file out of the nested folder.`,
        TREE_SOURCE,
      ),
    ];
  }
  return [];
}

function checkWebFolderContent(
  path: string,
  relative: string,
  folder: FeatureFolder,
  parsed: ParsedSource,
  rules: ConventionRules,
) {
  const name = posix.basename(path);
  const problems: Violation[] = [];
  if (folder.namePattern && !folder.namePattern.test(name)) {
    problems.push(
      violation(
        path,
        "file-name",
        relative,
        `Files in \`${folder.folder}\` are named \`${folder.namePatternSource}\`.`,
        TREE_SOURCE,
      ),
    );
  }
  if (folder.jsx === "required" && !parsed.hasJsx) {
    problems.push(
      violation(
        path,
        "ui-jsx",
        relative,
        `\`${folder.folder}\` holds JSX; move this code without JSX to \`lib/\` or \`hooks/\`.`,
        FOLDER_SOURCE,
      ),
    );
  }
  if (folder.jsx === "forbidden" && parsed.hasJsx) {
    problems.push(
      violation(
        path,
        "ui-jsx",
        relative,
        `\`${folder.folder}\` holds no JSX; move the rendering code to \`ui/\`.`,
        TREE_SOURCE,
      ),
    );
  }
  const formsFolder = rules.structure.web.folders.find(
    (entry) => entry.tanstackForm,
  );
  const usesTanStackForm = parsed.imports.some(
    (entry) => entry.specifier === TANSTACK_FORM_PACKAGE,
  );
  if (
    formsFolder &&
    folder !== formsFolder &&
    folder.jsx === "required" &&
    usesTanStackForm
  ) {
    problems.push(
      violation(
        path,
        "form-home",
        relative,
        `A TanStack Form component lives in \`${formsFolder.folder}\` as \`${formsFolder.namePatternSource}\`.`,
        TREE_SOURCE,
      ),
    );
  }
  return problems;
}

function checkWebFeaturePath(
  path: string,
  parsed: ParsedSource | undefined,
  rules: ConventionRules,
): Violation[] {
  const { structure } = rules;
  const location = featureOf(path, structure.web.featureRoot);
  if (!location) {
    return [];
  }
  const { feature, rest } = location;
  const relative = rest.join("/");
  const name = rest.at(-1) ?? "";
  const problems = checkFeatureName(path, feature, rules);
  if (
    structure.approvedExceptions.some((exception) =>
      `${feature}/${relative}`.startsWith(exception.path),
    )
  ) {
    return problems;
  }
  if (isBarrel(name, rules)) {
    problems.push(
      violation(
        path,
        "barrel",
        relative,
        `\`${name}\` is a barrel; import the module that owns the code.`,
        FOLDER_SOURCE,
      ),
    );
  }
  const inTests = rest.includes(
    structure.testsFolder.replace(TRAILING_SLASH, ""),
  );
  if (inTests || structure.testFilePattern.test(name)) {
    return [...problems, ...checkWebTest(path, rest, rules)];
  }
  const parent = `${rest.slice(0, -1).join("/")}/`;
  const folder = structure.web.folders.find((entry) =>
    parent.startsWith(entry.folder),
  );
  if (!folder) {
    problems.push(
      violation(
        path,
        "folder",
        relative,
        `\`${relative}\` is outside the feature folders (${folderList(structure.web.folders)}). Another folder needs a stated reason under Approved exceptions.`,
        FOLDER_SOURCE,
      ),
    );
    return problems;
  }
  return parsed
    ? [
        ...problems,
        ...checkWebFolderContent(path, relative, folder, parsed, rules),
      ]
    : problems;
}

function checkServerFeaturePath(
  path: string,
  rules: ConventionRules,
): Violation[] {
  const { server } = rules.structure;
  const location = featureOf(path, server.featureRoot);
  if (!location) {
    return [];
  }
  const { feature, rest } = location;
  const problems = checkFeatureName(path, feature, rules);
  const relative = rest.join("/");
  const name = rest.at(-1) ?? "";
  if (rest[0] !== server.folder.replace(TRAILING_SLASH, "")) {
    problems.push(
      violation(
        path,
        "folder",
        relative,
        `Server feature code lives in \`${server.featureRoot}${feature}/${server.folder}\`.`,
        TREE_SOURCE,
      ),
    );
    return problems;
  }
  if (isBarrel(name, rules)) {
    problems.push(
      violation(
        path,
        "barrel",
        relative,
        `\`${name}\` is a barrel; import the module that owns the code.`,
        FOLDER_SOURCE,
      ),
    );
  }
  const inTests = rest[1] === server.testsFolder.replace(TRAILING_SLASH, "");
  if (inTests && rest.length !== 3) {
    problems.push(
      violation(
        path,
        "test-home",
        relative,
        `\`${server.folder}${server.testsFolder}\` is flat; move this file out of the nested folder.`,
        TREE_SOURCE,
      ),
    );
  }
  if (!inTests && rules.structure.testFilePattern.test(name)) {
    problems.push(
      violation(
        path,
        "test-home",
        relative,
        `Move the test into \`${server.folder}${server.testsFolder}\`.`,
        TEST_SOURCE,
      ),
    );
  }
  return problems;
}

function resolveImport(path: string, specifier: string) {
  if (specifier.startsWith("@/")) {
    const app = path.match(APP_SOURCE)?.[1];
    return app ? `${app}${specifier.slice(2)}` : undefined;
  }
  if (specifier.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(path), specifier));
  }
}

interface ImportContext {
  own: { feature: string; root: string } | undefined;
  path: string;
  rules: ConventionRules;
}

function importViolation(
  context: ImportContext,
  entry: ParsedSource["imports"][number],
) {
  const { own, path, rules } = context;
  const { imports } = rules.structure;
  const target = resolveImport(path, entry.specifier);
  if (!target) {
    return;
  }
  if (
    imports.webNeverImportsServer &&
    path.startsWith("apps/web/") &&
    target.startsWith("apps/server/")
  ) {
    return violation(
      path,
      "import",
      `server:${target}`,
      `The web app never imports server source (\`${entry.specifier}\`); use \`@cantiara/api\` through the oRPC client.`,
      IMPORT_SOURCE,
      entry.line,
    );
  }
  const other = own
    ? (featureOf(`${target}/`, own.root) ?? featureOf(target, own.root))
    : undefined;
  if (!(own && other) || other.feature === own.feature) {
    return;
  }
  const targetPath = other.rest.filter(Boolean).join("/");
  const folder = `${other.rest[0] ?? ""}/`;
  if (!imports.forbiddenFolders.includes(folder)) {
    return;
  }
  const shell = imports.shellFeatures.includes(other.feature);
  const shellExcept = Boolean(
    imports.shellExceptFolder &&
      `${targetPath}/`.startsWith(imports.shellExceptFolder),
  );
  if (shell && !shellExcept) {
    return;
  }
  return violation(
    path,
    "import",
    `${other.feature}/${targetPath}`,
    shell
      ? `Shell feature \`${other.feature}\` may be imported except its \`${imports.shellExceptFolder}\` (\`${entry.specifier}\`).`
      : `A feature does not import another feature's \`${folder}\` (\`${entry.specifier}\`); use its \`lib/\`, promote shared code, or move it to the owning package.`,
    IMPORT_SOURCE,
    entry.line,
  );
}

function checkImports(
  path: string,
  parsed: ParsedSource,
  rules: ConventionRules,
): Violation[] {
  const root = [
    rules.structure.web.featureRoot,
    rules.structure.server.featureRoot,
  ].find((candidate) => featureOf(path, candidate));
  const feature = root ? featureOf(path, root)?.feature : undefined;
  const context: ImportContext = {
    own: root && feature ? { feature, root } : undefined,
    path,
    rules,
  };
  return parsed.imports.flatMap(
    (entry) => importViolation(context, entry) ?? [],
  );
}

function attribute(element: ts.JsxOpeningLikeElement, name: string) {
  return element.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function attributeExpression(element: ts.JsxOpeningLikeElement, name: string) {
  const initializer = attribute(element, name)?.initializer;
  return initializer && ts.isJsxExpression(initializer)
    ? initializer.expression
    : undefined;
}

/** Lowercased literal value, `""` when absent, `undefined` when dynamic. */
function literalAttribute(element: ts.JsxOpeningLikeElement, name: string) {
  const found = attribute(element, name);
  if (!found) {
    return "";
  }
  if (found.initializer && ts.isStringLiteral(found.initializer)) {
    return found.initializer.text.toLowerCase();
  }
  const expression = attributeExpression(element, name);
  return expression && ts.isStringLiteralLike(expression)
    ? expression.text.toLowerCase()
    : undefined;
}

function controlFor(
  element: ts.JsxOpeningLikeElement,
  controls: ControlRule[],
) {
  const tag = element.tagName.getText();
  if (tag === "textarea" || tag === "select") {
    return controls.find((control) => control.target.kind === tag);
  }
  const type = tag === "input" ? literalAttribute(element, "type") : undefined;
  if (type === undefined) {
    return;
  }
  return controls.find(
    (control) =>
      control.target.kind === "input" && control.target.types.includes(type),
  );
}

function rootIdentifier(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return rootIdentifier(expression.expression);
  }
}

function collectBindingNames(name: ts.BindingName, names: Set<string>) {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      collectBindingNames(element.name, names);
    }
  }
}

function parameterNames(node: ts.Node) {
  const names = new Set<string>();
  for (
    let current: ts.Node | undefined = node;
    current;
    current = current.parent
  ) {
    if (ts.isFunctionLike(current)) {
      for (const parameter of current.parameters) {
        collectBindingNames(parameter.name, names);
      }
    }
  }
  return names;
}

function insideForm(node: ts.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement.tagName.getText() === "form"
    ) {
      return true;
    }
  }
  return false;
}

/** `(event) => event.preventDefault()`: a container that is never submitted. */
function onlyPreventsDefault(expression: ts.Expression) {
  if (!ts.isArrowFunction(expression)) {
    return false;
  }
  const { body } = expression;
  const [statement] = ts.isBlock(body) ? body.statements : [];
  let call: ts.Node | undefined = body;
  if (ts.isBlock(body)) {
    call =
      body.statements.length === 1 &&
      statement &&
      ts.isExpressionStatement(statement)
        ? statement.expression
        : undefined;
  }
  return Boolean(
    call &&
      ts.isCallExpression(call) &&
      PREVENT_DEFAULT.test(call.expression.getText()),
  );
}

interface FormScan {
  fieldControls: ts.JsxOpeningLikeElement[];
  forms: ts.JsxOpeningLikeElement[];
  rawControls: { control: ControlRule; element: ts.JsxOpeningLikeElement }[];
  stateNames: Set<string>;
  usesTanStackForm: boolean;
}

function stateBindingName(node: ts.Node, source: ts.SourceFile) {
  if (
    !(
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      USE_STATE.test(node.initializer.expression.getText(source))
    )
  ) {
    return;
  }
  const [first] = node.name.elements;
  return first && ts.isBindingElement(first) && ts.isIdentifier(first.name)
    ? first.name.text
    : undefined;
}

function scanForms(parsed: ParsedSource, controls: ControlRule[]): FormScan {
  const { source } = parsed;
  const components = new Set(controls.flatMap((control) => control.components));
  const scan: FormScan = {
    fieldControls: [],
    forms: [],
    rawControls: [],
    stateNames: new Set(),
    usesTanStackForm: parsed.imports.some(
      (entry) => entry.specifier === TANSTACK_FORM_PACKAGE,
    ),
  };
  const visit = (node: ts.Node) => {
    const stateName = stateBindingName(node, source);
    if (stateName) {
      scan.stateNames.add(stateName);
    }
    scan.usesTanStackForm ||=
      ts.isPropertyAccessExpression(node) && node.name.text === "handleSubmit";
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const control = controlFor(node, controls);
      if (tag === "form") {
        scan.forms.push(node);
      }
      if (control) {
        scan.rawControls.push({ control, element: node });
      }
      if (control || components.has(tag)) {
        scan.fieldControls.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return scan;
}

function fieldStateViolations(
  path: string,
  scan: FormScan,
  source: ts.SourceFile,
) {
  return scan.fieldControls.filter(insideForm).flatMap((control) =>
    ["value", "checked"].flatMap((name) => {
      const expression = attributeExpression(control, name);
      const root = expression ? rootIdentifier(expression) : undefined;
      return root && scan.stateNames.has(root)
        ? [
            violation(
              path,
              "form-state",
              root,
              `Form field \`${root}\` is held in \`useState\`; keep field values in TanStack Form \`useForm\` and bind the control with \`form.Field\`.`,
              FORM_SOURCE,
              lineOf(source, control),
            ),
          ]
        : [];
    }),
  );
}

function submittedWithoutTanStackForm(form: ts.JsxOpeningLikeElement) {
  if (!attribute(form, "onSubmit")) {
    return false;
  }
  const expression = attributeExpression(form, "onSubmit");
  const root = expression ? rootIdentifier(expression) : undefined;
  const passedIn = Boolean(root && parameterNames(form).has(root));
  return !(passedIn || (expression && onlyPreventsDefault(expression)));
}

function checkForms(
  path: string,
  parsed: ParsedSource,
  rules: ConventionRules,
): Violation[] {
  const { forms } = rules.stack;
  const { source } = parsed;
  const scan = scanForms(parsed, forms.controls);
  const problems = scan.rawControls.map(({ control, element }) => {
    const tag = element.tagName.getText(source);
    return violation(
      path,
      "raw-control",
      `${tag}:${literalAttribute(element, "type") ?? ""}`,
      `Use \`${forms.controlPackage}\` ${control.components.map((component) => `\`${component}\``).join(" or ")} instead of a raw \`<${tag}>\`.`,
      FORM_SOURCE,
      lineOf(source, element),
    );
  });
  if (scan.forms.length === 0) {
    return problems;
  }
  if (forms.noUseStateFieldState) {
    problems.push(...fieldStateViolations(path, scan, source));
  }
  if (forms.requireUseForm && !scan.usesTanStackForm) {
    for (const form of scan.forms.filter(submittedWithoutTanStackForm)) {
      problems.push(
        violation(
          path,
          "form-library",
          "form",
          "A submitted `<form>` is written with TanStack Form `useForm`; validate with Zod `safeParse` in its `onSubmit`.",
          FORM_SOURCE,
          lineOf(source, form),
        ),
      );
    }
  }
  return problems;
}

function normalized(text: string) {
  return text.toLowerCase().replace(NON_ALPHANUMERIC, "");
}

function withoutJsSuffix(token: string) {
  return token.length > 4 && token.endsWith("js") ? token.slice(0, -2) : token;
}

// A scoped package keeps only the first word of its scope, so
// `@tauri-apps/plugin-updater` reads as tauri + updater.
function packageTokens(packageName: string) {
  const [scope, base = ""] = packageName.startsWith("@")
    ? packageName.slice(1).split("/", 2)
    : [undefined, packageName];
  const scopeWord = scope?.toLowerCase().split(WORD_SEPARATOR)[0];
  return [
    ...(scopeWord ? [scopeWord] : []),
    ...base.toLowerCase().split(WORD_SEPARATOR),
  ]
    .filter(Boolean)
    .map(withoutJsSuffix);
}

function significant(tokens: string[]) {
  const kept = tokens.filter((token) => !GENERIC_PACKAGE_TOKENS.has(token));
  return kept.length > 0 ? kept : tokens.slice(0, 1);
}

function nameWords(name: string) {
  return name
    .toLowerCase()
    .replaceAll("+", " plus ")
    .split(NAME_SEPARATOR)
    .filter(Boolean)
    .map(withoutJsSuffix);
}

/** Every significant word of the package is named by the technology. */
function covers(name: string, packageName: string) {
  const words = nameWords(name);
  if (words.length === 0) {
    return false;
  }
  const scope = packageName.match(SCOPE)?.[1];
  if (
    name.toLowerCase() === packageName ||
    (scope && normalized(scope) === normalized(name))
  ) {
    return true;
  }
  const tokens = significant(packageTokens(packageName));
  const joined = tokens.join("");
  return (
    words.includes(joined) ||
    words.join("") === joined ||
    tokens.every((token) =>
      words.some(
        (word) =>
          word === token || (token.length >= 4 && word.startsWith(token)),
      ),
    )
  );
}

/** A rejected name matches only when the package also carries all its words. */
function rejects(name: string, packageName: string) {
  const tokens = packageTokens(packageName);
  const words = significant(nameWords(name));
  return (
    covers(name, packageName) &&
    (words.every((word) => tokens.includes(word)) ||
      tokens.join("") === words.join(""))
  );
}

export function classifyDependency(
  packageName: string,
  rules: ConventionRules,
) {
  const { dependencies } = rules.stack;
  const rejected = dependencies.rejected.find((entry) =>
    rejects(entry.name, packageName),
  );
  if (rejected) {
    return {
      kind: rejected.conditional
        ? ("conditional" as const)
        : ("rejected" as const),
      name: rejected.name,
    };
  }
  const mentioned = dependencies.mentionedTokens.some(
    (token) => token === packageName || token.startsWith(`${packageName}/`),
  );
  const approved = dependencies.approvedNames.find((name) =>
    covers(name, packageName),
  );
  if (mentioned || approved) {
    return { kind: "approved" as const, name: approved ?? packageName };
  }
  return { kind: "unknown" as const, name: packageName };
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function dependencyViolation(
  path: string,
  name: string,
  line: number,
  rules: ConventionRules,
) {
  const result = classifyDependency(name, rules);
  switch (result.kind) {
    case "rejected":
      return violation(
        path,
        "dependency",
        name,
        `\`${name}\` is ${result.name}, which docs/tech-stack.md deliberately does not add.`,
        REJECTED_SOURCE,
        line,
      );
    case "conditional":
      return violation(
        path,
        "dependency",
        name,
        `\`${name}\` matches ${result.name}, which docs/tech-stack.md excludes except in a stated case; confirm this package is that case.`,
        REJECTED_SOURCE,
        line,
        "review",
      );
    case "unknown":
      return violation(
        path,
        "dependency",
        name,
        `\`${name}\` has no owner in docs/tech-stack.md. Ask the user before adding it, then record the approved choice (technology row or backticked package name).`,
        DEPENDENCY_SOURCE,
        line,
      );
    default:
      return;
  }
}

export function checkPackageManifest(
  path: string,
  content: string,
  rules: ConventionRules,
): Violation[] {
  let manifest: Partial<Record<string, Record<string, string>>>;
  try {
    manifest = JSON.parse(content);
  } catch {
    return [];
  }
  const lines = content.split("\n");
  return DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).flatMap(([name, version]) => {
      if (name.startsWith("@types/") || version.startsWith("workspace:")) {
        return [];
      }
      const line =
        lines.findIndex((candidate) => candidate.includes(`"${name}":`)) + 1;
      return dependencyViolation(path, name, line, rules) ?? [];
    }),
  );
}

function inFormScope(path: string) {
  const test = TEST_FILE.test(path) || path.includes("/tests/");
  return !test && (WEB_TSX.test(path) || EXTENSION_TSX.test(path));
}

const BAN_SCOPES: Record<SubstituteBanId, string[]> = {
  "console-logging": ["apps/server/src/"],
  "raw-clipboard": ["apps/web/src/"],
  "raw-fetch": ["apps/web/src/features/"],
  "raw-process-env": ["apps/server/src/"],
};
const BAN_USE: Record<SubstituteBanId, string> = {
  "console-logging": "`console`",
  "raw-clipboard": "`navigator.clipboard`",
  "raw-fetch": "a raw `fetch(`",
  "raw-process-env": "`process.env`",
};

function bannedUse(node: ts.Node): SubstituteBanId | undefined {
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText();
    return callee === "fetch" ||
      callee === "window.fetch" ||
      callee === "globalThis.fetch"
      ? "raw-fetch"
      : undefined;
  }
  if (!ts.isPropertyAccessExpression(node)) {
    return;
  }
  const object = node.expression.getText();
  if (object === "navigator" && node.name.text === "clipboard") {
    return "raw-clipboard";
  }
  if (object === "process" && node.name.text === "env") {
    return "raw-process-env";
  }
  return object === "console" ? "console-logging" : undefined;
}

function checkSubstitutes(
  path: string,
  parsed: ParsedSource,
  rules: ConventionRules,
): Violation[] {
  const bans = rules.stack.bans.filter(
    (ban) =>
      BAN_SCOPES[ban.id].some((scope) => path.startsWith(scope)) &&
      !ban.allowedPaths.includes(path),
  );
  if (bans.length === 0) {
    return [];
  }
  const problems: Violation[] = [];
  const visit = (node: ts.Node) => {
    const id = bannedUse(node);
    const ban = bans.find((candidate) => candidate.id === id);
    if (id && ban) {
      problems.push(
        violation(
          path,
          id,
          node.getText(parsed.source),
          `${ban.tech} owns this responsibility; do not use ${BAN_USE[id]} here (${ban.allowedPaths.length > 0 ? `allowed only in ${ban.allowedPaths.map((entry) => `\`${entry}\``).join(", ")}` : "use the stack technology"}).`,
          `${TECH_STACK_PATH} › ${ban.tech}`,
          lineOf(parsed.source, node),
        ),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed.source);
  return problems;
}

function isProductSource(path: string) {
  return !(
    TEST_FILE.test(path) ||
    path.includes("/tests/") ||
    path.includes("test-support")
  );
}

export function checkFile(
  path: string,
  content: string,
  rules: ConventionRules,
): Violation[] {
  if (
    posix.basename(path) === "package.json" &&
    !path.includes("node_modules/")
  ) {
    return checkPackageManifest(path, content, rules);
  }
  const parsed = CODE_FILE.test(path) ? parse(path, content) : undefined;
  const problems = [
    ...checkWebFeaturePath(path, parsed, rules),
    ...checkServerFeaturePath(path, rules),
  ];
  if (parsed) {
    problems.push(...checkImports(path, parsed, rules));
  }
  if (parsed && inFormScope(path)) {
    problems.push(...checkForms(path, parsed, rules));
  }
  if (parsed && isProductSource(path)) {
    problems.push(...checkSubstitutes(path, parsed, rules));
  }
  return problems;
}

/** Violations of `head` that its base version did not already have. */
export function newViolations(head: Violation[], base: Violation[]) {
  const remaining = new Map<string, number>();
  for (const entry of base) {
    remaining.set(entry.key, (remaining.get(entry.key) ?? 0) + 1);
  }
  return head.filter((entry) => {
    const count = remaining.get(entry.key) ?? 0;
    if (count > 0) {
      remaining.set(entry.key, count - 1);
      return false;
    }
    return true;
  });
}
