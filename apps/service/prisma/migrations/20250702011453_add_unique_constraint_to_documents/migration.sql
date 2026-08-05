/*
  Warnings:

  - A unique constraint covering the columns `[automationId,name]` on the table `documents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "documents_automationId_name_key" ON "documents"("automationId", "name");
