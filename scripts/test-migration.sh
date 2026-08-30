#!/usr/bin/env bash
#
# Runs supabase/migrations against a throwaway PostgreSQL instance and then
# exercises the Row Level Security policies from supabase/tests.
#
# This is what proves the two claims DayOS makes about its data: the schema
# applies cleanly, and a signed-in user can reach their own rows and nothing
# else. It needs only a local PostgreSQL — no Supabase project, no network.
#
#   ./scripts/test-migration.sh
#
# Set PGBIN if your PostgreSQL binaries aren't on PATH, e.g.
#   PGBIN=/usr/lib/postgresql/16/bin ./scripts/test-migration.sh

set -euo pipefail

# PostgreSQL refuses to run as root. In a container (CI, Docker) that is who
# you are, so hand the whole script over to the `postgres` user when one
# exists — on a normal machine this branch never runs.
if [ "$(id -u)" -eq 0 ] && [ -z "${DAYOS_PG_REEXEC:-}" ]; then
  if id postgres >/dev/null 2>&1; then
    SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
    exec su postgres -c \
      "DAYOS_PG_REEXEC=1 PGBIN='${PGBIN:-}' PGPORT='${PGPORT:-}' bash '$SCRIPT'"
  fi
  echo "error: PostgreSQL cannot run as root and no 'postgres' user exists." >&2
  exit 1
fi

PGBIN="${PGBIN:-}"
if [ -n "$PGBIN" ]; then export PATH="$PGBIN:$PATH"; fi

for binary in initdb pg_ctl psql; do
  command -v "$binary" >/dev/null || {
    echo "error: $binary not found. Install PostgreSQL, or set PGBIN." >&2
    exit 1
  }
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
# initdb insists on an empty directory, so the socket lives beside it.
DATA_DIR="$WORK_DIR/data"
SOCKET_DIR="$WORK_DIR/socket"
mkdir -p "$SOCKET_DIR"
# An empty PGPORT is worse than an unset one: initdb reads the variable
# directly and rejects "" as a port.
if [ -z "${PGPORT:-}" ]; then unset PGPORT; fi
PORT="${PGPORT:-5433}"

cleanup() {
  pg_ctl -D "$DATA_DIR" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "→ starting a throwaway PostgreSQL in $DATA_DIR"
initdb -D "$DATA_DIR" -A trust >/dev/null
pg_ctl -D "$DATA_DIR" -l "$WORK_DIR/server.log" \
  -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=''" start >/dev/null

run() { psql -v ON_ERROR_STOP=1 -q -h "$SOCKET_DIR" -p "$PORT" -d postgres "$@"; }

echo "→ applying the Supabase shim (auth schema, auth.uid, API roles)"
run -f "$ROOT/supabase/tests/00_supabase_shim.sql"

echo "→ applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$migration")"
  run -f "$migration"
done

echo "→ applying the grants Supabase gives the API roles"
run -f "$ROOT/supabase/tests/02_grants.sql"

echo "→ running row level security tests"
run -f "$ROOT/supabase/tests/03_rls_test.sql"

echo
echo "✓ migration applies cleanly and every isolation test passed"
