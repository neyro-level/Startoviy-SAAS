import { parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const starterSlug = ["ams", "start"].join("-");
const starterTokens = [
  starterSlug,
  ["ams", "start"].join("_"),
  ["AMS", "START"].join("_"),
  ["ams", "favicon"].join("-"),
  ["АМС", "Старт"].join(" "),
  `https://${starterSlug}.example`,
  ["TO", "DO:"].join(""),
  ["ams", "microsaas", "starter"].join("-"),
];
const requiredIdentityFields = [
  "productName",
  "productSlug",
  "publicOrigin",
  "serviceId",
  "workerId",
  "databaseApplicationPrefix",
  "artifactPrefix",
  "repositorySlug",
  "legalOperatorName",
  "legalOperatorEmail",
  "legalOperatorAddress",
];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".release-artifacts",
  "coverage",
  "graphify-out",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const derivationContractFiles = new Set([
  "docs/DERIVATION.md",
  "docs/adr/ADR-004-neutral-identity-derivation-contract.md",
  "scripts/verify-derivation.mjs",
  "scripts/verify-clean-room-derivation.mjs",
  "tests/derivation-contract.test.ts",
]);
const textFilePattern = /\.(?:cjs|css|html|js|json|md|mjs|prisma|sh|svg|ts|tsx|yaml|yml)$/u;

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function listFallbackFiles(root, relativeRoot = "") {
  return readdirSync(path.join(root, relativeRoot), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : listFallbackFiles(root, relativePath);
    }
    return entry.isFile() ? [relativePath] : [];
  });
}

function listTrackedFiles(root) {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "-z"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split("\0").filter(Boolean);
  } catch {
    return listFallbackFiles(root);
  }
}

export function verifyDerivation({ root, manifestPath }) {
  let manifest;
  try { manifest = parseProjectIdentityJson(readFileSync(manifestPath, "utf8")); }
  catch (error) { return [error.message]; }
  const violations = [];
  if (manifest.mode !== "derived") violations.push("identity manifest mode must be derived");
  for (const field of requiredIdentityFields) {
    const value = manifest.identity?.[field];
    if (typeof value === "string" && starterTokens.some((token) => value.includes(token))) {
      violations.push(`identity.${field} still contains a starter placeholder`);
    }
  }

  for (const relativePath of listTrackedFiles(root)) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    const filePath = path.join(root, relativePath);
    if (
      derivationContractFiles.has(normalizedPath)
      || !existsSync(filePath)
      || !textFilePattern.test(normalizedPath)
    ) continue;
    const content = readFileSync(filePath, "utf8");
    for (const token of starterTokens) {
      if (normalizedPath.includes(token) || content.includes(token)) {
        violations.push(`unresolved starter token in ${normalizedPath}`);
        break;
      }
    }
  }

  return [...new Set(violations)].sort();
}

function main() {
  const root = path.resolve(readArgument("--root") ?? ".");
  const manifestPath = path.resolve(root, readArgument("--manifest") ?? "starter.identity.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Identity manifest not found: ${path.relative(root, manifestPath)}`);
  }
  const violations = verifyDerivation({ root, manifestPath });
  if (violations.length > 0) {
    throw new Error(`Derivation verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  }
  process.stdout.write("derivation_identity=valid\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
