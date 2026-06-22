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
#      or export VERCEL_TOKEN for non-interactive CI/local publishing.
#   3. Create a Neon database and export DATABASE_URL when seeding/deploying
#      or syncing Vercel environment variables.
#
# Common usage:
#   cd "/Users/newsunsmac/Downloads/ACE System"
#   VERCEL_SCOPE="newsun-lees-projects" \
#   VERCEL_PROJECT="ace-system" \
#   DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" \
#   SEED_NEON=1 \
#   CREATE_VERCEL_PROJECT=1 \
#   SYNC_VERCEL_ENV=1 \
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
SYNC_VERCEL_ENV="${SYNC_VERCEL_ENV:-0}"
VERCEL_ENV_TARGETS="${VERCEL_ENV_TARGETS:-production preview development}"
SECRET_KEY="${SECRET_KEY:-}"

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

if command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="${PYTHON_BIN:-python3.11}"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

VERCEL_TOKEN_ARGS=()
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  VERCEL_TOKEN_ARGS=(--token "${VERCEL_TOKEN}")
fi

vercel_cli() {
  npx vercel "$@" "${VERCEL_TOKEN_ARGS[@]}"
}

require_vercel_auth() {
  if ! (cd "${REPO_ROOT}" && vercel_cli whoami >/dev/null 2>&1); then
    printf 'Vercel CLI is not authenticated. Run `npx vercel login` or export VERCEL_TOKEN.\n' >&2
    exit 1
  fi
}

add_vercel_env_if_set() {
  local key="$1"
  local value="$2"
  local target

  if [[ -z "${value}" ]]; then
    return 0
  fi

  for target in ${VERCEL_ENV_TARGETS}; do
    log "Syncing Vercel env ${key} to ${target}"
    if ! printf '%s' "${value}" | (cd "${REPO_ROOT}" && vercel_cli env add "${key}" "${target}" --scope "${VERCEL_SCOPE}" >/dev/null); then
      log "Skipping ${key} for ${target}; it may already exist. Remove it in Vercel first if the value must change."
    fi
  done
}

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
  require_vercel_auth
  if [[ "${CREATE_VERCEL_PROJECT}" == "1" ]]; then
    log "Creating Vercel project ${VERCEL_PROJECT} in scope ${VERCEL_SCOPE} if it does not already exist"
    (cd "${REPO_ROOT}" && vercel_cli project add "${VERCEL_PROJECT}" --scope "${VERCEL_SCOPE}") || true
  fi
  log "Linking Vercel project ${VERCEL_PROJECT} in scope ${VERCEL_SCOPE}"
  (cd "${REPO_ROOT}" && vercel_cli link --yes --project "${VERCEL_PROJECT}" --scope "${VERCEL_SCOPE}")
else
  log "Skipping vercel link because VERCEL_SCOPE is empty"
fi

if [[ "${SYNC_VERCEL_ENV}" == "1" ]]; then
  if [[ -z "${VERCEL_SCOPE}" ]]; then
    printf 'VERCEL_SCOPE is required when SYNC_VERCEL_ENV=1.\n' >&2
    exit 1
  fi
  require_vercel_auth
  add_vercel_env_if_set "DATABASE_URL" "${DATABASE_URL:-}"
  add_vercel_env_if_set "SECRET_KEY" "${SECRET_KEY}"
  add_vercel_env_if_set "DEEPSEEK_API_KEY" "${DEEPSEEK_API_KEY:-}"
  add_vercel_env_if_set "DEEPSEEK_API_BASE_URL" "${DEEPSEEK_API_BASE_URL:-}"
  add_vercel_env_if_set "DEEPSEEK_MODEL" "${DEEPSEEK_MODEL:-}"
elif [[ -n "${DATABASE_URL:-}" ]]; then
  log "DATABASE_URL is set locally. Set SYNC_VERCEL_ENV=1 to add it to the linked Vercel project."
fi

require_vercel_auth
if [[ "${DEPLOY_PROD}" == "1" ]]; then
  log "Deploying production to Vercel"
  (cd "${REPO_ROOT}" && vercel_cli deploy --prod)
else
  log "Deploying preview to Vercel"
  (cd "${REPO_ROOT}" && vercel_cli deploy)
fi

log "Publish flow finished"
