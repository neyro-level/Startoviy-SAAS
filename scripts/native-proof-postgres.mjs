import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { runProofProcess } from "./proof-process.mjs";

// This creates a separate cluster, never borrows a running service or database.
export async function startNativeProofPostgres({ env, signal, slug }) {
  const bin = "/usr/lib/postgresql/18/bin";
  if (!["initdb", "pg_ctl", "postgres", "psql"].every((name) => existsSync(path.join(bin, name)))) throw new Error("Owned PostgreSQL18 tools unavailable");
  const rootUser = process.getuid?.() === 0;
  if (rootUser && !(env.GITHUB_ACTIONS === "true" && env.RUNNER_ENVIRONMENT === "github-hosted" && existsSync("/.dockerenv"))) throw new Error("Root native proof requires the hosted CI container");
  const directory = mkdtempSync(path.join(tmpdir(), "ams-native-proof-"));
  const data = path.join(directory, "data");
  const run = (name, args, options = {}) => runProofProcess(rootUser ? "runuser" : path.join(bin, name),
    rootUser ? ["-u", "postgres", "--", path.join(bin, name), ...args] : args,
    { env, signal, capture: true, timeoutMs: 30_000, ...options });
  const stop = async () => {
    try {
      if (existsSync(path.join(data, "postmaster.pid"))) await run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { signal: undefined });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  };
  try {
    if (rootUser) await runProofProcess("chown", ["postgres:postgres", directory], { env, signal, capture: true, timeoutMs: 10_000 });
    const version = (await run("postgres", ["--version"])).stdout.trim();
    if (!/PostgreSQL\) 18\./.test(version)) throw new Error("Native proof requires PostgreSQL18");
    await run("initdb", ["-D", data, "--username=postgres", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
    const port = await new Promise((resolve, reject) => {
      const server = createServer(); server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { const selected = server.address().port; server.close((error) => error ? reject(error) : resolve(selected)); });
    });
    // The short port reservation race fails startup rather than reusing a server.
    await run("pg_ctl", ["-D", data, "-l", path.join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
    const stem = slug.replaceAll("-", "_");
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(stem)) throw new Error("Unsafe owned test namespace");
    const user = `${stem}_test`; const database = `${stem}_test`;
    await run("psql", ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: `CREATE ROLE "${user}" LOGIN CREATEDB;\nCREATE DATABASE "${database}" OWNER "${user}";\n`,
    });
    return { stop, version, backend: "OWNED_NATIVE_CLUSTER", environment: { APP_ENV: "test", LOCAL_POSTGRES_USER: `${stem}_dev`, TEST_DATABASE_HOST: "127.0.0.1", TEST_DATABASE_PORT: String(port), TEST_DATABASE_USER: user, TEST_DATABASE_NAME: database, TEST_DATABASE_PASSWORD: "disposable-proof-only", TEST_DATABASE_SSLMODE: "disable" } };
  } catch (error) { await stop(); throw error; }
}
