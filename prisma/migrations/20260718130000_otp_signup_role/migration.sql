-- Persist signup role choice through the OTP challenge.
ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "role" TEXT;
