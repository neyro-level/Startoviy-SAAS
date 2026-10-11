-- Additive authority binding. Legacy timestamp-only sessions fail closed.
ALTER TABLE "Session" ADD COLUMN "twoFactorProof" TEXT;
