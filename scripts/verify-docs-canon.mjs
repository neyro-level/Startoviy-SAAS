import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { verifyDocumentationLinks } from "./docs-links.mjs";
import { execFileSync } from "node:child_process";
import { assertNoInheritedExecutionArtifacts } from "./execution-artifact-policy.mjs";

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), "utf8");
const requireText = (file, text) => {
  if (!read(file).includes(text)) {
    throw new Error(`Documentation contract missing ${JSON.stringify(text)} in ${file}`);
  }
};

const canonical = [
  "docs/README.md",
  "docs/01_PRD.md",
  "docs/02_PRODUCT_STRUCTURE.md",
  "docs/03_ARCHITECTURE.md",
  "docs/04_BACKLOG.md",
  "docs/05_RELEASE_CHECKLIST.md",
  "docs/06_DESIGN_SYSTEM.md",
  "docs/HANDOVER.md",
];

for (const file of canonical) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`Missing canonical document: ${file}`);
  }
}

for (const name of ["01_PRD.md", "02_PRODUCT_STRUCTURE.md", "03_ARCHITECTURE.md", "04_BACKLOG.md", "05_RELEASE_CHECKLIST.md", "06_DESIGN_SYSTEM.md"]) {
  requireText("docs/README.md", `\`${name}\``);
}

for (const section of ["## Guarantee-to-proof matrix", "## Known bounded exceptions", "## Derived-product handover", "## Final-main closure"]) {
  requireText("docs/HANDOVER.md", section);
}
requireText("docs/03_ARCHITECTURE.md", "`HANDOVER.md` and ADR-014");
requireText("docs/DERIVATION.md", "`HANDOVER.md`");

for (const reference of ["docs/README.md", "01_PRD.md", "02_PRODUCT_STRUCTURE.md", "03_ARCHITECTURE.md", "04_BACKLOG.md"]) {
  requireText("AGENTS.md", `\`${reference}\``);
}

for (const file of ["docs/PRODUCT.md", "docs/ARCHITECTURE.md"]) {
  if (!read(file).startsWith("# Superseded")) {
    throw new Error(`Legacy document must be explicitly superseded: ${file}`);
  }
}

// Current code/canon owns invariants. Task history stays in ignored local
// records and Git; a copied product must never depend on an execution plan.
const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter((file) => file && existsSync(resolve(root, file)));
assertNoInheritedExecutionArtifacts(trackedFiles);
for (const role of ["Навигатор", "Продуктовые требования", "Страницы и сценарии", "Дизайн", "Техническая архитектура", "Факты и контент", "Приёмка"]) {
  const owners = read("docs/README.md").split("\n").filter((line) => line.startsWith(`| ${role} |`));
  if (owners.length !== 1) throw new Error(`Documentation role must have one authoritative owner: ${role}`);
}
for (let index = 1; index <= 18; index += 1) {
  const id = `REQ-${String(index).padStart(2, "0")}`;
  const rows = read("docs/01_PRD.md").split("\n").filter((line) => line.startsWith(`| ${id} |`));
  if (rows.length !== 1) throw new Error(`Requirement must have one authoritative PRD row: ${id}`);
}
for (const [prefix, count] of [["PAGE", 11], ["FLOW", 6]]) {
  for (let index = 1; index <= count; index += 1) {
    const id = `${prefix}-${String(index).padStart(3, "0")}`;
    const rows = read("docs/02_PRODUCT_STRUCTURE.md").split("\n").filter((line) => line.startsWith(`| ${id} |`));
    if (rows.length !== 1) throw new Error(`Route/flow must have one authoritative structure row: ${id}`);
  }
}
requireText("docs/01_PRD.md", "## Факты и placeholders");
for (const status of ["TECHNICAL_COMPLETE", "DERIVATION_READY", "DERIVED_RELEASE_READY", "PUBLIC_RELEASE_READY", "DEPLOYED"]) {
  requireText("docs/05_RELEASE_CHECKLIST.md", `| ${status} |`);
}

for (const file of [
  "docs/AUTH.md",
  "docs/DATA_MODEL.md",
  "docs/SECURITY.md",
  "docs/ENVIRONMENT.md",
  "docs/RUNBOOK_DEPLOY.md",
  "docs/EXTERNAL_SITE_DESIGN_SYSTEM.md",
  "docs/INTERNAL_DASHBOARD_DESIGN_SYSTEM.md",
  "docs/ops/LOCAL_DEVELOPMENT.md",
  "docs/ops/RECOVERY.md",
]) {
  requireText(file, "**Status:** Active extension");
}

for (const section of ["## PII lifecycle", "## Version matrix and verified exceptions", "https://www.postgresql.org/docs/18/ddl-rowsecurity.html"]) {
  requireText("docs/03_ARCHITECTURE.md", section);
}

function markdownFiles(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? markdownFiles(file) : entry.isFile() && file.endsWith(".md") ? [file] : [];
  });
}

const checkedLinks = verifyDocumentationLinks(root, ["README.md", "AGENTS.md", ...markdownFiles("docs")]);
console.log(`docs_links=PASS count=${checkedLinks}`);
console.log("docs_canon=PASS");
