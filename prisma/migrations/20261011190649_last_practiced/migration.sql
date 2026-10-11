-- AlterTable
ALTER TABLE "Question" ADD COLUMN "lastPracticedAt" DATETIME;

-- Backfill from existing attempts.
UPDATE "Question" SET "lastPracticedAt" = (SELECT MAX("createdAt") FROM "Attempt" WHERE "Attempt"."questionId" = "Question"."id");
