import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function checkClientSecretBoundary(root) {
  const files = new Map();
  const sourceRoot = path.join(root, "src");
  function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== "generated") collect(file);
      else if (entry.isFile() && /\.(?:ts|tsx|mts|cts)$/u.test(entry.name)) {
        files.set(file, ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true));
      }
    }
  }
  collect(sourceRoot);
  const configFile = path.join(root, "tsconfig.json");
  const options = existsSync(configFile)
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configFile, ts.sys.readFile).config, ts.sys, root).options : {};
  const directive = (source, value) => {
    for (const node of source.statements) {
      if (!ts.isExpressionStatement(node) || !ts.isStringLiteral(node.expression)) break;
      if (node.expression.text === value) return true;
    }
    return false;
  };
  const imports = new Map();
  for (const [file, source] of files) {
    const edges = [];
    const add = (specifier) => {
      const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (target && files.has(target)) edges.push(target);
    };
    function visit(node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const onlyTypes = clause?.isTypeOnly || (!clause?.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((item) => item.isTypeOnly));
        if (!onlyTypes) add(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.exportClause;
        if (!(clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((item) => item.isTypeOnly))) add(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source); imports.set(file, edges);
  }
  const violations = [];
  for (const [client, source] of files) {
    if (!directive(source, "use client")) continue;
    const seen = new Set();
    function walk(file) {
      if (seen.has(file)) return;
      seen.add(file);
      const relative = path.relative(root, file).replaceAll("\\", "/");
      if (["src/platform/security/secret-ref.ts", "src/platform/config/server-environment.ts"].includes(relative)) {
        violations.push(`${path.relative(root, client).replaceAll("\\", "/")} imports server secret resolution`);
        return;
      }
      // Next's use-server module boundary becomes an RPC, not client code.
      if (directive(files.get(file), "use server")) return;
      for (const target of imports.get(file)) walk(target);
    }
    walk(client);
  }
  return [...new Set(violations)].sort();
}
