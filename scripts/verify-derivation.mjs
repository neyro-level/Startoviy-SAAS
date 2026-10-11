import { parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isExecutionArtifact } from "./execution-artifact-policy.mjs";
import { scanText } from "./ci/scan-secrets.mjs";

// Assemble definitions so the verifier itself has no exemption from scanning.
export const sourceMarkers = [
  ["ams", "start"].join("-"), ["ams", "start"].join("_"),
  ["ams", "favicon"].join("-"), ["АМС", "Старт"].join(" "),
  ["TO", "DO:"].join(""), ["ams", "microsaas", "starter"].join("-"),
  ["Startoviy", "SAAS"].join("-"),
  ["ams", "starter"].join("_"),
];
export const donorMarkers = [
  ["ams", "data", "hub"].join("-"), ["ams", "data", "hub"].join("_"),
  ["AMS", "Data", "Hub"].join(" "), ["Data", "Hub"].join(" "), ["Data", "Hub"].join(""),
];
export const historicalReference = `Historical upstream reference only: ${["https://github.com", "neyro-level", ["Startoviy", "SAAS"].join("-")].join("/")}`;
const historicalFile = "docs/adr/ADR-004-neutral-identity-derivation-contract.md";
const fallbackLocalDirectories = new Set([".git", "node_modules", ".next", ".runtime", "generated"]);
const privateDirectory = /^(?:\.git|\.aws|\.ssh|\.codex|\.agents|\.cache|node_modules|\.next|\.runtime)$/i;
const credentialPath = (file) => file.split("/").some((part) => privateDirectory.test(part)
  || (part.startsWith(".env") && part !== ".env.example")
  || /^(?:credentials|id_rsa|id_ed25519)$|\.(?:pem|key|p12|pfx)$/i.test(part));
const markersIn = (value, markers) => markers.some((marker) => value.toLocaleLowerCase("en-US").includes(marker.toLocaleLowerCase("en-US")));
const safePath = (file) => scanText(file).length ? "<redacted path>" : /[\u0000-\u001f]/u.test(file) ? JSON.stringify(file) : file;
// Git paths use '/', native Windows paths use '\\'; inspect both forms.
export const symlinkParent = (root, file) => file.split(/[\\/]/u).slice(0, -1)
  .some((_part, index, parts) => lstatSync(path.join(root, ...parts.slice(0, index + 1))).isSymbolicLink());

function localFiles(root, relativeRoot = "") {
  return readdirSync(path.join(root, relativeRoot), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      if (fallbackLocalDirectories.has(entry.name)) return [];
      return credentialPath(relative) || isExecutionArtifact(relative) ? [relative] : localFiles(root, relative);
    }
    return [relative];
  });
}

function sourceFiles(root) {
  try {
    return execFileSync("git", ["--no-optional-locks", "-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024,
    }).split("\0").filter(Boolean);
  } catch { return localFiles(root); }
}

function withoutHistoricalReference(file, content) {
  let historical = false; let used = false;
  return content.split("\n").map((line) => {
    if (line.startsWith("## ")) historical = line === "## Historical upstream reference";
    if (file === historicalFile && historical && !used && line === historicalReference) { used = true; return ""; }
    return line;
  }).join("\n");
}

export function verifyDerivation({ root, manifestPath }) {
  let manifest;
  const manifestRelative = path.relative(path.resolve(root), path.resolve(manifestPath));
  if (!manifestRelative || manifestRelative.startsWith(`..${path.sep}`) || path.isAbsolute(manifestRelative)) return ["Identity manifest must be inside the product root"];
  if (credentialPath(manifestRelative.replaceAll("\\", "/")) || isExecutionArtifact(manifestRelative)) return ["Identity manifest cannot be private or execution material"];
  try {
    const stat = lstatSync(manifestPath);
    if (symlinkParent(root, manifestRelative) || !stat.isFile() || stat.isSymbolicLink()) return ["Identity manifest must be a regular source file"];
    if (stat.size > 16 * 1024 * 1024) return ["Identity manifest exceeds bounded scan size"];
  }
  catch { return ["Identity manifest is missing"]; }
  try { manifest = parseProjectIdentityJson(readFileSync(manifestPath, "utf8")); }
  catch (error) { return [`identity manifest validation failed in ${safePath(manifestRelative)}: ${error.message}`]; }
  const violations = [];
  if (manifest.mode !== "derived") violations.push("identity manifest mode must be derived");
  for (const relative of [...new Set(sourceFiles(root))].sort()) {
    const file = relative.replaceAll("\\", "/");
    const label = safePath(file);
    if (file.startsWith("/") || file.split("/").includes("..")) { violations.push("unsafe indexed source path"); continue; }
    if (isExecutionArtifact(file)) { violations.push(`inherited execution artifact in ${label}`); continue; }
    if (credentialPath(file)) { violations.push(`private/local material in ${label}`); continue; }
    if (scanText(file).length) { violations.push(`credential pattern in ${label}`); continue; }
    if (markersIn(file, sourceMarkers)) violations.push(`unresolved starter token in path ${label}`);
    if (markersIn(file, donorMarkers)) violations.push(`donor identity in path ${label}`);
    const absolute = path.join(root, file);
    let stat;
    try {
      if (symlinkParent(root, relative)) {
        violations.push(`symlink parent in ${label}`); continue;
      }
      stat = lstatSync(absolute);
    }
    catch { violations.push(`missing indexed source in ${label}`); continue; }
    if (!stat.isFile() || stat.isSymbolicLink()) { violations.push(`unsupported source mode in ${label}`); continue; }
    if (stat.size > 16 * 1024 * 1024) { violations.push(`source exceeds bounded scan size in ${label}`); continue; }
    // Every regular file is scanned, including SQL/conf/env examples and UTF-8
    // metadata in otherwise binary assets. No folder/extension exemptions.
    const raw = readFileSync(absolute).toString("utf8");
    if (scanText(raw).length) violations.push(`credential pattern in ${label}`);
    const content = withoutHistoricalReference(file, raw);
    if (markersIn(content, sourceMarkers)) violations.push(`unresolved starter token in ${label}`);
    if (markersIn(content, donorMarkers)) violations.push(`donor identity in ${label}`);
    if (file.startsWith("ops/nginx/") && file.endsWith(".conf")) {
      const origin = new URL(manifest.identity.publicOrigin);
      const names = [...raw.matchAll(/^[ \t]*server_name[ \t]+([^;]+);/gm)].map((match) => match[1].trim());
      if (!names.length || names.some((name) => name !== origin.hostname)) violations.push(`public origin mismatch in ${label}`);
      const ports = [...raw.matchAll(/^[ \t]*listen[ \t]+(?:\[::\]:)?([0-9]+)[ \t]+ssl/gm)].map((match) => match[1]);
      if (!ports.length || ports.some((port) => port !== (origin.port || "443"))) violations.push(`public HTTPS port mismatch in ${label}`);
    }
  }
  return [...new Set(violations)].sort();
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function main() {
  const root = path.resolve(readArgument("--root") ?? ".");
  const manifestPath = path.resolve(root, readArgument("--manifest") ?? "starter.identity.json");
  if (!existsSync(manifestPath)) throw new Error("Identity manifest is missing");
  const violations = verifyDerivation({ root, manifestPath });
  if (violations.length) throw new Error(`Derivation verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  process.stdout.write("derivation_identity=valid\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
