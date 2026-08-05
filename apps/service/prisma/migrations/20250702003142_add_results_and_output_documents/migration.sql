/*
  Warnings:

  - You are about to drop the column `result` on the `automations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('OK', 'MISSING_DOCS');

-- CreateEnum
CREATE TYPE "OutputDocumentStatus" AS ENUM ('OK', 'MISSING', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "OutputSector" AS ENUM ('TEAM', 'LEGAL', 'FINANCIAL', 'PRODUCT', 'SALES', 'MARKETING', 'INVESTMENT');

-- AlterTable
ALTER TABLE "automations" DROP COLUMN "result";

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "bucketPath" DROP NOT NULL;

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "output_documents" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "documentId" UUID,
    "name" TEXT NOT NULL,
    "status" "OutputDocumentStatus" NOT NULL,
    "sector" "OutputSector" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "output_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_result_automation" ON "results"("automationId");

-- CreateIndex
CREATE INDEX "idx_output_document_result" ON "output_documents"("resultId");

-- CreateIndex
CREATE INDEX "idx_output_document_document" ON "output_documents"("documentId");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_documents" ADD CONSTRAINT "output_documents_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_documents" ADD CONSTRAINT "output_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
