-- Liveness for in-flight runs.
--
-- The stale-run reaper compared updatedAt against a timeout, but nothing writes
-- to the row while the agent works — so a slow healthy run was indistinguishable
-- from an abandoned one, and failing one that was still executing let it be
-- retried into a second dispatch of the same automation.
--
-- Nullable, so rows that predate this and runs from an older agent fall back to
-- updatedAt and behave exactly as before.
ALTER TABLE "automations" ADD COLUMN "heartbeatAt" TIMESTAMP(3);

-- The reaper's predicate is (status, liveness), so index it that way.
CREATE INDEX "idx_automation_liveness" ON "automations"("status", "heartbeatAt");
