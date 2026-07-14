#!/usr/bin/env bash
# Nasazení na GitHub Pages (https://krystofdvorak.github.io/carsset/)
# Použití: npm run deploy
set -euo pipefail

REPO_URL="$(git config --get remote.origin.url)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Build (base=/carsset/)…"
DEPLOY_BASE=/carsset/ npm run build

echo "▶ Publikuji dist/ na větev gh-pages…"
cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@carsset" commit -qm "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f "$REPO_URL" gh-pages
rm -rf .git
cd "$ROOT"

echo "✓ Hotovo → https://krystofdvorak.github.io/carsset/ (build ~1 min)"
