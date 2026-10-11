import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyProduct, planProduct, readBlobs } from "./product-generator.mjs";
import { parseProjectIdentity, parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { isModuleEnabled } from "../src/platform/config/optional-modules.ts";
import { assertNoInheritedExecutionArtifacts } from "./execution-artifact-policy.mjs";
import { scanText } from "./ci/scan-secrets.mjs";
import { sourceMarkers, verifyDerivation } from "./verify-derivation.mjs";
import { runProofProcess } from "./proof-process.mjs";
import { startDisposablePostgres } from "./disposable-postgres.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (root, ...args) => execFileSync("git", ["--no-optional-locks", "-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const textGit = (root, ...args) => git(root, ...args).toString("utf8").trim();

export function sourceState(root) {
  const index = path.resolve(root, textGit(root, "rev-parse", "--git-path", "index"));
  return { sha: textGit(root, "rev-parse", "HEAD"), tree: textGit(root, "rev-parse", "HEAD^{tree}"),
    origin: textGit(root, "remote", "get-url", "origin"), index: hash(readFileSync(index)),
    status: textGit(root, "status", "--porcelain", "--untracked-files=no") };
}

export function buildSmokeIdentity(source, sha, moduleState) {
  if (source.mode === "derived") {
    if (moduleState && ["pwa", "platformAdmin", "outboxPlusQueue"].some((name) => source.derivation.optionalModules[name] !== moduleState)) throw new Error("Derived rehearsal preserves its selected module profile");
    return source;
  }
  const identity = { ...source.identity,
    productName: "Atlas Portal", shortName: "Atlas", productSlug: "atlas-portal", publicOrigin: "https://atlas.example.com",
    serviceId: "atlas-portal", workerId: "atlas-portal-worker", databaseApplicationPrefix: "atlas-portal", artifactPrefix: "atlas-portal", repositorySlug: "atlas-portal",
    iconPath: "/atlas-portal-icon.svg", faviconPath: "/atlas-portal-favicon.svg", brandMark: "AP", brandWordmark: "PORTAL",
    legalOperatorName: "Synthetic Proof Operator", legalOperatorEmail: "operator@atlas.example.com", legalOperatorAddress: "Synthetic Proof Address",
    legalOperatorInn: "1234567890", legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
  };
  const selected = moduleState ? { outboxPlusQueue: moduleState, pwa: moduleState, platformAdmin: moduleState,
    outboundHttp: moduleState === "enabled" ? "disabled" : moduleState, objectStorage: moduleState === "enabled" ? "disabled" : moduleState } : source.derivation.optionalModules;
  return parseProjectIdentity({ ...source, mode: "derived", identity,
    legalReferences: { factsDocument: "docs/01_PRD.md", status: "REQUIRES_CHECK" },
    derivation: { ...source.derivation, sourceRepository: "https://github.com/clean-room/atlas-portal.git", sourceRevision: sha, migrationOwner: identity.productSlug, optionalModules: selected } });
}

function ownRehearsal(sourceRoot, sha, target, identity) {
  const entries = git(sourceRoot, "ls-tree", "-rz", "--full-tree", sha).toString("utf8").split("\0").filter(Boolean).map((record) => {
    const split = record.indexOf("\t"); const [mode, type, oid] = record.slice(0, split).split(" ");
    return { mode, type, oid, file: record.slice(split + 1) };
  });
  assertNoInheritedExecutionArtifacts(entries.map((entry) => entry.file));
  for (const entry of entries) {
    if (!/^100(?:644|755)$/.test(entry.mode) || entry.type !== "blob") throw new Error("Rehearsal forbids symlinks/submodules");
    if (entry.file.startsWith("/") || entry.file.split("/").some((part) => part === ".." || /^(?:\.git|\.aws|\.ssh|\.codex|\.agents|node_modules|\.next|\.runtime|credentials|id_rsa|id_ed25519)$/i.test(part) || (part.startsWith(".env") && part !== ".env.example") || /\.(?:pem|key|p12|pfx)$/i.test(part)) || /[\\\u0000-\u001f<>:"|?*]/u.test(entry.file) || scanText(entry.file).length) throw new Error("Rehearsal forbids private/local paths");
  }
  const blobs = readBlobs(sourceRoot, entries);
  for (const bytes of blobs.values()) if (scanText(bytes.toString("utf8")).length) throw new Error("Rehearsal source contains a credential pattern");
  mkdirSync(target);
  const files = [];
  for (const entry of entries) {
    const destination = path.join(target, entry.file); mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, blobs.get(entry.file), { flag: "wx", mode: entry.mode === "100755" ? 0o755 : 0o644 });
    files.push({ to: entry.file, mode: entry.mode, sha256: hash(blobs.get(entry.file)) });
  }
  git(target, "init", "--quiet", "--template=", "--initial-branch=main");
  git(target, "remote", "add", "origin", identity.derivation.sourceRepository);
  const hooks = path.join(target, ".git", "proof-no-hooks"); mkdirSync(hooks);
  git(target, "-c", `core.hooksPath=${hooks}`, "add", ".");
  const indexed = new Set(git(target, "ls-files", "-z").toString("utf8").split("\0").filter(Boolean));
  if (files.some((file) => !indexed.has(file.to))) throw new Error("Rehearsal ignore hides permanent source");
  git(target, "-c", `core.hooksPath=${hooks}`, "-c", "commit.gpgSign=false", "-c", "user.name=Product Rehearsal", "-c", "user.email=rehearsal@localhost", "commit", "--quiet", "-m", "Rehearse owned product");
  return files;
}

function proofEnvironment() {
  const allowed = ["PATH", "HOME", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "TEMP", "TMP", "TMPDIR", "COREPACK_HOME", "PNPM_HOME", "pnpm_config_store_dir", "PLAYWRIGHT_BROWSERS_PATH", "DOCKER_HOST", "DOCKER_CONTEXT", "GITHUB_ACTIONS", "RUNNER_ENVIRONMENT"];
  return { ...Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])),
    APP_ENV: "test", CI: "1", COREPACK_ENABLE_NETWORK: "0", NEXT_TELEMETRY_DISABLED: "1", BETTER_AUTH_SECRET: randomBytes(32).toString("hex") };
}

