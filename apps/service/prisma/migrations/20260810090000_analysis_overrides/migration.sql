-- Human judgement recorded on top of a run, never inside it.
--
-- The machine's analysis is a run artefact and is not edited. Overrides,
-- annotations and reverts all land here instead, attributed and timestamped,
-- and the read endpoint merges the two so every value can say whether it came
-- from the model or from a person.
--
-- Append-only by construction: nothing updates or deletes a row. The latest row
-- per (automationId, targetType, targetKey) wins, and a revert is a new row
-- with a null value rather than a deletion. That makes the audit trail free —
-- the table is the trail — and means no history model and no soft-delete flag.
--
-- rationale is NOT NULL on purpose. An override with no stated reason is
-- exactly the unsourced assertion this product exists to argue against.

CREATE TYPE "OverrideTargetType" AS ENUM ('FACT', 'CONFLICT', 'SCORECARD', 'ANNOTATION');

CREATE TABLE "analysis_overrides" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "targetType" "OverrideTargetType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "value" JSONB,
    "rationale" TEXT NOT NULL,
    -- TEXT, not UUID: users.id is TEXT (User.id has no @db.Uuid), and Postgres
    -- refuses a foreign key between mismatched types.
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_overrides_pkey" PRIMARY KEY ("id")
);

-- The only read pattern: every override for one run, resolved to the latest per
-- target.
CREATE INDEX "idx_override_target" ON "analysis_overrides"("automationId", "targetType", "targetKey");

ALTER TABLE "analysis_overrides"
    ADD CONSTRAINT "analysis_overrides_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "automations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- No cascade on the author: deleting a user must not silently rewrite the
-- history of a run they made decisions on.
ALTER TABLE "analysis_overrides"
    ADD CONSTRAINT "analysis_overrides_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
