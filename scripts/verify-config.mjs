import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isExecutionArtifact } from "./execution-artifact-policy.mjs";
import createManifest from "../src/platform/pwa/manifest.ts";
import { GET as manifestResponse } from "../src/app/manifest.webmanifest/route.ts";
import { parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { isModuleEnabled } from "../src/platform/config/optional-modules.ts";

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

const identityManifest = parseProjectIdentityJson(await readFile(path.join(root, "starter.identity.json"), "utf8"));
if (isModuleEnabled(identityManifest.derivation.optionalModules, "pwa")) {
  const appManifest = createManifest();
  if (
    appManifest.name !== identityManifest.identity.productName
    || appManifest.short_name !== identityManifest.identity.shortName
    || appManifest.icons?.[0]?.src !== identityManifest.identity.iconPath
    || appManifest.display !== "standalone"
  ) {
    violations.push("src/platform/pwa/manifest.ts: PWA manifest must be installable and match starter.identity.json");
  }
} else {
  if (manifestResponse().status !== 404) violations.push("src/app/manifest.webmanifest/route.ts: disabled PWA must close the manifest endpoint");
}

if (await readdir(path.join(root, "public")).then((files) => files.includes("sw.js"))) violations.push("public/sw.js: static worker bypasses optional capability guard");
const serviceWorker = await readFile(path.join(root, "src/platform/pwa/service-worker.js"), "utf8");
for (const privatePath of ["/api/", "/admin/", "/dashboard/", "/notifications/"]) {
  if (!serviceWorker.includes(`"${privatePath}"`)) {
    violations.push(`src/platform/pwa/service-worker.js: missing private cache exclusion ${privatePath}`);
  }
}
if (/cache\.put\(request/.test(serviceWorker) && !serviceWorker.includes("isPrivateRequest(url)")) {
  violations.push("src/platform/pwa/service-worker.js: cache policy must skip private requests");
}

if (violations.length > 0) {
  console.error(`Starter config verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Starter config verified: neutral brand, removed vertical markers and safe PWA cache policy.");