export async function runDerivationSmoke({ sourceRoot, moduleState = null, runs = 2, native = "auto", browser = "auto", signal, evidencePath = null }) {
  if (![1, 2].includes(runs) || ![null, "enabled", "disabled", "not_applicable"].includes(moduleState) || !["auto", "required", "off"].includes(native) || !["auto", "required", "off"].includes(browser)) throw new Error("Invalid smoke options");
  sourceRoot = realpathSync(sourceRoot);
  if (realpathSync(textGit(sourceRoot, "rev-parse", "--show-toplevel")) !== sourceRoot) throw new Error("Smoke requires the exact repository root");
  const before = sourceState(sourceRoot);
  if (before.status) throw new Error("Smoke requires a clean exact source commit");
  if (evidencePath) {
    evidencePath = path.join(realpathSync(path.dirname(evidencePath)), path.basename(evidencePath));
    const relative = path.relative(realpathSync(sourceRoot), evidencePath);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("Proof evidence must be outside inherited source");
    if (existsSync(evidencePath)) throw new Error("Proof evidence cannot overwrite existing work");
  }
  const source = parseProjectIdentityJson(textGit(sourceRoot, "show", `${before.sha}:starter.identity.json`));
  const identity = buildSmokeIdentity(source, before.sha, moduleState);
  const environment = proofEnvironment(); environment.BETTER_AUTH_URL = identity.identity.publicOrigin;
  environment.PGPASSFILE = path.join(tmpdir(), `ams-proof-no-pgpass-${randomBytes(16).toString("hex")}`);
  const capture = async (command, args, cwd = sourceRoot) => (await runProofProcess(command, args, { cwd, env: environment, signal, capture: true, timeoutMs: 30_000 })).stdout.trim();
  environment.pnpm_config_store_dir = await capture("pnpm", ["store", "path"]);
  const packageInfo = JSON.parse(textGit(sourceRoot, "show", `${before.sha}:package.json`));
  const nodeVersion = textGit(sourceRoot, "show", `${before.sha}:.node-version`);
  const pnpmVersion = await capture("pnpm", ["--version"]);
  if (process.versions.node !== nodeVersion || packageInfo.packageManager !== `pnpm@${pnpmVersion}`) throw new Error("Smoke must use the exact frozen Node/pnpm versions");
  const evidence = { schemaVersion: 1, sourceSha: before.sha, sourceTree: before.tree, mode: source.mode === "starter" ? "GENERATOR" : "DERIVED_REHEARSAL", slug: identity.identity.productSlug,
    profile: identity.derivation.deliveryProfile, versions: { node: process.versions.node, pnpm: pnpmVersion, next: packageInfo.dependencies.next, prisma: packageInfo.dependencies.prisma ?? packageInfo.devDependencies.prisma, playwright: packageInfo.devDependencies["@playwright/test"] },
    published: false, production: false, status: "RUNNING", runs: [], cleanup: "REQUIRES_CHECK" };
  let fingerprint;
  try {
    for (let index = 0; index < runs; index += 1) {
      if (signal?.aborted) throw new Error("Proof cancelled");
      const directory = mkdtempSync(path.join(tmpdir(), "ams-derivation-rehearsal-"));
      const root = path.join(directory, "product");
      let database;
      const record = { ordinal: index + 1, checks: [], native: { status: "NOT_RUN" }, browser: { status: "NOT_RUN" }, cleanup: "REQUIRES_CHECK" };
      evidence.runs.push(record);
      const run = async (command, args, extraEnv = {}) => {
        try { await runProofProcess(command, args, { cwd: root, env: { ...environment, ...extraEnv }, signal, timeoutMs: 600_000 }); }
        catch (error) { record.checks.push({ command: [command, ...args].join(" "), status: signal?.aborted ? "CANCELLED" : "FAIL" }); throw error; }
        record.checks.push({ command: [command, ...args].join(" "), status: "PASS" });
      };
      try {
        let files;
        if (source.mode === "starter") {
          const options = { sourceRoot, sourceSha: before.sha, targetRoot: root, input: identity };
          const plan = planProduct(options);
          if (planProduct(options).planHash !== plan.planHash || existsSync(root)) throw new Error("Generator dry-run is not deterministic/nonmutating");
          applyProduct(options, plan.planHash); files = plan.files;
        } else files = ownRehearsal(sourceRoot, before.sha, root, identity);
        const current = hash(JSON.stringify(files.map(({ to, mode, sha256 }) => ({ to, mode, sha256 }))));
        if (fingerprint && current !== fingerprint) throw new Error("Repeated product contents are nondeterministic");
        fingerprint = current; record.fingerprint = current; record.derivedSha = textGit(root, "rev-parse", "HEAD");
        const verify = () => verifyDerivation({ root, manifestPath: path.join(root, "starter.identity.json") });
        if (verify().length) throw new Error("Generated/rehearsed source identity failed");
        const readme = path.join(root, "README.md"); const original = readFileSync(readme);
        try { writeFileSync(readme, Buffer.concat([original, Buffer.from(`\n${sourceMarkers[0]}\n`)])); if (!verify().some((message) => message.includes("README.md"))) throw new Error("Restored source identity was not rejected"); }
        finally { writeFileSync(readme, original); }
        record.checks.push({ command: "derive negative restored identity", status: "PASS" });
        await run("pnpm", ["install", "--offline", "--frozen-lockfile"]);
        await run("pnpm", ["prisma:generate"]);
        await run("pnpm", ["exec", "prisma", "validate"]);
        await run("pnpm", ["derive:verify"]);
        await run("pnpm", ["docs:check"]);
        await run("pnpm", ["verify:quick"]);
        await run("pnpm", ["test:unit"]);
        await run("pnpm", ["build"]);
        await run("pnpm", ["worker:build"]);
        await run("node", ["scripts/verify-optional-profile.mjs"]);
        if (native !== "off") {
          try { database = await startDisposablePostgres({ directory, env: environment, signal, slug: identity.identity.productSlug }); }
          catch (error) { record.native = { status: signal?.aborted ? "CANCELLED" : native === "required" ? "FAIL" : "BLOCKED", reason: "Owned PostgreSQL18 backend unavailable" }; if (signal?.aborted || native === "required") throw error; }
          if (database) {
            record.native = { status: "RUNNING", version: database.version };
            await run("node", ["scripts/verify-test-database-env.mjs"], database.environment);
            const suites = isModuleEnabled(identity.derivation.optionalModules, "outboxPlusQueue") ? [] : ["tests/integration/postgresql-foundation.integration.test.ts", "tests/integration/account-setup.integration.test.ts", "tests/integration/tenant-isolation.integration.test.ts", "tests/integration/principal-runtime-adoption.integration.test.ts", "tests/integration/command-atomicity.integration.test.ts"];
            await run("pnpm", ["test:integration", ...suites], database.environment);
            record.native = { status: "PASS", version: database.version, scope: suites.length ? "CORE_WITH_OUTBOX_DISABLED" : "FULL_CLEAN_REPEATED_REVERSE" };
          }
        } else record.native = { status: "NOT_RUN", reason: "Explicit off selection" };
        if (browser !== "off") {
          const require = createRequire(path.join(root, "package.json"));
          const chromium = require("@playwright/test").chromium;
          if (!database || !existsSync(chromium.executablePath())) {
            record.browser = { status: "BLOCKED", reason: !database ? "Owned native database unavailable" : "Installed Chromium unavailable" };
            if (browser === "required") throw new Error("Required native browser proof unavailable");
          } else {
            const envFile = path.join(root, ".local", "smoke", "e2e.env"); mkdirSync(path.dirname(envFile), { recursive: true });
            const browserEnv = { ...database.environment, BETTER_AUTH_URL: "http://127.0.0.1:3100", BETTER_AUTH_SECRET: "e2e-only-secret-at-least-thirty-two-characters" };
            writeFileSync(envFile, Object.entries(browserEnv).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 });
            record.browser = { status: "RUNNING" };
            await run("pnpm", ["test:e2e:run"], { ...browserEnv, E2E_ENV_FILE: envFile });
            record.browser = { status: "PASS", scope: "INSTALLED_CHROMIUM_NATIVE_ROUTES" };
          }
        } else record.browser = { status: "NOT_RUN", reason: "Explicit off selection" };
      } finally {
        for (const check of [record.native, record.browser]) if (check.status === "RUNNING") check.status = signal?.aborted ? "CANCELLED" : "FAIL";
        let databaseClean = true;
        try { if (database) await database.stop(); }
        catch (error) { databaseClean = false; throw error; }
        finally { rmSync(directory, { recursive: true, force: true }); record.cleanup = databaseClean ? "PASS" : "FAIL"; }
      }
    }
    if (JSON.stringify(sourceState(sourceRoot)) !== JSON.stringify(before)) throw new Error("Original source state changed during smoke");
    evidence.status = evidence.runs.some((record) => record.native.status !== "PASS" || record.browser.status !== "PASS") ? "LOCAL_PASS_EXTERNAL_PROOF_INCOMPLETE" : "PASS";
    return evidence;
  } catch (error) { evidence.status = signal?.aborted ? "CANCELLED" : "FAIL"; throw Object.assign(error, { evidence }); }
  finally {
    evidence.sourceUnchanged = JSON.stringify(sourceState(sourceRoot)) === JSON.stringify(before);
    if (!evidence.sourceUnchanged) evidence.status = "FAIL";
    evidence.cleanup = evidence.runs.every((record) => record.cleanup === "PASS") ? "PASS" : "FAIL";
    if (evidencePath) writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }
}
