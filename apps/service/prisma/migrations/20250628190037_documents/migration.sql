-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bucketPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
