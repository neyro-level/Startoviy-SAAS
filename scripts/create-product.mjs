import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyProduct, planProduct, readGenerationInput } from "./product-generator.mjs";

export function runGeneratorCli(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!["--source", "--source-sha", "--target", "--input", "--plan-hash", "--dry-run", "--apply"].includes(key) || flags.has(key)) throw new Error("Unknown or duplicate generator option");
    if (key === "--dry-run" || key === "--apply") flags.set(key, true);
    else { const value = args[++index]; if (!value || value.startsWith("--")) throw new Error("Generator option requires a value"); flags.set(key, value); }
  }
  if (Boolean(flags.get("--dry-run")) === Boolean(flags.get("--apply"))) throw new Error("Choose exactly one of --dry-run or --apply");
  if (!flags.get("--input") || !flags.get("--target") || !flags.get("--source-sha")) throw new Error("Input, target and exact source-sha are required");
  const options = { sourceRoot: flags.get("--source") ?? process.cwd(), sourceSha: flags.get("--source-sha"), targetRoot: flags.get("--target"), input: readGenerationInput(flags.get("--input")) };
  return flags.get("--apply") ? applyProduct(options, flags.get("--plan-hash")) : planProduct(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(runGeneratorCli(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { process.stderr.write(`Product generation refused: ${error.message}\n`); process.exitCode = 1; }
}
