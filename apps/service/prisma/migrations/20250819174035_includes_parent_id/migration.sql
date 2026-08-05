/*
  Warnings:

  - A unique constraint covering the columns `[automationId]` on the table `one_pagers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."automations" ADD COLUMN     "parentAutomationId" UUID;

-- CreateIndex
CREATE INDEX "idx_automation_parent" ON "public"."automations"("parentAutomationId");

-- CreateIndex
CREATE UNIQUE INDEX "one_pagers_automationId_key" ON "public"."one_pagers"("automationId");

-- AddForeignKey
ALTER TABLE "public"."automations" ADD CONSTRAINT "automations_parentAutomationId_fkey" FOREIGN KEY ("parentAutomationId") REFERENCES "public"."automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
