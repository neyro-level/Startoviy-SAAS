import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { runProofProcess } from "./proof-process.mjs";
import { startNativeProofPostgres } from "./native-proof-postgres.mjs";

export const proofPostgresImage = "postgres@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c";

export async function startDisposablePostgres({ directory, env, signal, slug }) {
  if (existsSync("/usr/lib/postgresql/18/bin/initdb")) return startNativeProofPostgres({ env, signal, slug });
  const run = async (args, options = {}) => {
    try { return await runProofProcess("docker", args, { env, signal, capture: true, timeoutMs: 30_000, ...options }); }
    catch { throw new Error(`Owned Docker database operation failed: ${args[0]}`); }
  };
  const context = (await run(["context", "show"])).stdout.trim();
  const configured = (await run(["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"])).stdout.trim();
  const endpoint = env.DOCKER_HOST || configured;
  const local = endpoint.startsWith("unix://") || endpoint.startsWith("npipe://") || /^tcp:\/\/127\.0\.0\.1(?::[0-9]+)?$/.test(endpoint);
  if (!local) throw new Error("Disposable database requires a local Docker endpoint");
  await run(["image", "inspect", proofPostgresImage]);
  const owner = randomBytes(16).toString("hex");
  const name = `ams-derive-pg-${owner}`;
  const cidFile = path.join(directory, "postgres.cid");
  const stop = async () => {
    if (!existsSync(cidFile)) return;
    const cid = readFileSync(cidFile, "utf8").trim();
    if (!/^[0-9a-f]{64}$/.test(cid)) throw new Error("Invalid owned database identity");
    const label = await run(["inspect", cid, "--format", '{{index .Config.Labels "ams.derivation-proof.owner"}}'], { signal: undefined });
    if (label.stdout.trim() !== owner) throw new Error("Refusing cleanup of an unowned database");
    await run(["rm", "--force", "--volumes", cid], { signal: undefined });
  };
  try {
    await run(["run", "--detach", "--pull=never", "--cidfile", cidFile, "--name", name,
      "--label", `ams.derivation-proof.owner=${owner}`, "--publish", "127.0.0.1::5432",
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", proofPostgresImage]);
    const publication = (await run(["port", name, "5432/tcp"])).stdout.trim();
    const match = /^127\.0\.0\.1:([0-9]+)$/.exec(publication);
    if (!match) throw new Error("Owned database must bind literal loopback only");
    const deadline = Date.now() + 60_000;
    while (true) {
      if (signal?.aborted) throw new Error("Proof cancelled");
      // Official image briefly starts a socket-only initialization server.
      // Wait for the final TCP server before using its administrator.
      try { await run(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]); break; } catch {
        if (Date.now() >= deadline) throw new Error("Owned PostgreSQL startup timed out");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    const version = (await run(["exec", name, "postgres", "--version"])).stdout.trim();
    if (!/PostgreSQL\) 18\./.test(version)) throw new Error("Native proof requires PostgreSQL18");
    const stem = slug.replaceAll("-", "_");
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(stem)) throw new Error("Unsafe owned test namespace");
    const user = `${stem}_test`; const database = `${stem}_test`;
    await run(["exec", "--interactive", name, "psql", "-X", "-h", "127.0.0.1", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], {
      input: `CREATE ROLE "${user}" LOGIN CREATEDB;\nCREATE DATABASE "${database}" OWNER "${user}";\n`,
    });
    return {
      stop, version, image: proofPostgresImage,
      environment: { APP_ENV: "test", LOCAL_POSTGRES_USER: `${stem}_dev`, TEST_DATABASE_HOST: "127.0.0.1", TEST_DATABASE_PORT: match[1], TEST_DATABASE_USER: user, TEST_DATABASE_NAME: database, TEST_DATABASE_PASSWORD: "disposable-proof-only", TEST_DATABASE_SSLMODE: "disable" },
    };
  } catch (error) { await stop(); throw error; }
}
