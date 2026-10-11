import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDerivation } from "./verify-derivation.mjs";
import { validateGithubPolicy } from "./ci/verify-github-policy.mjs";
import { assertNoInheritedExecutionArtifacts } from "./execution-artifact-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const derivedRepository = "https://github.com/clean-room/atlas-portal.git";
const sample = {
  productName: "Atlas Portal",
  productSlug: "atlas-portal",
  publicOrigin: "https://atlas.example.com",
  serviceId: "atlas-portal",
  workerId: "atlas-portal-worker",
  databaseApplicationPrefix: "atlas-portal",
  artifactPrefix: "atlas-portal",
  repositorySlug: "atlas-portal",
  legalOperatorName: "Clean Room Operator",
  legalOperatorEmail: "operator@atlas.example.com",
  legalOperatorAddress: "Clean Room Verification Address",
};
const proofEnvironment = {
  BETTER_AUTH_URL: sample.publicOrigin,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
};
const replacements = [
  [["https://", "ams", "-start.example"].join(""), sample.publicOrigin],
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

function run(command, args, cwd) {
  const isWindowsPnpm = process.platform === "win32" && command === "pnpm";
  const executable = isWindowsPnpm ? (process.env.ComSpec ?? "cmd.exe") : command;
  const commandArgs = isWindowsPnpm ? ["/d", "/s", "/c", ["pnpm", ...args].join(" ")] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env: { ...process.env, ...proofEnvironment, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}.`);
}

function trackedFiles(sourceRoot) {
  return execFileSync("git", ["ls-files", "-z"], { cwd: sourceRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

export function createDisposableCopy(root, sourceRoot = repositoryRoot) {
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
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function assertRepositoryContract(root) {
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim();
  if (branch !== "main") throw new Error(`Derived default branch mismatch: ${branch}`);
  if (remote !== derivedRepository) {
    throw new Error("Derived repository origin mismatch.");
  }
  if (existsSync(path.join(root, ".sourcecraft"))) throw new Error("GitHub-only copy inherited an optional mirror.");
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  assertNoInheritedExecutionArtifacts(files);
  validateGithubPolicy(readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"), {
    nodeVersion: readFileSync(path.join(root, ".node-version"), "utf8").trim(),
    packageManager: JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).packageManager,
    vendorWorkflow: readFileSync(path.join(root, ".github/workflows/ams-verify.yml"), "utf8"),
    vendorLock: JSON.parse(readFileSync(path.join(root, ".github/workflows/ams-verify.yml.lock.json"), "utf8")),
  });
  const architecture = readFileSync(path.join(root, "docs/03_ARCHITECTURE.md"), "utf8");
  if (!architecture.includes("DELIVERY_PROFILE = COMMERCIAL")) {
    throw new Error("Derived delivery profile transition was not recorded.");
  }
  const migrations = execFileSync("git", ["ls-files", "prisma/migrations"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean);
  if (migrations.length === 0) throw new Error("Derived migration baseline is empty.");
  const migrationText = migrations.map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");
  if (!migrationText.includes("atlas_portal_web") || migrationText.includes(["ams", "_start"].join(""))) {
    throw new Error("Derived migration runtime-role ownership was not renamed.");
  }
}

function main() {
  // pnpm may choose a different default store for /tmp on another filesystem.
  // Reuse the source install's actual store and keep the copy install offline.
  proofEnvironment.pnpm_config_store_dir = execFileSync(
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm",
    process.platform === "win32" ? ["/d", "/s", "/c", "pnpm store path"] : ["store", "path"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  const root = mkdtempSync(path.join(tmpdir(), "ams-clean-room-proof-"));
  try {
    createDisposableCopy(root);
    run("git", ["init", "--quiet", "--initial-branch=main"], root);
    run("git", ["remote", "add", "origin", derivedRepository], root);
    run("git", ["add", "."], root);
    run("git", ["-c", "user.name=Clean Room Proof", "-c", "user.email=proof@localhost", "commit", "--quiet", "-m", "Initialize derived product"], root);

    const violations = verifyDerivation({ root, manifestPath: path.join(root, "starter.identity.json") });
    if (violations.length > 0) {
      throw new Error(`Clean-room identity violations:\n${violations.map((item) => `- ${item}`).join("\n")}`);
    }
    assertRepositoryContract(root);
    run("pnpm", ["install", "--offline", "--frozen-lockfile"], root);
    run("pnpm", ["prisma:generate"], root);
    run("pnpm", ["docs:check"], root);
    run("pnpm", ["verify:quick"], root);
    run("pnpm", ["test:unit"], root);
    run("pnpm", ["build"], root);
    process.stdout.write(`${JSON.stringify({ status: "PASS", disposable: true, published: false, production: false })}\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
