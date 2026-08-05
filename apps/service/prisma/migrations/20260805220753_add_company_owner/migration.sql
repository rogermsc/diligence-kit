-- Adds the tenancy root: every company belongs to exactly one user.
--
-- Prisma generated a bare `ADD COLUMN "ownerId" TEXT NOT NULL`, which aborts on
-- any deployment that already has companies. This does it in three steps so
-- existing data survives: add nullable, backfill, then enforce.

-- 1. Nullable first, so the column can be added to a populated table.
ALTER TABLE "companies" ADD COLUMN "ownerId" TEXT;

-- 2. Backfill to the oldest user account. Pre-tenancy rows have no owner
--    recorded anywhere, so "the first account" is the only available answer; an
--    operator whose data already spans several tenants must reassign afterwards.
UPDATE "companies"
SET "ownerId" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "ownerId" IS NULL;

-- 3. Refuse to continue if anything is still unowned — that means companies
--    exist but no user does. Failing loudly is correct here: dropping the NOT
--    NULL would leave rows no owner-scoped query can ever reach, and deleting
--    them would destroy datarooms.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "companies" WHERE "ownerId" IS NULL) THEN
    RAISE EXCEPTION
      'Cannot add companies.ownerId: % company row(s) have no user to own them. Create a user first, then re-run this migration.',
      (SELECT COUNT(*) FROM "companies" WHERE "ownerId" IS NULL);
  END IF;
END $$;

ALTER TABLE "companies" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_company_owner" ON "companies"("ownerId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
