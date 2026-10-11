import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDisposableCopy } from "../scripts/verify-clean-room-derivation.mjs";
import { donorMarkers, historicalReference, sourceMarkers, verifyDerivation } from "../scripts/verify-derivation.mjs";

const verifier = path.resolve("scripts/verify-derivation.mjs");
const repositoryRoot = path.resolve(".");
const temporaryRoots: string[] = [];
const check = (root: string) => verifyDerivation({ root, manifestPath: path.join(root, "starter.identity.json") });
const write = (root: string, file: string, content: string | Buffer) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};

function createDerivedFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ams-derivation-"));
  temporaryRoots.push(root);
  writeFileSync(path.join(root, "starter.identity.json"), JSON.stringify({
    schemaVersion: 2,
    mode: "derived",
    identity: {
      productName: "Atlas Portal",
      shortName: "Atlas Portal", description: "Independent application",
      iconPath: "/atlas-portal-icon.svg", faviconPath: "/atlas-portal-favicon.svg",
      brandMark: "AP", brandWordmark: "PORTAL",
      legalOperatorInn: "1234567890", legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
      productSlug: "atlas-portal",
      publicOrigin: "https://atlas.example.com",
      serviceId: "atlas-portal",
      workerId: "atlas-portal-worker",
      databaseApplicationPrefix: "atlas-portal",
      artifactPrefix: "atlas-portal",
      repositorySlug: "atlas-portal",
      legalOperatorName: "Atlas LLC",
      legalOperatorEmail: "operator@atlas.example.com",
      legalOperatorAddress: "1 Example Street"
    },
    legalReferences: { factsDocument: "docs/01_PRD.md", status: "REQUIRES_CHECK" },
    derivation: {
      sourceRepository: "https://github.com/clean-room/atlas-portal.git",
      sourceRevision: "1".repeat(40), gitProvider: "github",
      defaultBranch: "main",
      deliveryProfile: "COMMERCIAL",
      migrationOwner: "atlas-portal",
      optionalModules: {
        outboxPlusQueue: "enabled",
        pwa: "enabled",
        platformAdmin: "disabled", outboundHttp: "disabled", objectStorage: "disabled"
      }
    }
  }, null, 2));
  writeFileSync(path.join(root, "README.md"), "Derived product only\n");
  return root;
}

