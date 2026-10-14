import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runProofProcess } from "../scripts/proof-process.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("owned proof subprocess", () => {
  it.runIf(process.platform === "linux").each(["cancel", "timeout"])("stops a TERM-ignoring descendant after its wrapper exits (%s)", async (mode) => {
    const root = mkdtempSync(path.join(tmpdir(), "ams-process-descendant-")); roots.push(root);
    const ready = path.join(root, "child.pid");
    const script = "process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)";
    const wrapper = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(script)},${JSON.stringify(ready)}],{stdio:'ignore'});setInterval(()=>{},1000)`;
    const controller = new AbortController();
    const result = runProofProcess(process.execPath, ["-e", wrapper], { cwd: root, capture: true, signal: controller.signal, timeoutMs: mode === "timeout" ? 1000 : 0 });
    const verdict = expect(result).rejects.toThrow(mode === "cancel" ? "cancelled" : "timed out");
    const deadline = Date.now() + 900;
    while (!existsSync(ready) && Date.now() < deadline) await new Promise((done) => setTimeout(done, 10));
    expect(existsSync(ready)).toBe(true);
    const pid = Number(readFileSync(ready, "utf8"));
    try {
      if (mode === "cancel") controller.abort();
      await verdict;
      let alive = false;
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        const state = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0];
        alive = state !== "Z" && state !== "X";
      } catch { /* ESRCH/ENOENT is a stopped descendant. */ }
      expect(alive).toBe(false);
    } finally { try { process.kill(pid, "SIGKILL"); } catch { /* Already stopped. */ } }
  });

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
