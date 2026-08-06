-- Adds the tenancy root: every company belongs to exactly one user.
--
-- Prisma generated a bare `ADD COLUMN "ownerId" TEXT NOT NULL`, which aborts on
-- any deployment that already has companies. This adds it nullable, backfills,
-- then enforces, so existing data survives.
--
-- AFTER RUNNING THIS ON AN EXISTING DEPLOYMENT: verify who owns what before
-- anyone logs in. Ownership decides all visibility from here on.
--
--   SELECT c."name", u."email"
--   FROM "companies" c JOIN "users" u ON u."id" = c."ownerId"
--   ORDER BY u."email";
--
-- Reassign with: UPDATE "companies" SET "ownerId" = '<user id>' WHERE "id" = '<company id>';
-- Note the FK is ON DELETE CASCADE — deleting a user destroys every company it
-- owns, and their datarooms, while leaving the storage objects orphaned.

-- 1. Nullable first, so the column can be added to a populated table.
ALTER TABLE "companies" ADD COLUMN "ownerId" TEXT;

-- 2a. Prefer the existing users.companyId association, which is the only real
--     record of who worked on what before tenancy existed. Where several users
--     share a company, the oldest account wins; id breaks created_at ties so
--     the result is reproducible across replays and restored dumps.
UPDATE "companies" c
SET "ownerId" = u."id"
FROM (
  SELECT DISTINCT ON ("companyId") "companyId", "id"
  FROM "users"
  WHERE "companyId" IS NOT NULL
  ORDER BY "companyId", "created_at" ASC, "id" ASC
) u
WHERE c."id" = u."companyId" AND c."ownerId" IS NULL;

-- 2b. Anything still unclaimed had no association at all; fall back to the
--     oldest account so no dataroom is stranded.
UPDATE "companies"
SET "ownerId" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC, "id" ASC LIMIT 1)
WHERE "ownerId" IS NULL;

-- 2c. Last resort: companies exist but no user does. Rather than fail the
--     migration — which marks it failed in _prisma_migrations, crash-loops the
--     pod through entrypoint.sh, and then blocks every later migration behind
--     P3009 with no in-app recovery — park the rows on a clearly-marked
--     placeholder account. It owns nothing reachable (its password hash is not
--     a valid bcrypt digest, so no one can log in as it) and an operator can
--     reassign with a single UPDATE.
INSERT INTO "users" ("id", "email", "password", "created_at")
SELECT
  'unassigned-owner-placeholder',
  'unassigned@invalid.local',
  'x',
  now()
WHERE EXISTS (SELECT 1 FROM "companies" WHERE "ownerId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "id" = 'unassigned-owner-placeholder')
ON CONFLICT ("email") DO NOTHING;

-- Resolve by email rather than assuming the id: a restored dump may already
-- carry this account under a different id, and the INSERT above would then have
-- been a no-op.
UPDATE "companies"
SET "ownerId" = (SELECT "id" FROM "users" WHERE "email" = 'unassigned@invalid.local' LIMIT 1)
WHERE "ownerId" IS NULL;

ALTER TABLE "companies" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_company_owner" ON "companies"("ownerId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
