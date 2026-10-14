import "server-only";
import { inspect } from "node:util";
import { sensitiveValues } from "./sensitive-values.ts";

declare const secretValueBrand: unique symbol;
const secretRefBrand: unique symbol = Symbol("server-secret-reference");
export type SecretValue = string & { readonly [secretValueBrand]: true };
export interface SecretRef {
  readonly [secretRefBrand]: true;
  readonly kind: "environment";
  readonly name: string;
  toJSON(): "[SECRET_REF]";
  toString(): "[SECRET_REF]";
}
export interface SecretRefStatusDto {
  configured: boolean;
  displayValue: "[REDACTED]";
}
type EnvironmentSource = Readonly<Record<string, string | undefined>>;
const owned = new WeakSet<object>();
const mask = () => "[SECRET_REF]" as const;

function requireOwned(reference: SecretRef): void {
  if (!reference || !owned.has(reference)) throw new Error("SECRET_REFERENCE_INVALID");
}

export function defineSecretRef(name: string): SecretRef {
  if (!/^[A-Z][A-Z0-9_]{0,127}$/u.test(name)) throw new Error("SECRET_REFERENCE_INVALID");
  // No value is captured here, including when the environment rotates later.
  const reference = Object.freeze({ [secretRefBrand]: true as const, kind: "environment" as const, name,
    toJSON: mask, toString: mask, [Symbol.toPrimitive]: mask, [inspect.custom]: mask,
  });
  owned.add(reference);
  return reference;
}

export function resolveSecretRef(reference: SecretRef, environment: EnvironmentSource = process.env): SecretValue {
  requireOwned(reference);
  const value = environment[reference.name];
  if (!value) throw new Error("SECRET_UNAVAILABLE");
  sensitiveValues.remember(value);
  // Only trusted server adapters resolve at the point of I/O. This raw branded
  // string is not a DTO/log/event; branding does not make serialization safe.
  return value as SecretValue;
}

export function createSecretRefStatus(reference: SecretRef, environment: EnvironmentSource = process.env): SecretRefStatusDto {
  requireOwned(reference);
  return { configured: Boolean(environment[reference.name]), displayValue: "[REDACTED]" };
}
