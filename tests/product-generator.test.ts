import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyProduct, planProduct } from "../scripts/product-generator.mjs";
import { runGeneratorCli } from "../scripts/create-product.mjs";
import { verifyDerivation } from "../scripts/verify-derivation.mjs";
import { validateGithubPolicy } from "../scripts/ci/verify-github-policy.mjs";
import { parse } from "yaml";

const temporary: string[] = [];
const repository = process.cwd();
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const overlays = ["scripts/product-generator.mjs", "scripts/create-product.mjs", "scripts/ci/verify-github-policy.mjs", "scripts/verify-final-conformance.mjs", "scripts/verify-clean-room-derivation.mjs", "scripts/verify-derivation.mjs", "tests/github-policy.test.ts", "tests/derivation-contract.test.ts", "docs/adr/ADR-004-neutral-identity-derivation-contract.md"];

function sourceFixture() {
  const parent = mkdtempSync(path.join(tmpdir(), "ams-generator-contract-")); temporary.push(parent);
  const root = path.join(parent, "source"); mkdirSync(root);
  const archive = execFileSync("git", ["archive", "HEAD"], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", root], { input: archive });
  for (const file of overlays) copyFileSync(path.join(repository, file), path.join(root, file));
  // Build an explicitly synthetic template fixture even when this suite is
  // run in a generated business copy. Never cast the real repository's role.
  const manifestPath = path.join(root, "starter.identity.json");
  const template = JSON.parse(readFileSync(manifestPath, "utf8"));
  template.mode = "starter";
  template.legalReferences.status = "DEMO";
  template.derivation.deliveryProfile = "COMMERCIAL";
  template.derivation.sourceRevision = null;
  writeFileSync(manifestPath, JSON.stringify(template, null, 2));
  const workflowPath = path.join(root, ".github/workflows/ci.yml");
  const workflow = parse(readFileSync(workflowPath, "utf8"));
  workflow.name = "Starter commercial verification";
  workflow.jobs = { "commercial-gate": Object.values(workflow.jobs)[0] };
  writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
  git(root, "init", "--quiet", "--template=", "--initial-branch=main");
  git(root, "remote", "add", "origin", "https://github.com/fixture/template.git");
  git(root, "add", ".");
  git(root, "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "-c", "user.name=Generator Fixture", "-c", "user.email=fixture@localhost", "commit", "--quiet", "-m", "Synthetic template fixture");
  // Ignored local credentials/execution inputs are never in the selected tree.
  writeFileSync(path.join(root, ".env.local"), "fixture-local-only\n");
  mkdirSync(path.join(root, "backlog")); writeFileSync(path.join(root, "backlog", "local-task.md"), "local-only\n");
  return { root, parent, sha: git(root, "rev-parse", "HEAD") };
}

function input(root: string, slug: string, profile = "COMMERCIAL") {
  const manifest = JSON.parse(readFileSync(path.join(root, "starter.identity.json"), "utf8"));
  if (slug.includes(manifest.identity.productSlug)) slug = "quartz-console";
  manifest.mode = "derived";
  Object.assign(manifest.identity, {
    productName: `Generated ${slug}`, shortName: "Independent App",
    productSlug: slug, publicOrigin: `https://${slug}.example.com`, serviceId: slug, workerId: `${slug}-worker`,
    databaseApplicationPrefix: slug, artifactPrefix: slug, repositorySlug: slug,
    iconPath: `/${slug}-icon.svg`, faviconPath: `/${slug}-favicon.svg`, brandMark: "AP", brandWordmark: "PRODUCT",
    legalOperatorName: "Synthetic Operator", legalOperatorEmail: `operator@${slug}.example.com`,
    legalOperatorAddress: "Synthetic Fixture Address", legalOperatorInn: "1234567890",
    legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
  });
  manifest.legalReferences.status = "REQUIRES_CHECK";
  Object.assign(manifest.derivation, { sourceRepository: `https://github.com/fixture/${slug}.git`, sourceRevision: null, deliveryProfile: profile, migrationOwner: slug });
  return manifest;
}

afterEach(() => temporary.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("nonpublishing product generator", () => {
  it("creates two independent identities, keeps source unchanged and refuses overwriting", () => {
    const source = sourceFixture();
    const original = { head: git(source.root, "rev-parse", "HEAD"), tree: git(source.root, "rev-parse", "HEAD^{tree}"), remote: git(source.root, "remote", "get-url", "origin") };
    for (const slug of ["atlas-portal", "meridian-tools"]) {
      const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.parent, slug), input: input(source.root, slug) };
      const plan = planProduct(options);
      expect(existsSync(options.targetRoot)).toBe(false);
      expect(planProduct(options).planHash).toBe(plan.planHash);
      const result = applyProduct(options, plan.planHash);
      expect(result.status).toBe("CREATED");
      expect(git(options.targetRoot, "branch", "--show-current")).toBe("main");
      expect(git(options.targetRoot, "rev-list", "--count", "HEAD")).toBe("1");
      expect(git(options.targetRoot, "remote", "get-url", "origin")).toBe(options.input.derivation.sourceRepository);
      for (const local of [".env.local", "backlog", ".sourcecraft"]) expect(existsSync(path.join(options.targetRoot, local))).toBe(false);
      expect(verifyDerivation({ root: options.targetRoot, manifestPath: path.join(options.targetRoot, "starter.identity.json") })).toEqual([]);
      expect(() => applyProduct(options, plan.planHash)).toThrow("already exists");
    }
    expect(git(source.root, "rev-parse", "HEAD")).toBe(original.head);
    expect(git(source.root, "rev-parse", "HEAD^{tree}")).toBe(original.tree);
    expect(git(source.root, "remote", "get-url", "origin")).toBe(original.remote);
    expect(git(source.root, "status", "--porcelain", "--untracked-files=no")).toBe("");
  });

  it("materializes CRITICAL with the same locked verifier and its own required context", () => {
    const source = sourceFixture();
    const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.parent, "critical"), input: input(source.root, "atlas-portal", "CRITICAL") };
    const plan = planProduct(options); applyProduct(options, plan.planHash);
    const read = (file: string) => readFileSync(path.join(options.targetRoot, file), "utf8");
    expect(() => validateGithubPolicy(read(".github/workflows/ci.yml"), {
      nodeVersion: read(".node-version").trim(), packageManager: JSON.parse(read("package.json")).packageManager,
      vendorWorkflow: read(".github/workflows/ams-verify.yml"), vendorLock: JSON.parse(read(".github/workflows/ams-verify.yml.lock.json")), profile: "CRITICAL",
    })).not.toThrow();
    expect(read("AGENTS.md")).toContain("permissions do not transfer");
    expect(read("AGENTS.md")).not.toContain("Do not ask for merge permission again");
    expect(read("docs/HANDOVER.md")).not.toContain("Restore Starter private");
    expect(read("docs/HANDOVER.md")).not.toContain("COMMERCIAL is mandatory");
    expect(read("docs/04_BACKLOG.md")).not.toContain("разрешённый владельцем поэтапный автономный merge");
    expect(read("docs/05_RELEASE_CHECKLIST.md")).not.toContain("возвращён в private по ADR-015");
  });

  it("runs the CLI dry-run/apply contract and refuses invalid options without creating a target", () => {
    const source = sourceFixture();
    const target = path.join(source.parent, "cli-product");
    const inputFile = path.join(source.parent, "input.json");
    const config = input(source.root, "atlas-portal");
    writeFileSync(inputFile, JSON.stringify(config));
    const args = ["--source", source.root, "--source-sha", source.sha, "--target", target, "--input", inputFile];
    const plan = runGeneratorCli([...args, "--dry-run"]);
    expect(existsSync(target)).toBe(false);
    expect(JSON.stringify(plan)).not.toContain(config.identity.legalOperatorAddress);
    expect(() => runGeneratorCli([...args, "--apply"])).toThrow("matching dry-run");
    expect(() => runGeneratorCli([...args, "--dry-run", "--apply"])).toThrow("exactly one");
    expect(() => runGeneratorCli([...args, "--dry-run", "--unknown"])).toThrow("Unknown");
    expect(() => runGeneratorCli([...args, "--source-sha", "HEAD", "--dry-run"])).toThrow("duplicate");
    expect(() => runGeneratorCli(["--source"])).toThrow("requires a value");
    expect(existsSync(target)).toBe(false);
    const result = runGeneratorCli([...args, "--apply", "--plan-hash", plan.planHash]);
    expect("status" in result && result.status).toBe("CREATED");
    expect(verifyDerivation({ root: target, manifestPath: path.join(target, "starter.identity.json") })).toEqual([]);
  });

  it("rejects dirty source, unsafe input and a mismatched dry-run before writing", () => {
    const source = sourceFixture();
    const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.parent, "new"), input: input(source.root, "atlas-portal") };
    const plan = planProduct(options);
    expect(() => applyProduct(options, "f".repeat(64))).toThrow("matching dry-run");
    options.input.identity.publicOrigin = "https://example.com/private";
    expect(() => planProduct(options)).toThrow("identity.publicOrigin");
    options.input = input(source.root, "atlas-portal");
    writeFileSync(path.join(source.root, "README.md"), "dirty\n");
    expect(() => planProduct(options)).toThrow("clean");
    expect(existsSync(options.targetRoot)).toBe(false);
    expect(plan.published).toBe(false);
  });

  it("maps host/port, custom runtime IDs and escaped SVG labels without changing vendor bytes", () => {
    const source = sourceFixture();
    const config = input(source.root, "atlas-portal");
    Object.assign(config.identity, {
      productName: 'Atlas "Team" & Partners', publicOrigin: "https://quartz-custom.example.net:8443",
      serviceId: "atlas-web", databaseApplicationPrefix: "atlas-db", artifactPrefix: "atlas-artifact",
    });
    const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.parent, "custom"), input: config };
    const plan = planProduct(options); applyProduct(options, plan.planHash);
    const read = (file: string) => readFileSync(path.join(options.targetRoot, file), "utf8");
    expect(read(`ops/nginx/${config.identity.productSlug}.conf`)).toContain("server_name quartz-custom.example.net;");
    expect(read(`ops/nginx/${config.identity.productSlug}.conf`)).toContain("listen 8443 ssl");
    expect(read("scripts/local-dev.mjs")).toContain('service === "atlas-web"');
    expect(read("scripts/build-release.mjs")).toContain("atlas-artifact-${commitSha}.tar.gz");
    expect(read("scripts/sql/prepare-rls-test-identities.sql")).toContain("atlas_db_web");
    expect(read(`public${config.identity.iconPath}`)).toContain("Atlas &quot;Team&quot; &amp; Partners");
    expect(read(".github/workflows/ams-verify.yml")).toBe(readFileSync(path.join(source.root, ".github/workflows/ams-verify.yml"), "utf8"));
  });

  it("cleans its new target on an index failure and leaves the source intact", () => {
    const source = sourceFixture();
    writeFileSync(path.join(source.root, ".gitignore"), "*\n");
    git(source.root, "add", "--force", ".gitignore");
    git(source.root, "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "--quiet", "-m", "Ignore failure fixture");
    const options = { sourceRoot: source.root, sourceSha: git(source.root, "rev-parse", "HEAD"), targetRoot: path.join(source.parent, "failed"), input: input(source.root, "atlas-portal") };
    const plan = planProduct(options);
    expect(() => applyProduct(options, plan.planHash)).toThrow("excludes permanent");
    expect(existsSync(options.targetRoot)).toBe(false);
    expect(git(source.root, "rev-parse", "HEAD")).toBe(options.sourceSha);
  });

  it.each(["disabled", "not_applicable"] as const)("omits active outbox services and timers for %s", (state) => {
    const source = sourceFixture();
    const config = input(source.root, "atlas-portal");
    for (const name of ["outboxPlusQueue", "pwa", "platformAdmin", "outboundHttp", "objectStorage"]) config.derivation.optionalModules[name] = state;
    const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.parent, "off"), input: config };
    const plan = planProduct(options); applyProduct(options, plan.planHash);
    const read = (file: string) => readFileSync(path.join(options.targetRoot, file), "utf8");
    const compose = parse(read("docker-compose.production.yml"));
    expect(Object.keys(compose.services).sort()).toEqual(["migrate", "web"]);
    expect(read("scripts/deploy-production.mjs")).not.toContain("up -d web worker");
    expect(existsSync(path.join(options.targetRoot, `ops/systemd/${config.identity.productSlug}-outbox.timer`))).toBe(false);
    expect(read("docs/03_ARCHITECTURE.md")).toContain("ASYNC = disabled");
    expect(read("docs/03_ARCHITECTURE.md")).toContain("PLATFORM_ADMIN = disabled");
    expect(existsSync(path.join(options.targetRoot, "src/platform/auth/auth.ts"))).toBe(true);
    expect(existsSync(path.join(options.targetRoot, "src/worker/main.ts"))).toBe(true);
    expect(verifyDerivation({ root: options.targetRoot, manifestPath: path.join(options.targetRoot, "starter.identity.json") })).toEqual([]);
  });

  it("rejects destinations in the source, tracked credentials and inherited execution records", () => {
    const source = sourceFixture();
    const options = { sourceRoot: source.root, sourceSha: source.sha, targetRoot: path.join(source.root, "nested"), input: input(source.root, "atlas-portal") };
    expect(() => planProduct(options)).toThrow("outside");
    options.targetRoot = path.join(source.parent, "new");
    for (const file of [".env.local", "backlog/local-task.md"]) {
      git(source.root, "add", "--force", file);
      git(source.root, "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "--quiet", "-m", "Unsafe fixture");
      options.sourceSha = git(source.root, "rev-parse", "HEAD");
      expect(() => planProduct(options)).toThrow(/forbidden|must not be inherited/);
      git(source.root, "rm", "--cached", "--force", file);
      git(source.root, "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "--quiet", "-m", "Remove unsafe fixture");
    }
    expect(existsSync(options.targetRoot)).toBe(false);
  });

  it.runIf(process.platform !== "win32")("rejects a tracked symlink before reading its external contents", () => {
    const source = sourceFixture();
    const outside = path.join(source.parent, "private.txt"); writeFileSync(outside, "fixture-private-content\n");
    symlinkSync(outside, path.join(source.root, "linked.txt")); git(source.root, "add", "linked.txt");
    git(source.root, "-c", "core.hooksPath=", "-c", "commit.gpgSign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "--quiet", "-m", "Symlink fixture");
    const options = { sourceRoot: source.root, sourceSha: git(source.root, "rev-parse", "HEAD"), targetRoot: path.join(source.parent, "new"), input: input(source.root, "atlas-portal") };
    expect(() => planProduct(options)).toThrow("symlink/submodule");
    expect(existsSync(options.targetRoot)).toBe(false);
  });
});
