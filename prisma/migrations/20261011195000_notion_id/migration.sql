-- AlterTable
ALTER TABLE "Question" ADD COLUMN "notionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Question_userId_notionId_key" ON "Question"("userId", "notionId");
