/*
  Warnings:

  - The values [PRODUCT,SALES,MARKETING] on the enum `OutputSector` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OutputSector_new" AS ENUM ('COMPANY_SUMMARY', 'TEAM', 'CORPORATE', 'CLIENTS', 'INVESTMENT', 'LEGAL', 'FINANCIAL');
ALTER TABLE "output_documents" ALTER COLUMN "sector" TYPE "OutputSector_new" USING ("sector"::text::"OutputSector_new");
ALTER TYPE "OutputSector" RENAME TO "OutputSector_old";
ALTER TYPE "OutputSector_new" RENAME TO "OutputSector";
DROP TYPE "OutputSector_old";
COMMIT;
