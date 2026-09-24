import { readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const schema = await readFile(path.join(rootDir, "prisma", "schema.prisma"), "utf8");
const inventory = await readFile(path.join(rootDir, "src", "platform", "database", "tenant-owned-models.ts"), "utf8");
const migration = await readFile(path.join(rootDir, "prisma", "migrations", "20260924140000_tenant_rls_runtime_identities", "migration.sql"), "utf8");

const tenantModels = [...schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)]
  .filter(([, , body]) => /\borganizationId\s+String\??/.test(body))
  .map(([, name]) => name);
const requiredModels = [...new Set(["Organization", "Member", "NotificationRead", ...tenantModels])];
const missing = requiredModels.filter((model) => !inventory.includes(`"${model}"`)
  || !migration.includes(`ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY`)
  || !migration.includes(`CREATE POLICY "${model}_rls"`));

if (missing.length > 0) {
  throw new Error(`RLS coverage is incomplete: ${missing.join(", ")}`);
}

process.stdout.write(`rls_coverage=valid models=${requiredModels.length}\n`);
