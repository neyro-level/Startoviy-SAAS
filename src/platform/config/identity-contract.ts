import { z } from "zod";

const safeName = z.string().trim().min(1).max(100).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
const slug = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(40);
// Generator materializes SVG bytes and metadata declares image/svg+xml.
const asset = z.string().regex(/^\/[a-z0-9][a-z0-9/-]*\.svg$/).refine((value) => !value.includes("//"));
const moduleState = z.enum(["enabled", "disabled", "not_applicable"]);
const legalPlaceholder = new RegExp(["TO", "DO:", "|UNDECIDED"].join(""), "i");
const dnsHostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/iu;
const sourcePaths = z.array(z.string().regex(/^[a-zA-Z0-9._/-]+$/).refine((value) =>
  !value.startsWith("/") && !value.split("/").includes("..")
  && !(value.startsWith(".env") && value !== ".env.example")));
const identitySchema = z.object({
  productName: safeName,
  productSlug: slug,
  shortName: safeName,
  description: z.string().trim().min(1).max(300),
  publicOrigin: z.string().url(),
  iconPath: asset,
  faviconPath: asset,
  brandMark: safeName,
  brandWordmark: safeName,
  serviceId: slug,
  workerId: slug,
  databaseApplicationPrefix: slug,
  artifactPrefix: slug,
  repositorySlug: slug,
  legalOperatorName: z.string().trim().min(1).max(200),
  legalOperatorEmail: z.string().trim().min(1).max(200),
  legalOperatorAddress: z.string().trim().min(1).max(300),
  legalOperatorInn: z.string().trim().min(1).max(40),
  legalOperatorOgrn: z.string().trim().min(1).max(40),
  legalOperatorPhone: z.string().trim().min(1).max(80),
}).strict();

export const projectIdentityV2Schema = z.object({
  schemaVersion: z.literal(2),
  mode: z.enum(["starter", "derived"]),
  identity: identitySchema,
  legalReferences: z.object({ factsDocument: z.literal("docs/01_PRD.md"), status: z.enum(["DEMO", "REQUIRES_CHECK"]) }).strict(),
  derivation: z.object({
    sourceRepository: z.string().url().refine((value) => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(value)),
    sourceRevision: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
    gitProvider: z.literal("github"),
    defaultBranch: z.literal("main"),
    deliveryProfile: z.enum(["COMMERCIAL", "CRITICAL"]),
    migrationOwner: slug,
    optionalModules: z.object({
      outboxPlusQueue: moduleState,
      pwa: moduleState,
      platformAdmin: moduleState,
      outboundHttp: moduleState,
      objectStorage: moduleState,
    }).strict(),
  }).strict(),
  surfaceInventory: z.object({
    product: sourcePaths, publicOrigin: sourcePaths, runtime: sourcePaths,
    databaseAndQueue: sourcePaths, artifactAndOperations: sourcePaths, legalAndAssets: sourcePaths,
  }).strict().optional(),
}).strict().superRefine((value, context) => {
  const issue = (path: (string | number)[]) => context.addIssue({ code: "custom", path, message: "Invalid identity field" });
  let origin: URL;
  try { origin = new URL(value.identity.publicOrigin); }
  catch { issue(["identity", "publicOrigin"]); return; }
  if (origin.protocol !== "https:" || origin.origin !== value.identity.publicOrigin || origin.username || origin.password) issue(["identity", "publicOrigin"]);
  if (origin.hostname.length > 253 || !(dnsHostname.test(origin.hostname) || /^\[[0-9a-f:]+\]$/iu.test(origin.hostname))) issue(["identity", "publicOrigin"]);
  if (value.derivation.migrationOwner !== value.identity.productSlug) issue(["derivation", "migrationOwner"]);
  if (value.mode === "derived") {
    if (!value.derivation.sourceRevision) issue(["derivation", "sourceRevision"]);
    const documentationDomain = ["example.com", "example.net", "example.org"].some((domain) => origin.hostname === domain || origin.hostname.endsWith(`.${domain}`));
    if (documentationDomain || origin.hostname === "localhost" || origin.hostname.endsWith(".example") || origin.hostname === "127.0.0.1" || origin.hostname === "[::1]") issue(["identity", "publicOrigin"]);
    for (const field of ["legalOperatorName", "legalOperatorEmail", "legalOperatorAddress", "legalOperatorInn", "legalOperatorOgrn", "legalOperatorPhone"] as const) {
      if (legalPlaceholder.test(value.identity[field])) issue(["identity", field]);
    }
    if (!z.email().safeParse(value.identity.legalOperatorEmail).success) issue(["identity", "legalOperatorEmail"]);
    if (value.legalReferences.status !== "REQUIRES_CHECK") issue(["legalReferences", "status"]);
  } else if (value.derivation.deliveryProfile !== "COMMERCIAL") issue(["derivation", "deliveryProfile"]);
});

export type ProjectIdentityV2 = z.infer<typeof projectIdentityV2Schema>;
export type PublicProjectIdentity = Pick<ProjectIdentityV2["identity"],
  "productName" | "productSlug" | "shortName" | "description" | "publicOrigin" | "iconPath" | "faviconPath" | "brandMark" | "brandWordmark">;

export function parseProjectIdentity(input: unknown): ProjectIdentityV2 {
  const parsed = projectIdentityV2Schema.safeParse(input);
  if (!parsed.success) {
    // Never include supplied values or the full Zod error in logs/errors.
    const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "manifest"))];
    throw new Error(`Invalid project identity: ${paths.join(", ")}`);
  }
  return parsed.data;
}

export function parseProjectIdentityJson(text: string): ProjectIdentityV2 {
  let input: unknown;
  try { input = JSON.parse(text); }
  catch { throw new Error("Invalid project identity: JSON format"); }
  return parseProjectIdentity(input);
}

export function toPublicProjectIdentity(config: ProjectIdentityV2): PublicProjectIdentity {
  const { productName, productSlug, shortName, description, publicOrigin, iconPath, faviconPath, brandMark, brandWordmark } = config.identity;
  return { productName, productSlug, shortName, description, publicOrigin, iconPath, faviconPath, brandMark, brandWordmark };
}
