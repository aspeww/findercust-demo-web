-- AlterTable
ALTER TABLE "Project" ADD COLUMN "aiModel" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiPrompt" TEXT;
ALTER TABLE "Project" ADD COLUMN "generatedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "generatedHtml" TEXT;
