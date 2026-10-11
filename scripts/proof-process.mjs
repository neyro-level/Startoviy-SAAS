import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv, signal?: AbortSignal, capture?: boolean, input?: string, onSpawn?: (pid: number) => void, timeoutMs?: number}} [options]
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function runProofProcess(command, args, { cwd, env, signal, capture = false, input, onSpawn, timeoutMs = 0 } = {}) {
  if (signal?.aborted) return Promise.reject(new Error("Proof cancelled"));
  const windowsPnpm = process.platform === "win32" && command === "pnpm";
  const executable = windowsPnpm ? (process.env.ComSpec ?? "cmd.exe") : command;
  const argumentsList = windowsPnpm ? ["/d", "/s", "/c", ["pnpm", ...args].join(" ")] : args;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, {
      cwd, env, detached: process.platform !== "win32",
      stdio: [input === undefined ? "ignore" : "pipe", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
    });
    let closed = false; let stopping = false; let forced; let timeout; let outputSize = 0; let oversized = false; let timedOut = false; let callbackFailed = false;
    const stdout = []; const stderr = [];
    const kill = (name) => {
      if (!child.pid || (closed && process.platform === "win32")) return;
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("error", () => child.kill());
        } else process.kill(-child.pid, name);
      } catch (error) { if (error.code !== "ESRCH") child.kill(name); }
    };
    const stop = () => { stopping = true; kill("SIGTERM"); forced ??= setTimeout(() => kill("SIGKILL"), 3000); };
    const groupAlive = () => {
      if (!child.pid || process.platform === "win32") return false;
      try { process.kill(-child.pid, 0); } catch (error) { if (error.code === "ESRCH") return false; throw error; }
      if (process.platform !== "linux") return true;
      // Orphan zombies cannot execute or hold proof resources; PID 1 owns their
      // reaping. Inspect only state/group, never argv or environment values.
      return readdirSync("/proc").filter((pid) => /^[0-9]+$/u.test(pid)).some((pid) => {
        try {
          const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
          const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
          return Number(fields[2]) === child.pid && fields[0] !== "Z" && fields[0] !== "X";
        } catch (error) { if (error.code === "ENOENT" || error.code === "ESRCH") return false; throw error; }
      });
    };
    const cleanup = () => { closed = true; clearTimeout(forced); clearTimeout(timeout); signal?.removeEventListener("abort", stop); };
    const collect = (chunks) => (chunk) => {
      outputSize += chunk.length;
      if (outputSize > 16 * 1024 * 1024) { oversized = true; stop(); return; }
      chunks.push(chunk);
    };
    if (capture) { child.stdout.on("data", collect(stdout)); child.stderr.on("data", collect(stderr)); }
    child.once("error", () => { cleanup(); reject(new Error("Proof command could not start")); });
    child.once("close", async (code) => {
      let descendantsStopped = true;
      if (stopping && process.platform !== "win32") {
        // Leader close does not imply group close. Escalate survivors before
        // clearing the timer or settling, including stdio-ignoring descendants.
        kill("SIGKILL");
        try {
          const deadline = Date.now() + 3000;
          while (groupAlive() && Date.now() < deadline) await new Promise((done) => setTimeout(done, 20));
          descendantsStopped = !groupAlive();
        } catch { descendantsStopped = false; }
      }
      cleanup();
      if (!descendantsStopped) reject(new Error("Proof descendants did not stop"));
      else if (signal?.aborted) reject(new Error("Proof cancelled"));
      else if (callbackFailed) reject(new Error("Proof child observer failed"));
      else if (timedOut) reject(new Error("Proof command timed out"));
      else if (oversized) reject(new Error("Proof output exceeded bounded capture size"));
      else if (code !== 0) reject(new Error(`Proof command failed with exit ${code}`));
      else resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
    });
    signal?.addEventListener("abort", stop, { once: true });
    if (timeoutMs > 0) timeout = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    if (signal?.aborted) stop();
    if (input !== undefined) { child.stdin.on("error", () => {}); child.stdin.end(input); }
    try { onSpawn?.(child.pid); } catch { callbackFailed = true; stop(); }
  });
}
