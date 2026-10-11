import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runProofProcess } from "../scripts/proof-process.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("owned proof subprocess", () => {
  it("does not start cancelled work", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(runProofProcess(process.execPath, ["-e", "process.exit(0)"], { signal: controller.signal })).rejects.toThrow("cancelled");
  });

  it("distinguishes success and failure without disclosing captured failure output", async () => {
    expect((await runProofProcess(process.execPath, ["-e", "process.stdout.write('ok')"], { capture: true })).stdout).toBe("ok");
    await expect(runProofProcess(process.execPath, ["-e", "process.stderr.write('fixture-private-content');process.exit(17)"], { capture: true })).rejects.toThrow("Proof command failed with exit 17");
  });

  it.runIf(process.platform !== "win32")("cancels the owned child and waits for its exit", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ams-process-proof-")); roots.push(root);
    const controller = new AbortController();
    let pid: number | undefined;
    const result = runProofProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: root, capture: true, signal: controller.signal, onSpawn: (value: number) => { pid = value; } });
    // Register the rejection before abort; cancellation is asynchronous.
    const verdict = expect(result).rejects.toThrow("cancelled");
    controller.abort();
    await verdict;
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid!, 0)).toThrow();
  });

  it("times out bounded work and cleans a failed child observer", async () => {
    await expect(runProofProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { capture: true, timeoutMs: 30 })).rejects.toThrow("timed out");
    await expect(runProofProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { capture: true, onSpawn: () => { throw new Error("fixture"); } })).rejects.toThrow("observer failed");
  });
});
