-- Company names become unique per owner rather than globally.
--
-- The global constraint existed because object-storage paths were namespaced by
-- company name: two tenants sharing a name would have shared a storage prefix.
-- That made a display-name collision a security question, and it leaked the
-- existence of other tenants' company names — you learned one existed by being
-- refused it. Storage paths are keyed on the company id now, so the constraint
-- reverts to what it should always have been.
--
-- Objects already written under the old <company name>/<automation id> prefix
-- are not moved. They do not need to be: each document row stores its own full
-- gs:// path in documents."bucketPath" and is read back through that, so old
-- documents keep resolving while new ones are written under the id.

DROP INDEX IF EXISTS "companies_name_key";

-- Two owners may now hold the same name, but one owner still may not hold it
-- twice. Any pre-existing duplicate within a single owner is impossible — the
-- global constraint this replaces was strictly stronger — so this cannot fail
-- on existing data.
CREATE UNIQUE INDEX "unique_owner_company_name" ON "companies"("ownerId", "name");
