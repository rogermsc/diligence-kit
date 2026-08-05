/*
  Warnings:

  - You are about to drop the column `onePagerSummary` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."companies" DROP COLUMN "onePagerSummary";

-- CreateTable
CREATE TABLE "public"."one_pagers" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_pagers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_onepager_automation" ON "public"."one_pagers"("automationId");

-- CreateIndex
CREATE INDEX "idx_onepager_company" ON "public"."one_pagers"("companyId");

-- AddForeignKey
ALTER TABLE "public"."one_pagers" ADD CONSTRAINT "one_pagers_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."one_pagers" ADD CONSTRAINT "one_pagers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
