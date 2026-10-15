-- Additive account-scoped login lockout. Expired windows must be re-checked in application code.
ALTER TABLE "User"
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loginLockedUntil" TIMESTAMPTZ(3);
