-- Bilingual listing text slots (English + Amharic) for Gemini auto-translation.
ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "titleEn" TEXT,
  ADD COLUMN IF NOT EXISTS "titleAm" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionAm" TEXT;
