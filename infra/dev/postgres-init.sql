-- Creates the second database used by the liaison-agent.
-- Runs once on first container start (volume must be empty).
SELECT 'CREATE DATABASE diligence_kit_liaison'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'diligence_kit_liaison')\gexec
