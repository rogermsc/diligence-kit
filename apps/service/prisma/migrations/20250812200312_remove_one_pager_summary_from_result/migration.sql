/*
  Warnings:

  - You are about to drop the column `onePagerSummary` on the `results` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."companies" ADD COLUMN     "onePagerSummary" TEXT;

-- AlterTable
ALTER TABLE "public"."results" DROP COLUMN "onePagerSummary";
