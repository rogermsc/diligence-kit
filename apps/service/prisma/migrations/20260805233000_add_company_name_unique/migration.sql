-- Company names must be unique across ALL owners.
--
-- Object-storage paths are namespaced by company NAME (see
-- GoogleStorageService.uploadSingleFile), so two companies sharing a name share a
-- storage prefix and overwrite each other's documents. CreateCompanyUseCase
-- checks this, but a read-then-create cannot hold under concurrent requests, and
-- the k8s manifests run multiple replicas — so it belongs in the database.

-- Nothing enforced this before, so duplicates may already exist. Renaming is the
-- only non-destructive way to make the constraint addable: the oldest row keeps
-- the name, the rest get a slice of their id appended. Already-uploaded
-- documents keep working (Documents.bucketPath stores the full path, not the
-- prefix); future uploads for a renamed company land under the new name.
UPDATE "companies" c
SET "name" = c."name" || ' (' || substring(c."id"::text, 1, 8) || ')'
WHERE EXISTS (
  SELECT 1 FROM "companies" other
  WHERE other."name" = c."name"
    AND (other."createdAt" < c."createdAt"
         OR (other."createdAt" = c."createdAt" AND other."id" < c."id"))
);

CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");
