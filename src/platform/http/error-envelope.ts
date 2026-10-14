import { NextResponse } from "next/server";
import { z } from "zod";
import { correlationIdSchema } from "./correlation.ts";

export const publicErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    message: z.string().min(1).max(500),
    fieldErrors: z.record(z.string(), z.array(z.string())).default({}),
    correlationId: correlationIdSchema,
  }),
});

export type PublicErrorEnvelope = z.infer<typeof publicErrorEnvelopeSchema>;

export interface PublicErrorInput {
  code: string;
  message: string;
  correlationId: string;
  fieldErrors?: Record<string, string[]>;
}

const unsafePublicText = /postgres:\/\/|mysql:\/\/|mongodb:\/\/|\bselect\b[\s\S]+\bfrom\b|bearer\s+\S+|password\s*[=:]|\/home\/|at\s+\S+\s+\(/i;

export function isUnsafePublicText(value: string): boolean {
  return unsafePublicText.test(value);
}

export function sanitizePublicError(input: PublicErrorInput): PublicErrorInput {
  const fallback = "Запрос не выполнен. Передайте код обращения в поддержку.";
  return {
    code: /^[A-Z][A-Z0-9_]{2,63}$/.test(input.code) ? input.code : "REQUEST_FAILED",
    message: isUnsafePublicText(input.message) ? fallback : input.message,
    correlationId: input.correlationId,
    fieldErrors: Object.fromEntries(
      Object.entries(input.fieldErrors ?? {}).map(([field, values]) => [
        field,
        values.filter((value) => !isUnsafePublicText(value)),
      ]),
    ),
  };
}

export function toSafePublicError(error: unknown, fallback: PublicErrorInput): PublicErrorEnvelope {
  const candidate = error && typeof error === "object" && "code" in error && "message" in error
    ? {
      code: String((error as { code: unknown }).code),
      message: String((error as { message: unknown }).message),
      correlationId: fallback.correlationId,
      fieldErrors: fallback.fieldErrors,
    }
    : fallback;
  if (error instanceof Error && isUnsafePublicText(error.message)) {
    return createPublicErrorEnvelope(sanitizePublicError(fallback));
  }
  return createPublicErrorEnvelope(sanitizePublicError(candidate));
}

export function createPublicErrorEnvelope(input: PublicErrorInput): PublicErrorEnvelope {
  const safe = sanitizePublicError(input);
  return publicErrorEnvelopeSchema.parse({
    ok: false,
    error: {
      code: safe.code,
      message: safe.message,
      fieldErrors: safe.fieldErrors ?? {},
      correlationId: safe.correlationId,
    },
  });
}

export function createPublicErrorResponse(input: PublicErrorInput, status: number) {
  return NextResponse.json(createPublicErrorEnvelope(input), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Correlation-ID": input.correlationId,
    },
  });
}
