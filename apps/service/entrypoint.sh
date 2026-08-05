#!/bin/sh
set -e

echo "Waiting for Cloud SQL Proxy to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z localhost 5432 2>/dev/null || node -e "require('net').connect(5432, 'localhost').on('connect', () => process.exit(0)).on('error', () => process.exit(1))" 2>/dev/null; then
    echo "Cloud SQL Proxy is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Waiting for proxy... ($attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Timeout waiting for Cloud SQL Proxy"
  exit 1
fi

echo "Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "Starting the application..."
pnpm start