function runVerifier(root: string) {
  return execFileSync(process.execPath, [verifier, "--root", root], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function replaceStarterIdentity(value: string) {
  return value
    .replaceAll(["https://", "ams", "-start.example"].join(""), "https://atlas.example.com")
    .replaceAll(["ams", "-start.example"].join(""), "atlas.example.com")
    .replaceAll(["ams", "microsaas", "starter"].join("-"), "atlas-portal")
    .replaceAll(["ams", "favicon"].join("-"), "atlas-portal-favicon")
    .replaceAll(["AMS", "START"].join("_"), "ATLAS_PORTAL")
    .replaceAll(["ams", "start"].join("_"), "atlas_portal")
    .replaceAll(["ams", "start"].join("-"), "atlas-portal")
    .replaceAll(["АМС", "Старт"].join(" "), "Atlas Portal")
    .replaceAll(["TO", "DO:"].join(""), "Configured:")
    .replaceAll("DELIVERY_PROFILE = EXPERIMENT", "DELIVERY_PROFILE = COMMERCIAL");
}

function createCleanRoomDerivedCopy() {
  const root = mkdtempSync(path.join(tmpdir(), "ams-derivation-clean-room-"));
  temporaryRoots.push(root);
  const alreadyDerived = JSON.parse(readFileSync(path.join(repositoryRoot, "starter.identity.json"), "utf8")).mode === "derived";
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).split("\0").filter(Boolean);

  for (const relativePath of files) {
    if (!existsSync(path.join(repositoryRoot, relativePath))) continue;
    const destination = path.join(root, alreadyDerived ? relativePath : replaceStarterIdentity(relativePath));
    mkdirSync(path.dirname(destination), { recursive: true });
    const source = path.join(repositoryRoot, relativePath);
    const contents = readFileSync(source);
    if (contents.includes(0)) {
      copyFileSync(source, destination);
    } else {
      writeFileSync(destination, alreadyDerived ? contents : replaceStarterIdentity(contents.toString("utf8")));
    }
  }

  // A business copy rehearses its own validated identity; it must not be
  // recast as a starter or inherit this fixture's migration ownership.
  if (alreadyDerived) return root;

  const manifestPath = path.join(root, "starter.identity.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.mode = "derived";
  manifest.legalReferences.status = "REQUIRES_CHECK";
  Object.assign(manifest.identity, {
    brandMark: "AP", brandWordmark: "PORTAL", legalOperatorName: "Atlas LLC",
    legalOperatorEmail: "operator@atlas.example.com", legalOperatorAddress: "1 Example Street",
    legalOperatorInn: "1234567890", legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
  });
  manifest.derivation = {
    sourceRepository: "https://github.com/clean-room/atlas-portal.git",
      sourceRevision: "1".repeat(40), gitProvider: "github",
    defaultBranch: "main",
    deliveryProfile: "COMMERCIAL",
    migrationOwner: "atlas-portal",
    optionalModules: {
      outboxPlusQueue: "enabled",
      pwa: "enabled",
      platformAdmin: "disabled", outboundHttp: "disabled", objectStorage: "disabled"
    }
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("copy-source derivation verifier", () => {
  it.each([...sourceMarkers, ...donorMarkers].map((marker, index) => [index, marker] as const))("rejects forbidden namespace %i across real source surfaces", (index, marker) => {
    const root = createDerivedFixture();
    const surfaces = ["scripts/sql/roles.sql", ".env.example", "Dockerfile", "ops/nginx/product.conf", "ops/systemd/worker.service", "ops/systemd/worker.timer", "src/platform/http/health.ts", "public/icon.svg", "src/app/theme.css", "src/shared/legal/operator.ts", "docs/DERIVATION.md", "scripts/verify-derivation.mjs"];
    const file = surfaces[index % surfaces.length];
    write(root, file, `fixture=${marker}\n`);
    expect(check(root).some((message) => message.includes(file) && /starter token|donor identity/.test(message))).toBe(true);
  });

  it("scans binary metadata and source path names", () => {
    const root = createDerivedFixture();
    const file = `public/${sourceMarkers[0]}.png`;
    write(root, file, Buffer.concat([Buffer.from([0, 255, 0]), Buffer.from(donorMarkers[0]), Buffer.from([0])]));
    expect(check(root)).toEqual(expect.arrayContaining([expect.stringContaining("starter token in path"), expect.stringContaining("donor identity in public/")]));
  });

  it.each(["docs/DERIVATION.md", "docs/adr/ADR-004-neutral-identity-derivation-contract.md", "scripts/verify-derivation.mjs", "scripts/verify-clean-room-derivation.mjs", "tests/derivation-contract.test.ts", "docs/archive/reference.md"])("has no whole-file exemption for %s", (file) => {
    const root = createDerivedFixture();
    write(root, file, sourceMarkers[0]);
    expect(check(root)).toContain(`unresolved starter token in ${file}`);
  });

  it("allows only the immutable reference line in its explicit historical scope", () => {
    const root = createDerivedFixture();
    const file = "docs/adr/ADR-004-neutral-identity-derivation-contract.md";
    const history = `## Historical upstream reference\n\n${historicalReference}\n`;
    write(root, file, history);
    expect(check(root)).toEqual([]);
    write(root, file, `${history}${sourceMarkers[0]}\n`);
    expect(check(root)).toContain(`unresolved starter token in ${file}`);
    write(root, file, `${history}${historicalReference}\n`);
    expect(check(root)).toContain(`unresolved starter token in ${file}`);
    write(root, file, historicalReference);
    expect(check(root)).toContain(`unresolved starter token in ${file}`);
    write(root, file, history);
    write(root, "docs/archive/reference.md", history);
    expect(check(root)).toContain("unresolved starter token in docs/archive/reference.md");
  });

  it("validates the materialized Nginx origin and HTTPS port", () => {
    const root = createDerivedFixture();
    const file = "ops/nginx/product.conf";
    write(root, file, "server {\n  listen 443 ssl;\n  listen [::]:443 ssl;\n  server_name atlas.example.com;\n}\n");
    expect(check(root)).toEqual([]);
    write(root, file, "server {\n  listen 8443 ssl;\n  server_name another.example.net;\n}\n");
    expect(check(root)).toEqual(expect.arrayContaining([`public origin mismatch in ${file}`, `public HTTPS port mismatch in ${file}`]));
    const manifestPath = path.join(root, "starter.identity.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.identity.publicOrigin = "https://atlas.example.com/unapproved-path";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(check(root)[0]).toContain("identity.publicOrigin");
  });

  it("reports credential patterns without revealing their contents or filenames", () => {
    const root = createDerivedFixture();
    const synthetic = ["gh", "p_", "A".repeat(36)].join("");
    write(root, ".env.example", `FIXTURE=${synthetic}`);
    write(root, `public/${synthetic}.txt`, "fixture");
    const result = check(root).join("\n");
    expect(result).toContain("credential pattern in .env.example");
    expect(result).toContain("<redacted path>");
    expect(result).not.toContain(synthetic);
    expect(verifyDerivation({ root, manifestPath: path.join(root, ".env.local") })).toEqual(["Identity manifest cannot be private or execution material"]);
  });

  it("rejects force-indexed ignored execution/credential paths and missing indexed files", () => {
    const root = createDerivedFixture();
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
    write(root, ".gitignore", "backlog/\n.env.local\n");
    write(root, "backlog/tasks/local.md", "ignored execution");
    write(root, ".env.local", "private fixture, never read");
    write(root, "public/missing.txt", "fixture");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["add", "--force", "backlog/tasks/local.md", ".env.local"], { cwd: root });
    rmSync(path.join(root, "public/missing.txt"));
    expect(check(root)).toEqual(expect.arrayContaining(["inherited execution artifact in backlog/tasks/local.md", "private/local material in .env.local", "missing indexed source in public/missing.txt"]));
  });

  it.runIf(process.platform !== "win32")("refuses symlinked source and manifest before reading external contents", () => {
    const root = createDerivedFixture();
    const outside = mkdtempSync(path.join(tmpdir(), "ams-external-boundary-")); temporaryRoots.push(outside);
    write(outside, "private.txt", sourceMarkers[0]);
    symlinkSync(path.join(outside, "private.txt"), path.join(root, "reference.txt"));
    expect(check(root)).toEqual(["unsupported source mode in reference.txt"]);
    rmSync(path.join(root, "starter.identity.json"));
    symlinkSync(path.join(outside, "private.txt"), path.join(root, "starter.identity.json"));
    expect(check(root)).toEqual(["Identity manifest must be a regular source file"]);
  });

  it.runIf(process.platform !== "win32")("refuses a symlink parent for an indexed file or selected manifest", () => {
    const root = createDerivedFixture();
    const outside = mkdtempSync(path.join(tmpdir(), "ams-parent-boundary-")); temporaryRoots.push(outside);
    write(root, "public/asset.txt", "fixture");
    write(root, "public/identity.json", readFileSync(path.join(root, "starter.identity.json")));
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    write(outside, "asset.txt", sourceMarkers[0]);
    write(outside, "identity.json", "private invalid input, must never be parsed");
    rmSync(path.join(root, "public"), { recursive: true });
    symlinkSync(outside, path.join(root, "public"));
    expect(check(root)).toEqual(["symlink parent in public/asset.txt", "symlink parent in public/identity.json", "unsupported source mode in public"]);
    expect(verifyDerivation({ root, manifestPath: path.join(root, "public/identity.json") })).toEqual(["Identity manifest must be a regular source file"]);
  });

  it("rejects force-tracked ignored execution artifacts before writing a copied tree", () => {
    const source = createDerivedFixture();
    const destination = mkdtempSync(path.join(tmpdir(), "ams-copy-boundary-"));
    temporaryRoots.push(destination);
    writeFileSync(path.join(source, ".gitignore"), "backlog/\n.local/\ntest-results/\n");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: source });
    execFileSync("git", ["add", "."], { cwd: source });
    for (const directory of ["backlog", ".local", "test-results"]) {
      mkdirSync(path.join(source, directory));
      const file = `${directory}/execution.md`;
      writeFileSync(path.join(source, file), "Local execution record\n");
      execFileSync("git", ["add", "--force", file], { cwd: source });
      expect(() => createDisposableCopy(destination, source)).toThrow("must not be inherited");
      expect(readdirSync(destination)).toEqual([]);
      execFileSync("git", ["rm", "--cached", "--force", file], { cwd: source });
    }
  });

  it("accepts a complete derived identity without starter residue", () => {
    expect(runVerifier(createDerivedFixture())).toContain("derivation_identity=valid");
  });

  it("rejects a restored starter identity in a copied text file", () => {
    const root = createDerivedFixture();
    writeFileSync(path.join(root, "README.md"), ["АМС", "Старт"].join(" "));

    expect(() => runVerifier(root)).toThrow(/unresolved starter token/);
  });

  it("rejects an incomplete legal identity manifest", () => {
    const root = createDerivedFixture();
    const manifestPath = path.join(root, "starter.identity.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.identity.legalOperatorEmail = ["TO", "DO:", " operator"].join("");
    writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => runVerifier(root)).toThrow(/identity\.legalOperatorEmail/);
  });

  it("rejects an unresolved legal page even when the manifest is complete", () => {
    const root = createDerivedFixture();
    mkdirSync(path.join(root, "src", "shared", "legal"), { recursive: true });
    writeFileSync(path.join(root, "src", "shared", "legal", "legal-config.ts"),
      `export const operator = ${JSON.stringify(["TO", "DO:", " legal operator"].join(""))};`);
    expect(() => runVerifier(root)).toThrow(/unresolved starter token in src\/shared\/legal\/legal-config\.ts/);
  });

  it("rejects missing legal input instead of inventing an operator", () => {
    const root = createDerivedFixture();
    const manifestPath = path.join(root, "starter.identity.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.identity.legalOperatorName = " ";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(() => runVerifier(root)).toThrow(/identity\.legalOperatorName/);
  });

  it("rejects an undecided optional-module contract", () => {
    const root = createDerivedFixture();
    const manifestPath = path.join(root, "starter.identity.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.derivation.optionalModules.outboxPlusQueue = "UNDECIDED";
    writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => runVerifier(root)).toThrow(/optionalModules\.outboxPlusQueue/);
  });

  it("passes a clean-room copied starter and rejects one restored source token", () => {
    const root = createCleanRoomDerivedCopy();

    expect(runVerifier(root)).toContain("derivation_identity=valid");
    writeFileSync(path.join(root, "README.md"), ["ams", "start"].join("-"));
    expect(() => runVerifier(root)).toThrow(/unresolved starter token/);
  });
});
