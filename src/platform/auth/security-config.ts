export const betterAuthPinnedVersion = "1.7.2";

export const authPasswordPolicy = {
  existingCredentialMinLength: 8,
  newPasswordMinLength: 12,
  maxPasswordLength: 128,
} as const;

export function createEmailPasswordConfig() {
  return {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: authPasswordPolicy.existingCredentialMinLength,
    maxPasswordLength: authPasswordPolicy.maxPasswordLength,
  };
}

const strictRule = (window: number, max: number) => ({ window, max });

export function createAuthRateLimitConfig() {
  return {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database" as const,
    customRules: {
      "/sign-in/email": strictRule(60, 5),
      "/sign-in/username": strictRule(60, 5),
    },
  };
}

export function createAuthIpAddressConfig(input: {
  trustedProxyCidrs: string[];
  isProduction: boolean;
}) {
  if (input.isProduction && input.trustedProxyCidrs.length === 0) {
    throw new Error("BETTER_AUTH_TRUSTED_PROXY_CIDRS is required when Better Auth runs in production");
  }

  return {
    ipAddressHeaders: input.trustedProxyCidrs.length > 0 ? ["x-forwarded-for"] : [],
    trustedProxies: input.trustedProxyCidrs,
  };
}

export function isTotpVerificationPath(path: string | undefined): boolean {
  return path === "/two-factor/verify-totp";
}
