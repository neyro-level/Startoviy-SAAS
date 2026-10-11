import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseProjectIdentity, parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { assertNoInheritedExecutionArtifacts } from "./execution-artifact-policy.mjs";
import { scanText } from "./ci/scan-secrets.mjs";
import { validateGithubPolicy } from "./ci/verify-github-policy.mjs";
import { parse, stringify } from "yaml";

const shaPattern = /^[0-9a-f]{40}$/;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (root, ...args) => execFileSync("git", ["--no-optional-locks", "-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] });
const textGit = (root, ...args) => git(root, ...args).toString("utf8").trim();
const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const js = (value) => JSON.stringify(value).slice(1, -1).replaceAll("/", "\\/");
const trackedSecret = (file) => file.split("/").some((part) =>
  /^(?:\.git|\.aws|\.ssh|\.codex|\.agents|node_modules|\.next|\.runtime)$/i.test(part)
  || (part.startsWith(".env") && part !== ".env.example")
  || /^(?:credentials|id_rsa|id_ed25519)$|\.(?:pem|key|p12|pfx)$/i.test(part));
const reserved = new Set([".github/workflows/ams-verify.yml", ".github/workflows/ams-verify.yml.lock.json"]);

function readBlobs(root, entries) {
  const output = execFileSync("git", ["-C", root, "cat-file", "--batch"], {
    input: entries.map((entry) => entry.oid).join("\n") + "\n",
    maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
  });
  let offset = 0; const blobs = new Map();
  for (const entry of entries) {
    if (scanText(entry.file).length) throw new Error("Source filename contains a credential pattern");
    const newline = output.indexOf(10, offset);
    const header = output.subarray(offset, newline).toString("ascii").split(" ");
    const size = Number(header[2]);
    if (header[0] !== entry.oid || header[1] !== "blob" || !Number.isSafeInteger(size) || size < 0 || newline < offset || newline + size + 1 >= output.length) throw new Error("Invalid Git blob batch");
    offset = newline + 1;
    blobs.set(entry.file, output.subarray(offset, offset + size));
    offset += size + 1;
  }
  if (offset !== output.length) throw new Error("Unexpected Git blob batch bytes");
  return blobs;
}

function verifyWorkflow(files, profile) {
  const text = (file) => { const bytes = files.get(file); if (!bytes) throw new Error(`Missing workflow input: ${file}`); return bytes.toString("utf8"); };
  validateGithubPolicy(text(".github/workflows/ci.yml"), {
    nodeVersion: text(".node-version").trim(), packageManager: JSON.parse(text("package.json")).packageManager,
    vendorWorkflow: text(".github/workflows/ams-verify.yml"), vendorLock: JSON.parse(text(".github/workflows/ams-verify.yml.lock.json")), profile,
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function ownDelivery(source, file, config) {
  const profile = config.derivation.deliveryProfile;
  if (file === "AGENTS.md") {
    return source.replace(/## Delivery\n[\s\S]*?(?=## Checks)/, `## Delivery\n\nThis is an independent derived product with profile \`${profile}\` and GitHub primary.\nThe template's program-specific merge, visibility and release permissions do not transfer.\nThe product owner must establish its own private/public visibility and merge policy,\nconfigure strict exact-head protected PR checks and verify main after an authorized merge.\nNo direct main push, force push, gate bypass or production action is authorized here.\nProduction requires a separate product-owned contract and explicit permission.\n\n`);
  }
  if (file === "README.md") {
    return source.replace(/^Роль репозитория[^\n]+/m, `Independent derived product, profile \`${profile}\`, GitHub primary. Configure own protected main and merge permissions before delivery; no template approval or production authority transfers. See [architecture](docs/03_ARCHITECTURE.md).`);
  }
  if (file === "docs/README.md") return source.replace(/\*\*Статус:\*\*[^\n]+/, `**Статус:** Active. Independent derived product, profile \`${profile}\`; inherited foundation contracts require own product scope/facts/proof.`);
  if (file === "docs/03_ARCHITECTURE.md") {
    return source.replace("REPOSITORY_ROLE = template", "REPOSITORY_ROLE = development")
      .replace(/^DELIVERY_PROFILE = (?:COMMERCIAL|CRITICAL)$/m, `DELIVERY_PROFILE = ${profile}`)
      .replace(/^REPOSITORY_VISIBILITY = private$/m, "REPOSITORY_VISIBILITY = REQUIRES_CHECK")
      .replace(/^ASYNC = outbox-plus-queue$/m, `ASYNC = ${config.derivation.optionalModules.outboxPlusQueue === "enabled" ? "outbox-plus-queue" : "disabled"}`)
      .replace(/^PLATFORM_ADMIN = enabled$/m, `PLATFORM_ADMIN = ${config.derivation.optionalModules.platformAdmin === "enabled" ? "enabled" : "disabled"}`)
      .replace(/This repository is a copy-source starter\.[\s\S]*?(?=## Source of truth)/, "This is an independent derived product. Its own identity, database, legal facts, visibility, protected-main settings and delivery permissions require product-owner verification. Template hardening merge/visibility permissions do not transfer. No production action is authorized by generation.\n\n")
      .replace(/The owner approved `template` and `COMMERCIAL` as independent classifications\./, `The product selected development role and \`${profile}\` profile; actual provider protection requires own configuration and API proof.`)
      .replace(/For the approved program, the executor merges each[\s\S]*?derived products establish their own merge permission\./, "Each PR requires review, current exact-head checks and the product owner's merge policy. Verify main afterward. Direct-main/force push and gate bypass are prohibited. Production remains separately authorized.")
      .replaceAll("commercial-gate / verify", `${profile.toLowerCase()}-gate / verify`);
  }
  if (file === "docs/adr/ADR-015-commercial-template-github-delivery.md") {
    return `# ADR-015: Independent derived-product delivery\n\n**Status:** inherited safety boundary; product-owner delivery setup required.\n\nThe product selected \`${profile}\` and GitHub primary in its validated manifest.\nTemplate program-specific merge/public-quota permissions do not transfer.\nConfigure own visibility, strict protected main and current exact-head app checks;\nreview and owner authorization are required before merge, production separately.\nKeep readonly verification, byte-exact Delivery Core provenance, auth/TOTP,\nserver permission/resource checks, native tenant/project isolation and guarded\nworker/recovery proof. A local PASS is not provider or release evidence.\nDerived requirements/facts/permissions belong to this repository's canon.\nNo execution archive, template database, secrets or production identity is inherited.\n`;
  }
  if (file === "docs/04_BACKLOG.md") return source.replace(
    /COMMERCIAL contract и разрешённый владельцем поэтапный автономный merge\nутверждённой программы через review и green exact-head protected PR\./,
    `${profile} contract. Политика merge устанавливается владельцем этого продукта;\nразрешение программы шаблона не переносится. Нужны review и green exact-head protected PR.`,
  );
  if (file === "docs/HANDOVER.md") return source
    .replace("- COMMERCIAL is mandatory; actual successful required checks belong to the exact", `- ${profile} is selected; actual successful required checks belong to the exact`)
    .replace(/- Final visibility is private; temporary owner-authorized public access during\n  development and final restoration follow ADR-015\. Shared Core stays private\./,
      "- The product owner must select and verify its own repository visibility.\n  Template quota exceptions and restoration obligations do not transfer.")
    .replace(/5\. Restore Starter private after full-program completion and verify visibility\/\n   protection\. Assign only the status supported by05, never DEPLOYED\./,
      "5. Verify the product owner's selected visibility and protected-main contract.\n   Assign only the status actually supported by05; generation does not prove DEPLOYED.");
  if (file === "docs/05_RELEASE_CHECKLIST.md") return source
    .replace("this starter itself is not a release target.", "generation does not establish product release readiness or authority.")
    .replace(/^- \[ \] После завершения всей программы Starter возвращён в private по ADR-015, visibility\/protection read back; shared Delivery Core остаётся private\.$/m,
      "- [ ] Проверена выбранная владельцем продукта visibility и protection через provider API; временные условия программы шаблона не наследуются.")
    .replace("в этой программе Starter никогда не деплоится", "требуется отдельное разрешение владельца продукта и actual release proof");
  return source;
}

function materializeText(source, file, before, config) {
  const from = before.identity;
  const to = config.identity;
  const name = /\.(?:svg|html|md)$/.test(file) ? xml(to.productName) : js(to.productName);
  const pairs = [
    [from.publicOrigin, to.publicOrigin], [new URL(from.publicOrigin).hostname, new URL(to.publicOrigin).hostname],
    [from.repositorySlug, to.repositorySlug],
    [from.iconPath.slice(1), to.iconPath.slice(1)], [from.faviconPath.slice(1), to.faviconPath.slice(1)],
    [from.productSlug.replaceAll("-", "_").toUpperCase(), to.productSlug.replaceAll("-", "_").toUpperCase()],
    [from.productSlug.replaceAll("-", "_"), to.databaseApplicationPrefix.replaceAll("-", "_")],
    [from.productName, name], [from.productSlug, to.productSlug],
  ].filter(([old, next]) => old !== next).sort((a, b) => b[0].length - a[0].length);
  let result = pairs.reduce((text, [old, next]) => text.replaceAll(old, next), source);
  // Legal placeholder examples are contracts, not generated operator facts.
  // Only the identity manifest supplies actual legal inputs.
  if (file.endsWith(".md")) result = result.replaceAll(["TO", "DO:"].join(""), "placeholder:");
  if (file === ".github/workflows/ci.yml" && config.derivation.deliveryProfile === "CRITICAL") {
    const workflow = parse(result, { uniqueKeys: true, maxAliasCount: 0 });
    workflow.name = "Starter critical verification";
    workflow.jobs = { "critical-gate": workflow.jobs["commercial-gate"] };
    result = stringify(workflow);
  }
  if (file.endsWith(".svg")) {
    result = result.replaceAll(`>${from.brandMark}<`, `>${xml(to.brandMark)}<`)
      .replaceAll(`>${from.brandWordmark}<`, `>${xml(to.brandWordmark)}<`);
  }
  if (file === "scripts/local-dev.mjs" || file === "scripts/deploy-production.mjs") {
    result = result.replaceAll(`service === "${to.productSlug}"`, `service === "${to.serviceId}"`)
      .replaceAll(`payload["service"] == "${to.productSlug}"`, `payload["service"] == "${to.serviceId}"`);
  }
  if (file === "scripts/deploy-production.mjs" && config.derivation.optionalModules.outboxPlusQueue !== "enabled") result = result.replace("up -d web worker", "up -d web");
  if (file === "scripts/release-contract.mjs") result = result.replace(`application: "${to.productSlug}"`, `application: "${to.serviceId}"`);
  if (file === "docker-compose.production.yml") result = result.replace(`name: ${to.productSlug}`, `name: ${to.serviceId}`);
  if (file === "docker-compose.production.yml" && config.derivation.optionalModules.outboxPlusQueue !== "enabled") {
    const compose = parse(result, { uniqueKeys: true });
    delete compose.services.worker;
    delete compose.services.maintenance;
    result = stringify(compose);
  }
  if (file.startsWith("ops/systemd/")) result = result.replace(`COMPOSE_PROJECT_NAME=${to.productSlug}`, `COMPOSE_PROJECT_NAME=${to.serviceId}`);
  if (file.startsWith("ops/nginx/")) {
    const port = new URL(to.publicOrigin).port || "443";
    result = result.replaceAll("listen 443 ssl", `listen ${port} ssl`)
      .replaceAll("listen [::]:443 ssl", `listen [::]:${port} ssl`);
  }
  if (["scripts/build-release.mjs", "scripts/deploy-production.mjs", "scripts/inspect-container-images.mjs", "Dockerfile"].includes(file)) {
    result = result.replaceAll(`${to.productSlug}-\${commitSha}.tar.gz`, `${to.artifactPrefix}-\${commitSha}.tar.gz`)
      .replaceAll(`${to.productSlug}-\${role}:`, `${to.artifactPrefix}-\${role}:`)
      .replaceAll(`${to.productSlug}-e08-`, `${to.artifactPrefix}-e08-`)
      .replaceAll(`id=${to.productSlug}-pnpm`, `id=${to.artifactPrefix}-pnpm`);
  }
  if (file === "src/components/marketing/SiteFooter.tsx") {
    result = result.replace('href="https://ams24.ru"', "href={publicProjectIdentity.publicOrigin}")
      .replace("Разработано в АМС", "{publicProjectIdentity.productName}");
  }
  return ownDelivery(result, file, config);
}

function prepare({ sourceRoot, sourceSha, targetRoot, input }) {
  if (!shaPattern.test(sourceSha ?? "")) throw new Error("sourceSha must be an exact lowercase commit SHA");
  const root = realpathSync(sourceRoot);
  if (realpathSync(textGit(root, "rev-parse", "--show-toplevel")) !== root) throw new Error("sourceRoot must be the exact repository root");
  if (textGit(root, "status", "--porcelain", "--untracked-files=no")) throw new Error("Source tracked worktree must be clean");
  if (textGit(root, "rev-parse", `${sourceSha}^{commit}`) !== sourceSha) throw new Error("Source commit is unavailable");
  const target = path.join(realpathSync(path.dirname(path.resolve(targetRoot))), path.basename(path.resolve(targetRoot)));
  const relative = path.relative(root, target);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("Target must be outside the source repository");
  if (existsSync(target) || (() => { try { lstatSync(target); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } })()) throw new Error("Target already exists; overwrite is forbidden");
  const entries = git(root, "ls-tree", "-rz", "--full-tree", sourceSha).toString("utf8").split("\0").filter(Boolean).map((record) => {
    const split = record.indexOf("\t"); const [mode, type, oid] = record.slice(0, split).split(" ");
    return { mode, type, oid, file: record.slice(split + 1) };
  });
  assertNoInheritedExecutionArtifacts(entries.map((entry) => entry.file));
  for (const entry of entries) {
    if (!/^100(?:644|755)$/.test(entry.mode) || entry.type !== "blob") throw new Error(`Unsupported symlink/submodule mode: ${entry.file}`);
    if (trackedSecret(entry.file)) throw new Error(`Tracked private/local material is forbidden: ${entry.file}`);
    if (entry.file.startsWith("/") || entry.file.split("/").includes("..") || /[\\\u0000-\u001f<>:"|?*]/u.test(entry.file)) throw new Error("Unsafe source path");
  }
  for (const file of ["starter.identity.json", "package.json", "pnpm-lock.yaml", ".node-version", "AGENTS.md", "docs/README.md", "docs/01_PRD.md", "docs/02_PRODUCT_STRUCTURE.md", "docs/03_ARCHITECTURE.md", "docs/05_RELEASE_CHECKLIST.md", "docs/06_DESIGN_SYSTEM.md", "src/app/layout.tsx", ".github/workflows/ci.yml", ...reserved]) {
    if (!entries.some((entry) => entry.file === file)) throw new Error(`Source template contract is missing: ${file}`);
  }
  const sourceManifest = parseProjectIdentityJson(textGit(root, "show", `${sourceSha}:starter.identity.json`));
  if (sourceManifest.mode !== "starter") throw new Error("Generate from the template, not a business repository");
  if (input?.derivation?.sourceRevision && input.derivation.sourceRevision !== sourceSha) throw new Error("Input sourceRevision differs from sourceSha");
  const config = parseProjectIdentity({ ...input, mode: "derived", derivation: { ...input?.derivation, sourceRevision: sourceSha } });
  if (["pwa", "platformAdmin", "outboxPlusQueue"].some((name) => config.derivation.optionalModules[name] !== "enabled")) {
    for (const file of ["src/platform/config/optional-modules.ts", "src/app/sw.js/route.ts", "src/app/manifest.webmanifest/route.ts", "src/platform/pwa/service-worker.js"]) {
      if (!entries.some((entry) => entry.file === file)) throw new Error("Selected source predates the optional runtime contract");
    }
    if (entries.some((entry) => entry.file === "public/sw.js")) throw new Error("Selected source exposes an unguarded static worker");
  }
  if (config.identity.productSlug === sourceManifest.identity.productSlug || config.derivation.sourceRepository === sourceManifest.derivation.sourceRepository) throw new Error("Product must have its own slug and repository origin");
  const oldIdentity = sourceManifest.identity;
  const oldMarkers = [oldIdentity.productName, oldIdentity.productSlug, oldIdentity.productSlug.replaceAll("-", "_"), oldIdentity.productSlug.replaceAll("-", "_").toUpperCase(), oldIdentity.repositorySlug, new URL(oldIdentity.publicOrigin).hostname];
  if (oldMarkers.some((marker) => JSON.stringify(config).includes(marker))) throw new Error("Input still contains a source identity marker");
  const blobs = readBlobs(root, entries);
  verifyWorkflow(blobs, sourceManifest.derivation.deliveryProfile);
  const omitted = new Set(entries.filter((entry) => entry.file.startsWith(".sourcecraft/")
    || (config.derivation.optionalModules.outboxPlusQueue !== "enabled" && [
      `ops/systemd/${sourceManifest.identity.productSlug}-outbox.service`,
      `ops/systemd/${sourceManifest.identity.productSlug}-outbox.timer`,
    ].includes(entry.file))).map((entry) => entry.file));
  const files = []; const names = new Set();
  for (const entry of entries) {
    if (omitted.has(entry.file)) continue;
    let destination = entry.file.replaceAll(sourceManifest.identity.productSlug, config.identity.productSlug)
      .replaceAll(path.posix.basename(sourceManifest.identity.iconPath), path.posix.basename(config.identity.iconPath))
      .replaceAll(path.posix.basename(sourceManifest.identity.faviconPath), path.posix.basename(config.identity.faviconPath));
    if (entry.file === `public${sourceManifest.identity.iconPath}`) destination = `public${config.identity.iconPath}`;
    if (entry.file === `public${sourceManifest.identity.faviconPath}`) destination = `public${config.identity.faviconPath}`;
    if (entry.file === `ops/systemd/${sourceManifest.identity.productSlug}-web.service`) destination = `ops/systemd/${config.identity.serviceId}-web.service`;
    const collision = destination.toLowerCase();
    if (names.has(collision)) throw new Error(`Generated path collision: ${destination}`);
    names.add(collision);
    const original = blobs.get(entry.file);
    if (scanText(original.toString("utf8")).length) throw new Error(`Source credential pattern detected: ${entry.file}`);
    let bytes = original;
    if (!reserved.has(entry.file) && !original.includes(0)) bytes = Buffer.from(materializeText(original.toString("utf8"), entry.file, sourceManifest, config));
    if (entry.file === "starter.identity.json") bytes = Buffer.from(`${JSON.stringify(config, null, 2)}\n`);
    if (entry.file === "package.json") {
      const pkg = JSON.parse(bytes.toString("utf8")); pkg.name = config.identity.repositorySlug;
      bytes = Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`);
    }
    if (scanText(bytes.toString("utf8")).length) throw new Error(`Generated credential pattern detected: ${destination}`);
    files.push({ from: entry.file, to: destination, mode: entry.mode, sha256: hash(bytes), bytes });
  }
  verifyWorkflow(new Map(files.map((file) => [file.to, file.bytes])), config.derivation.deliveryProfile);
  const publicPlan = {
    schemaVersion: 1, sourceSha, sourceTree: textGit(root, "rev-parse", `${sourceSha}^{tree}`),
    productSlug: config.identity.productSlug, profile: config.derivation.deliveryProfile,
    target, published: false, production: false,
    files: files.map(({ from, to, mode, sha256 }) => ({ from, to, mode, sha256 })),
    omitted: [...omitted],
    preserved: [...reserved].filter((file) => entries.some((entry) => entry.file === file)),
  };
  const planHash = hash(JSON.stringify(stable({ ...publicPlan, config })));
  return { publicPlan: { ...publicPlan, planHash }, files, config };
}

export function planProduct(options) { return prepare(options).publicPlan; }

export function applyProduct(options, expectedPlanHash) {
  const prepared = prepare(options);
  if (!/^[0-9a-f]{64}$/.test(expectedPlanHash ?? "") || prepared.publicPlan.planHash !== expectedPlanHash) throw new Error("Apply requires the matching dry-run planHash");
  const root = prepared.publicPlan.target;
  mkdirSync(root); let complete = false;
  try {
    for (const file of prepared.files) {
      const destination = path.join(root, file.to);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, file.bytes, { flag: "wx", mode: file.mode === "100755" ? 0o755 : 0o644 });
    }
    git(root, "init", "--quiet", "--template=", "--initial-branch=main");
    git(root, "remote", "add", "origin", prepared.config.derivation.sourceRepository);
    const hookDir = path.join(root, ".git", "generator-no-hooks"); mkdirSync(hookDir);
    git(root, "-c", `core.hooksPath=${hookDir}`, "add", ".");
    const indexed = new Set(git(root, "ls-files", "-z").toString("utf8").split("\0").filter(Boolean));
    if (prepared.files.some((file) => !indexed.has(file.to))) throw new Error("Copied Git ignore excludes permanent product source");
    git(root, "-c", `core.hooksPath=${hookDir}`, "-c", "commit.gpgSign=false", "-c", "user.name=Product Generator", "-c", "user.email=generator@localhost", "commit", "--quiet", "-m", "Initialize independent product");
    complete = true;
    return { ...prepared.publicPlan, status: "CREATED", derivedSha: textGit(root, "rev-parse", "HEAD") };
  } finally { if (!complete) rmSync(root, { recursive: true, force: true }); }
}

export function readGenerationInput(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error("Generation input must be readable JSON; values are not included in errors"); }
}
