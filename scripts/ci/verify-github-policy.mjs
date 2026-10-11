import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const sharedVerifier = "neyro-level/AMS_DELIVERY_CORE/.github/workflows/verify.yml@a39227c11a017bf126d3ba416f8dd5da7ff24449";
const runtimeImage = "node@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2";
const exactHead = "${{ github.event.pull_request.head.sha || github.sha }}";

// JSON is a YAML subset. Parse the actual workflow structurally, without a
// substring-only gate that could accept conflicting permissions or extra jobs.
export function validateGithubPolicy(source, { nodeVersion, packageManager }) {
  const workflow = JSON.parse(source);
  const expected = {
    name: "Starter commercial verification",
    on: { pull_request: { branches: ["main"] }, push: { branches: ["main"] } },
    permissions: { contents: "read" },
    concurrency: {
      group: "starter-verify-${{ github.event.pull_request.number || github.ref }}",
      "cancel-in-progress": true,
    },
    jobs: {
      "commercial-gate": {
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
  });
  console.log("GitHub consumer policy: PASS (configuration only; provider run/protection need API evidence)");
}
