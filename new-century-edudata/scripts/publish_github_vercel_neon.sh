#!/usr/bin/env bash
set -euo pipefail

# Publish helper for the ACE System repo.
#
# Required before running:
#   1. Authenticate GitHub for local git push:
#      - HTTPS: configure a credential/token for https://github.com
#      - or SSH: change origin to git@github.com:NewsunLee007/ACE-System.git and add an SSH key
#   2. Authenticate Vercel CLI:
#      npx vercel login
#   3. Create a Neon database and export DATABASE_URL when seeding/deploying with Neon.
#
# Common usage:
#   cd "/Users/newsunsmac/Downloads/ACE System"
#   VERCEL_SCOPE="newsun-lees-projects" \
#   VERCEL_PROJECT="ace-system" \
#   DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" \
#   SEED_NEON=1 \
#   CREATE_VERCEL_PROJECT=1 \
#   DEPLOY_PROD=1 \
#   ./new-century-edudata/scripts/publish_github_vercel_neon.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/.." && pwd)"
BRANCH="${BRANCH:-$(git -C "${REPO_ROOT}" branch --show-current)}"
VERCEL_SCOPE="${VERCEL_SCOPE:-}"
VERCEL_PROJECT="${VERCEL_PROJECT:-ace-system}"
SEED_NEON="${SEED_NEON:-0}"
CREATE_VERCEL_PROJECT="${CREATE_VERCEL_PROJECT:-0}"
DEPLOY_PROD="${DEPLOY_PROD:-0}"
SKIP_CHECKS="${SKIP_CHECKS:-0}"
SKIP_GIT_DRY_RUN="${SKIP_GIT_DRY_RUN:-0}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

log "Repo root: ${REPO_ROOT}"
log "App dir: ${APP_DIR}"
log "Branch: ${BRANCH}"

require_command git
require_command npm
require_command npx

if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain --untracked-files=no)" ]]; then
  printf 'Tracked files have uncommitted changes. Commit or stash them before publishing.\n' >&2
  git -C "${REPO_ROOT}" status --short
  exit 1
fi

if [[ "${SKIP_GIT_DRY_RUN}" != "1" ]]; then
  log "Checking GitHub push credentials with dry-run"
  git -C "${REPO_ROOT}" push --dry-run -u origin "${BRANCH}"
fi

if [[ "${SKIP_CHECKS}" != "1" ]]; then
  log "Running frontend tests"
  (cd "${APP_DIR}/frontend" && npm test -- --watchAll=false --runInBand)

  log "Building frontend"
  (cd "${APP_DIR}/frontend" && npm run build)

  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="python3.11"
  else
    PYTHON_BIN="python3"
  fi
  if "${PYTHON_BIN}" -m pytest --version >/dev/null 2>&1; then
    log "Running backend tests"
    (cd "${APP_DIR}/backend" && "${PYTHON_BIN}" -m pytest -q)
  else
    log "Skipping backend pytest: ${PYTHON_BIN} does not have pytest installed"
  fi
else
  log "Skipping checks because SKIP_CHECKS=1"
fi

log "Pushing branch to GitHub"
git -C "${REPO_ROOT}" push -u origin "${BRANCH}"

if [[ "${SEED_NEON}" == "1" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    printf 'DATABASE_URL is required when SEED_NEON=1.\n' >&2
    exit 1
  fi
  log "Initializing Neon schema and seeding real demo data"
  (cd "${APP_DIR}" && "${PYTHON_BIN:-python3}" scripts/seed_neon_demo_data.py --with-schema)
fi

if [[ -n "${VERCEL_SCOPE}" ]]; then
  if [[ "${CREATE_VERCEL_PROJECT}" == "1" ]]; then
    log "Creating Vercel project ${VERCEL_PROJECT} in scope ${VERCEL_SCOPE} if it does not already exist"
    (cd "${REPO_ROOT}" && npx vercel project add "${VERCEL_PROJECT}" --scope "${VERCEL_SCOPE}") || true
  fi
  log "Linking Vercel project ${VERCEL_PROJECT} in scope ${VERCEL_SCOPE}"
  (cd "${REPO_ROOT}" && npx vercel link --yes --project "${VERCEL_PROJECT}" --scope "${VERCEL_SCOPE}")
else
  log "Skipping vercel link because VERCEL_SCOPE is empty"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  log "DATABASE_URL is set locally. Ensure it is also configured in Vercel project environment variables."
  log "Vercel CLI env setup is intentionally left interactive so secrets are not echoed into shell history."
  log "Run if needed: npx vercel env add DATABASE_URL production"
fi

if [[ "${DEPLOY_PROD}" == "1" ]]; then
  log "Deploying production to Vercel"
  (cd "${REPO_ROOT}" && npx vercel deploy --prod)
else
  log "Deploying preview to Vercel"
  (cd "${REPO_ROOT}" && npx vercel deploy)
fi

log "Publish flow finished"
