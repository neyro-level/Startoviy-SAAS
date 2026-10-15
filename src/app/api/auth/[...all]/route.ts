import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/modules/identity-access/server";
import { handleAuthHttpRequest } from "@/platform/auth/login-security";
import { createCorrelationId } from "@/platform/http/correlation";
import { getLogger } from "@/platform/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleAuthRequest(method: "GET" | "POST", request: Request) {
  const correlationId = createCorrelationId();
  const logger = getLogger({ route: "auth", method, correlationId });
  if (!auth) logger.error("auth service unavailable");
  return handleAuthHttpRequest({
    method,
    request,
    auth,
    correlationId,
    createHandlers: toNextJsHandler,
  });
}

export function GET(request: Request) {
  return handleAuthRequest("GET", request);
}

export function POST(request: Request) {
  return handleAuthRequest("POST", request);
}
