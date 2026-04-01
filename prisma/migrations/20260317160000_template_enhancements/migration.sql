-- Migration: template_enhancements
-- 1. Rename ARCHIVED → INACTIVE in TemplateStatus enum
-- 2. Add lastScannedTokens + dismissedTokens to templates
-- 3. Make generation_runs.templateId nullable

-- Step 1: Rename enum value (PostgreSQL supports this directly)
ALTER TYPE "TemplateStatus" RENAME VALUE 'ARCHIVED' TO 'INACTIVE';

-- Step 2: Add new array columns to templates
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "lastScannedTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "dismissedTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Step 3: Make templateId nullable on generation_runs
ALTER TABLE "generation_runs" ALTER COLUMN "templateId" DROP NOT NULL;
