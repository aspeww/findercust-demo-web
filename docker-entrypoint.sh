#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/data/prod.db"
fi

echo "Running database migrations..."
npx prisma migrate deploy

if [ "$DEMO_SEED" = "true" ]; then
  echo "Seeding demo data..."
  npx tsx prisma/seed.ts || true
fi

exec "$@"
