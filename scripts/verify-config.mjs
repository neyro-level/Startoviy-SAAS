import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isExecutionArtifact } from "./execution-artifact-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const forbiddenTokens = [
  ["AMS", String.fromCharCode(73, 77, 80, 85, 76, 83, 69)].join(" "),
  ["ИМ", "ПУЛЬС"].join(""),
  ["seo", "monitor"].join("-"),
  ["seo", "monitor"].join("_"),
  ["YAN", "DEX"].join(""),
  ["MET", "RICA"].join(""),
  ["WEB", "MASTER"].join(""),
  ["TOP", "VISOR"].join(""),
  ["SEO", "ANALYST"].join("_"),
];
const forbiddenPatterns = forbiddenTokens.map((token) => new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
  "coverage",
  "graphify-out",
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Local execution inputs are not product code or permanent canon.
      if (isExecutionArtifact(path.relative(root, entryPath))) continue;
      files.push(...await collectFiles(entryPath));
      continue;
    }
    if (entry.isFile() && /\.(?:cjs|css|html|js|json|md|mjs|prisma|sh|ts|tsx|yaml|yml)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

const violations = [];
for (const file of await collectFiles(root)) {
  const relativeFile = path.relative(root, file).replaceAll("\\", "/");
  // Preserve the owner's ignored root input; tracked planning files are
  // rejected by docs:check rather than exempted from inherited-tree checks.
  if (!relativeFile.includes("/") && isExecutionArtifact(relativeFile)) continue;
  const content = await readFile(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      violations.push(`${relativeFile}: ${pattern.source}`);
    }
  }
}

const identityManifest = JSON.parse(await readFile(path.join(root, "starter.identity.json"), "utf8"));
const expectedProductName = identityManifest.mode === "derived"
  ? identityManifest.identity?.productName
  : "АМС Старт";
const appManifest = await readFile(path.join(root, "src/app/manifest.ts"), "utf8");
if (
  typeof expectedProductName !== "string"
  || !expectedProductName.trim()
  || !appManifest.includes(`name: ${JSON.stringify(expectedProductName)}`)
  || !appManifest.includes('display: "standalone"')
) {
  violations.push("src/app/manifest.ts: PWA manifest must be installable and match starter.identity.json");
}

const serviceWorker = await readFile(path.join(root, "public/sw.js"), "utf8");
for (const privatePath of ["/api/", "/admin/", "/dashboard/", "/notifications/"]) {
  if (!serviceWorker.includes(`"${privatePath}"`)) {
    violations.push(`public/sw.js: missing private cache exclusion ${privatePath}`);
  }
}
if (/cache\.put\(request/.test(serviceWorker) && !serviceWorker.includes("isPrivateRequest(url)")) {
  violations.push("public/sw.js: cache policy must skip private requests");
}

if (violations.length > 0) {
  console.error(`Starter config verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Starter config verified: neutral brand, removed vertical markers and safe PWA cache policy.");
