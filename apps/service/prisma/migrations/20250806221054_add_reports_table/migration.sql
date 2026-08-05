-- CreateEnum
CREATE TYPE "public"."AgentType" AS ENUM ('OPERATIONAL', 'COMMERCIAL', 'FINANCIAL', 'CAP_TABLE_AND_LEGAL_REVIEW');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('COMPLETED', 'FAILED', 'UNTRACKED');

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "domain" "public"."AgentType" NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'UNTRACKED',
    "reportUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_report_automation" ON "public"."reports"("automationId");

-- CreateIndex
CREATE INDEX "idx_report_company" ON "public"."reports"("companyId");

-- CreateIndex
CREATE INDEX "idx_report_domain" ON "public"."reports"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "reports_automationId_domain_key" ON "public"."reports"("automationId", "domain");

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "public"."automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
