-- Keep the analysis, not just the PDF.
--
-- The agent computed facts with sources, pages and verbatim quotes, resolved
-- the contradictions between them, and scored an eight-category rubric — then
-- rendered a PDF and posted back a URL. Everything structured died with the
-- process. The frontend could offer a download and nothing else, which meant
-- the one thing this product does that others do not was invisible in it.
--
-- One JSONB document rather than fact and conflict tables. Every write is a
-- whole run and every read is a whole run; nothing queries across runs. The
-- relational model is the upgrade path, not the starting point.
--
-- Both columns in one migration even though only one_pagers has a reader yet:
-- a second migration arriving later from a parallel branch is a conflict over
-- ordering, and this costs one extra line now.
--
-- Nullable so rows that predate this keep working — the read endpoint returns
-- analysis: null and the caller falls back to the PDF download.
--
-- No index. Nothing queries inside the document, and automationId is already
-- unique on one_pagers.

ALTER TABLE "one_pagers" ADD COLUMN "analysis" JSONB;
ALTER TABLE "reports" ADD COLUMN "analysis" JSONB;
