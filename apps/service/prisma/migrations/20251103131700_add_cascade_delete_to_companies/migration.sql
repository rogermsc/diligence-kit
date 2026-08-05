-- DropForeignKey
ALTER TABLE "public"."automations" DROP CONSTRAINT "automations_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."documents" DROP CONSTRAINT "documents_automationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."one_pagers" DROP CONSTRAINT "one_pagers_automationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."one_pagers" DROP CONSTRAINT "one_pagers_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."output_documents" DROP CONSTRAINT "output_documents_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."output_documents" DROP CONSTRAINT "output_documents_resultId_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_automationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."results" DROP CONSTRAINT "results_automationId_fkey";

-- AddForeignKey
ALTER TABLE "public"."automations" ADD CONSTRAINT "automations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."results" ADD CONSTRAINT "results_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."output_documents" ADD CONSTRAINT "output_documents_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "public"."results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."output_documents" ADD CONSTRAINT "output_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."one_pagers" ADD CONSTRAINT "one_pagers_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."one_pagers" ADD CONSTRAINT "one_pagers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
