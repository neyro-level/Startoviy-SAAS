import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProjectIdentityJson, toPublicProjectIdentity } from "./identity-contract.ts";

// This module depends on node:fs and belongs only to server/worker/scripts.
// Client surfaces receive the explicit DTO through the server root provider.
export const projectIdentity = parseProjectIdentityJson(
  readFileSync(path.join(process.cwd(), "starter.identity.json"), "utf8"),
);
export const publicProjectIdentity = toPublicProjectIdentity(projectIdentity);
export const optionalModules = projectIdentity.derivation.optionalModules;
