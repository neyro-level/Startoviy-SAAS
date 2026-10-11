import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoInheritedExecutionArtifacts } from "./execution-artifact-policy.mjs";
import { runDerivationSmoke } from "./derivation-smoke.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const derivedRepository = "https://github.com/clean-room/atlas-portal.git";
const sample = {
  productName: "Atlas Portal",
  productSlug: "atlas-portal",
  publicOrigin: "https://atlas.test",
  serviceId: "atlas-portal",
  workerId: "atlas-portal-worker",
  databaseApplicationPrefix: "atlas-portal",
  artifactPrefix: "atlas-portal",
  repositorySlug: "atlas-portal",
  legalOperatorName: "Clean Room Operator",
  legalOperatorEmail: "operator@atlas.test",
  legalOperatorAddress: "Clean Room Verification Address",
};
const replacements = [
  [["https://", "ams", "-start.example"].join(""), sample.publicOrigin],
  [["ams", "-start.example"].join(""), new URL(sample.publicOrigin).hostname],
  [["ams", "-microsaas-starter"].join(""), sample.repositorySlug],
  [["ams", "-favicon"].join(""), `${sample.productSlug}-favicon`],
  [["AMS", "_START"].join(""), "ATLAS_PORTAL"],
  [["ams", "_start"].join(""), "atlas_portal"],
  [["ams", "-start"].join(""), sample.productSlug],
  [["АМС", " Старт"].join(""), sample.productName],
  [["TO", "DO:"].join(""), "Configured:"],
  ["DELIVERY_PROFILE = EXPERIMENT", "DELIVERY_PROFILE = COMMERCIAL"],
];

function transform(value) {
  return replacements.reduce((result, [from, to]) => result.replaceAll(from, to), value);
}

function trackedFiles(sourceRoot) {
  return execFileSync("git", ["ls-files", "-z"], { cwd: sourceRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

export function createDisposableCopy(root, sourceRoot = repositoryRoot, moduleState = null) {
  if (moduleState !== null && !["enabled", "disabled", "not_applicable"].includes(moduleState)) throw new Error("Invalid optional-module smoke profile");
  const files = trackedFiles(sourceRoot);
  // Check the original index before copying: the destination .gitignore may
  // otherwise hide a force-added execution artifact from its new Git index.
  assertNoInheritedExecutionArtifacts(files);
  for (const relativePath of files) {
    // The default derived product uses GitHub; a SourceCraft mirror is opt-in.
    if (relativePath.startsWith(".sourcecraft/")) continue;
    const source = path.join(sourceRoot, relativePath);
    if (!existsSync(source)) continue;
    const destination = path.join(root, transform(relativePath));
    mkdirSync(path.dirname(destination), { recursive: true });
    const contents = readFileSync(source);
    if (contents.includes(0)) copyFileSync(source, destination);
    else writeFileSync(destination, transform(contents.toString("utf8")));
    chmodSync(destination, statSync(source).mode);
  }

  const manifestPath = path.join(root, "starter.identity.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.mode = "derived";
  manifest.identity = { ...manifest.identity, ...sample,
    shortName: sample.productName, brandMark: "AP", brandWordmark: "PORTAL",
    iconPath: "/atlas-portal-icon.svg", faviconPath: "/atlas-portal-favicon.svg",
    legalOperatorInn: "1234567890", legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
  };
  manifest.legalReferences = { factsDocument: "docs/01_PRD.md", status: "REQUIRES_CHECK" };
  manifest.derivation = {
    sourceRepository: derivedRepository,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim(),
    gitProvider: "github",
    defaultBranch: "main",
    deliveryProfile: "COMMERCIAL",
    migrationOwner: sample.productSlug,
    optionalModules: {
      outboxPlusQueue: "enabled",
      pwa: "enabled",
      platformAdmin: "disabled",
      outboundHttp: "disabled", objectStorage: "disabled",
    },
  };
  if (moduleState) manifest.derivation.optionalModules = {
    outboxPlusQueue: moduleState, pwa: moduleState, platformAdmin: moduleState,
    outboundHttp: moduleState === "enabled" ? "disabled" : moduleState,
    objectStorage: moduleState === "enabled" ? "disabled" : moduleState,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const flags = new Map();
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]; const value = args[index + 1];
    if (!["--modules", "--runs", "--native", "--browser", "--evidence"].includes(key) || !value || value.startsWith("--") || flags.has(key)) throw new Error("Invalid smoke option/value");
    flags.set(key, value);
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  try {
    const evidence = await runDerivationSmoke({ sourceRoot: repositoryRoot, moduleState: flags.get("--modules") ?? null,
      runs: Number(flags.get("--runs") ?? 2), native: flags.get("--native") ?? "auto", browser: flags.get("--browser") ?? "auto",
      evidencePath: flags.has("--evidence") ? path.resolve(flags.get("--evidence")) : null, signal: controller.signal });
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    if (error.evidence) process.stdout.write(`${JSON.stringify(error.evidence)}\n`);
    process.stderr.write("Derivation smoke failed or cancelled; required checks were not all proven.\n");
    process.exitCode = controller.signal.aborted ? 130 : 1;
  } finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
