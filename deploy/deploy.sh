#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/root/ig_automatic_tools}"
REF="${1:-main}"

cd "$ROOT"
git fetch --tags origin
git checkout "$REF"
if [ "$REF" = "main" ]; then git pull --ff-only origin main; fi

cd "$ROOT/web"
yarn install --frozen-lockfile
yarn build

cd "$ROOT/api"
yarn install --frozen-lockfile
yarn build

systemctl restart ig-automatic-tools
sleep 3
curl -fsS http://127.0.0.1:3930/ig/api/health
echo
