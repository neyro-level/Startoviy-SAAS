import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDisposableCopy } from "../scripts/verify-clean-room-derivation.mjs";

const verifier = path.resolve("scripts/verify-derivation.mjs");
const repositoryRoot = path.resolve(".");
const temporaryRoots: string[] = [];

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
    .replaceAll("https://ams-start.example", "https://atlas.example.com")
    .replaceAll("ams-microsaas-starter", "atlas-portal")
    .replaceAll("ams-favicon", "atlas-portal-favicon")
    .replaceAll("AMS_START", "ATLAS_PORTAL")
    .replaceAll("ams_start", "atlas_portal")
    .replaceAll("ams-start", "atlas-portal")
    .replaceAll("АМС Старт", "Atlas Portal")
    .replaceAll("TODO:", "Configured:")
    .replaceAll("DELIVERY_PROFILE = EXPERIMENT", "DELIVERY_PROFILE = COMMERCIAL");
}

function createCleanRoomDerivedCopy() {
  const root = mkdtempSync(path.join(tmpdir(), "ams-derivation-clean-room-"));
  temporaryRoots.push(root);
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).split("\0").filter(Boolean);

  for (const relativePath of files) {
    if (!existsSync(path.join(repositoryRoot, relativePath))) continue;
    const destination = path.join(root, replaceStarterIdentity(relativePath));
    mkdirSync(path.dirname(destination), { recursive: true });
    const source = path.join(repositoryRoot, relativePath);
    const contents = readFileSync(source);
    if (contents.includes(0)) {
      copyFileSync(source, destination);
    } else {
      writeFileSync(destination, replaceStarterIdentity(contents.toString("utf8")));
    }
  }

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
