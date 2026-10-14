import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const FETCH_ALLOWLIST = new Set([
  "src/shared/leads/send-lead.ts",
  "src/platform/pwa/service-worker.js",
]);
const PRISMA_ALLOWLIST = new Set([
  "src/platform/auth/auth.ts",
  "src/platform/database/prisma/client.ts",
  "src/platform/database/transaction.ts",
  "src/modules/identity-access/infrastructure/prisma-identity-admin-repository.ts",
  "src/modules/notifications/infrastructure/prisma-notification-repository.ts",
]);
const SERVER_ONLY_PREFIXES = [
  "src/platform/security/",
  "src/platform/http/safe-outbound",
  "src/platform/storage/",
];

function collect(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "generated") collect(file, files);
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/u.test(entry.name)) files.push(file);
  }
  return files;
}

export function checkRuntimeBoundaries(root) {
  const sourceRoot = path.join(root, "src");
  const violations = [];
  for (const file of collect(sourceRoot)) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    if (SERVER_ONLY_PREFIXES.some((prefix) => relative.startsWith(prefix) || relative.startsWith(prefix.replace(/\/$/u, "")))
      && /\.(?:ts|tsx)$/u.test(relative)
      && !source.startsWith('import "server-only";')
      && !source.startsWith("import 'server-only';")) {
      violations.push(`${relative} must be server-only`);
    }
    if (/\bfetch\s*\(/.test(source) && !FETCH_ALLOWLIST.has(relative)) {
      violations.push(`${relative} uses raw fetch outside the documented allowlist`);
    }
    if (source.includes("getPrismaClient(") && !PRISMA_ALLOWLIST.has(relative)) {
      violations.push(`${relative} uses the global Prisma client outside the documented repository/auth boundary`);
    }
  }
  return [...new Set(violations)].sort();
}
