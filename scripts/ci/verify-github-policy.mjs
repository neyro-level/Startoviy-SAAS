import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parse } from "yaml";
import { createHash } from "node:crypto";
import { parseProjectIdentityJson } from "../../src/platform/config/identity-contract.ts";

const sharedVerifier = "./.github/workflows/ams-verify.yml";
const reviewedProvenance = {
  schema: 1,
  source_repository: "neyro-level/AMS_DELIVERY_CORE",
  source_sha: "a39227c11a017bf126d3ba416f8dd5da7ff24449",
  source_path: ".github/workflows/verify.yml",
  sha256: "5d621df70df4ea6b205762f98f4035500c1a06dbb777cf68fcfe2f3d035e1ea8",
};
const runtimeImage = "node@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2";
const exactHead = "${{ github.event.pull_request.head.sha || github.sha }}";

// Parse the actual workflow structurally; reject duplicate keys and aliases
// instead of accepting conflicting permissions through substring matching.
export function validateGithubPolicy(source, { nodeVersion, packageManager, vendorWorkflow, vendorLock, profile = "COMMERCIAL" }) {
  if (!["COMMERCIAL", "CRITICAL"].includes(profile)) throw new Error("Unsupported delivery profile");
  if (!isDeepStrictEqual(vendorLock, reviewedProvenance)
      || typeof vendorWorkflow !== "string"
      || createHash("sha256").update(vendorWorkflow).digest("hex") !== reviewedProvenance.sha256) {
    throw new Error("Vendored verifier differs from reviewed Delivery Core provenance");
  }
  const workflow = parse(source, { uniqueKeys: true, maxAliasCount: 0 });
  const expected = {
    name: `Starter ${profile.toLowerCase()} verification`,
    on: { pull_request: { branches: ["main"] }, push: { branches: ["main"] } },
    permissions: { contents: "read" },
    concurrency: {
      group: "starter-verify-${{ github.event.pull_request.number || github.ref }}",
      "cancel-in-progress": true,
    },
    jobs: {
      [`${profile.toLowerCase()}-gate`]: {
        uses: sharedVerifier,
        with: {
          expected_sha: exactHead,
          node_version: nodeVersion,
          pnpm_version: packageManager.replace(/^pnpm@/u, ""),
          container_image: runtimeImage,
          environment_json: '{"NEXT_TELEMETRY_DISABLED":"1","APP_ENV":"test","CI":"1"}',
          command: "bash scripts/ci/verify-github-contract.sh",
        },
      },
    },
  };
  if (!/^24\.\d+\.\d+$/u.test(nodeVersion) || !/^pnpm@\d+\.\d+\.\d+$/u.test(packageManager)
      || !isDeepStrictEqual(workflow, expected)) {
    throw new Error("GitHub verification policy differs from the reviewed exact-head/read-only contract");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  validateGithubPolicy(readFileSync(".github/workflows/ci.yml", "utf8"), {
    nodeVersion: readFileSync(".node-version", "utf8").trim(),
    packageManager: JSON.parse(readFileSync("package.json", "utf8")).packageManager,
    vendorWorkflow: readFileSync(".github/workflows/ams-verify.yml", "utf8"),
    vendorLock: JSON.parse(readFileSync(".github/workflows/ams-verify.yml.lock.json", "utf8")),
    profile: parseProjectIdentityJson(readFileSync("starter.identity.json", "utf8")).derivation.deliveryProfile,
  });
  console.log("GitHub consumer policy: PASS (configuration only; provider run/protection need API evidence)");
}
