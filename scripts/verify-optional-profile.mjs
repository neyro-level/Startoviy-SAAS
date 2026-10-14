import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { parseProjectIdentityJson } from "../src/platform/config/identity-contract.ts";
import { isModuleEnabled } from "../src/platform/config/optional-modules.ts";

const root = process.cwd();
const identity = parseProjectIdentityJson(readFileSync(path.join(root, "starter.identity.json"), "utf8"));
const modules = identity.derivation.optionalModules;
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
const env = { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), NODE_ENV: "production", APP_ENV: "test", NEXT_TELEMETRY_DISABLED: "1" };
// This optional profile proof has no database or external integration target.
// Full native authentication/RLS proof belongs to the guarded integration suite.
for (const key of Object.keys(env)) if (key.startsWith("DATABASE_") || key.startsWith("S3_") || key.startsWith("AWS_") || key.startsWith("OBJECT_STORAGE_")) delete env[key];
const child = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], {
  cwd: path.join(root, ".next/standalone"), env, stdio: ["ignore", "ignore", "ignore"],
});
let exited = false; let startupError;
child.once("exit", () => { exited = true; });
child.once("error", (error) => { startupError = error; });
const base = `http://127.0.0.1:${port}`;
const check = (condition, message) => { if (!condition) throw new Error(message); };
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    if (startupError) throw startupError;
    if (exited) throw new Error("Disposable standalone server exited before probes");
    try { if ((await fetch(`${base}/api/health/live`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* startup polling */ }
    if (Date.now() >= deadline) throw new Error("Disposable server startup timed out");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const request = (route) => fetch(`${base}${route === "/" ? route : route.replace(/\/$/, "")}`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  const home = await request("/");
  check(home.status === 200, "Public surface failed");
  const html = await home.text();
  check(/<link[^>]+rel="manifest"/.test(html) === isModuleEnabled(modules, "pwa"), "PWA metadata disagrees with selection");
  for (const route of ["/manifest.webmanifest", "/offline/", "/sw.js"]) {
    const response = await request(route);
    check(response.status === (isModuleEnabled(modules, "pwa") ? 200 : 404), `PWA route violates profile: ${route}`);
    if (route === "/sw.js" && response.ok) check((await response.text()).includes("isPrivateRequest(url)"), "Standalone worker source missing/private-unsafe");
  }
  for (const route of ["/admin/", "/admin/projects/", "/admin/organizations/"]) {
    const response = await request(route);
    check(isModuleEnabled(modules, "platformAdmin") ? [307, 308].includes(response.status) : response.status === 404, `Admin route violates profile: ${route}`);
  }
  const workspace = await request("/dashboard/");
  check([307, 308].includes(workspace.status), "Core workspace authentication boundary must remain");
  const ready = await request("/api/health/ready");
  check(ready.status === 503, "Unconfigured core database must not become ready when optional modules are off");
  if (!isModuleEnabled(modules, "outboxPlusQueue")) {
    for (const command of ["outbox-worker", "outbox-drain", "outbox-retention"]) {
      const result = spawnSync(process.execPath, [path.join(root, ".runtime/worker/worker/main.js"), command], { cwd: root, env, encoding: "utf8", timeout: 5000 });
      check(!result.error && result.status === 1 && `${result.stdout}${result.stderr}`.includes("Optional module is disabled: outboxPlusQueue"), `Disabled worker command did not refuse before DB: ${command}`);
    }
    const migration = spawnSync(process.execPath, ["scripts/pgboss-migrate.mjs"], { cwd: root, env, encoding: "utf8", timeout: 5000 });
    check(!migration.error && migration.status === 0 && migration.stdout.includes("pgboss_schema=disabled"), "Disabled queue migration touched an unavailable database");
  }
  process.stdout.write(`${JSON.stringify({ optionalProfile: modules, http: "PASS", workerBoundary: isModuleEnabled(modules, "outboxPlusQueue") ? "NOT_APPLICABLE_DISABLED_PROBE" : "PASS", nativeAuthRls: "NOT_RUN", s3EnvironmentRequired: false, published: false })}\n`);
} finally {
  if (!exited) {
    const stopped = once(child, "exit");
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 3000);
    try { await stopped; } finally { clearTimeout(force); }
  }
}
