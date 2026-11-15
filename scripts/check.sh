#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -B -f backend/pom.xml verify
worker/.venv/bin/pytest worker/tests -q
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e
