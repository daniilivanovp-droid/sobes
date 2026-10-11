#!/bin/sh
# Pulls the latest version and applies it: dependencies and database migrations.
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
npm install --no-audit --no-fund
npx prisma migrate deploy
echo "Готово. Перезапустите сайт: npm run dev"
