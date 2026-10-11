import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyDocumentationLinks } from "../scripts/docs-links.mjs";

const roots: string[] = [];
function fixture(content: string) {
  const root = mkdtempSync(path.join(tmpdir(), "ams-docs-links-"));
  roots.push(root);
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "README.md"), content);
  writeFileSync(path.join(root, "docs", "Contract.md"), "# Контракт\n\n## Проверка\n\n## Проверка\n");
  return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("offline documentation navigation", () => {
  it("resolves repository files, directories, reference links and Unicode heading fragments", () => {
    const root = fixture('[contract](docs/Contract.md#проверка-1)\n[dir](docs/)\n[ref]: docs/Contract.md\n[web](https://example.invalid)\n```md\n[example](missing.md)\n```');
    expect(verifyDocumentationLinks(root, ["README.md"])).toBe(3);
  });

  it("rejects a deleted navigation target and an absent heading", () => {
    const root = fixture("[deleted](docs/Missing.md)");
    expect(() => verifyDocumentationLinks(root, ["README.md"])).toThrow("Broken documentation link");
    writeFileSync(path.join(root, "README.md"), "[contract](docs/Contract.md#unknown)");
    expect(() => verifyDocumentationLinks(root, ["README.md"])).toThrow("Missing documentation heading");
  });

  it("rejects paths into another checkout", () => {
    const outside = fixture("# outside");
    const root = fixture(`[escape](../${path.basename(outside)}/README.md)`);
    expect(() => verifyDocumentationLinks(root, ["README.md"])).toThrow("leaves repository");
  });

  // Windows symlink creation requires privileges unavailable to ordinary
  // local developers. The portable path-boundary check above always runs.
  it.runIf(process.platform !== "win32")("rejects symlinks into another checkout", () => {
    const outside = fixture("# outside");
    const root = fixture("[escape](linked.md)");
    symlinkSync(path.join(outside, "README.md"), path.join(root, "linked.md"));
    expect(() => verifyDocumentationLinks(root, ["README.md"])).toThrow("leaves repository");
  });
});
