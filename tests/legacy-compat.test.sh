#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
. ./legacy-compat.sh

failures=0

check() {
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

unset SHERLOCK_AUTH_ENABLED SOURCEBOT_AUTH_ENABLED SHERLOCK_ENCRYPTION_KEY SOURCEBOT_ENCRYPTION_KEY
check "legacy value is adopted" "true" "$(export SOURCEBOT_AUTH_ENABLED=true ; adopt_legacy_env 2>/dev/null; echo "$SHERLOCK_AUTH_ENABLED")"

check "new name wins over legacy" "false" "$(export SHERLOCK_AUTH_ENABLED=false SOURCEBOT_AUTH_ENABLED=true ; adopt_legacy_env 2>/dev/null; echo "$SHERLOCK_AUTH_ENABLED")"

check "unset legacy leaves new name empty" "" "$(adopt_legacy_env 2>/dev/null; echo "$SHERLOCK_AUTH_ENABLED")"

check "adoption warns about the deprecated name" "[Warning] SOURCEBOT_ENCRYPTION_KEY is deprecated, use SHERLOCK_ENCRYPTION_KEY." "$(export SOURCEBOT_ENCRYPTION_KEY=k ; adopt_legacy_env 2>&1 >/dev/null | sed 's/.\[[0-9;]*m//g')"

tmp=$(mktemp -d)
mkdir -p "$tmp/data/.sourcebot" && echo secret > "$tmp/data/.sourcebot/.secret"
DATA_CACHE_DIR="$tmp/data/.sherlock" migrate_legacy_data_dir >/dev/null 2>&1
check "legacy data dir is moved" "secret" "$(cat "$tmp/data/.sherlock/.secret" 2>/dev/null)"
check "legacy data dir is gone after move" "no" "$([ -d "$tmp/data/.sourcebot" ] && echo yes || echo no)"

mkdir -p "$tmp/empty/.sourcebot" "$tmp/empty/.sherlock" && echo old > "$tmp/empty/.sourcebot/.secret"
DATA_CACHE_DIR="$tmp/empty/.sherlock" migrate_legacy_data_dir >/dev/null 2>&1
check "empty new data dir does not block the move" "old" "$(cat "$tmp/empty/.sherlock/.secret" 2>/dev/null)"

mkdir -p "$tmp/both/.sourcebot" "$tmp/both/.sherlock" && echo new > "$tmp/both/.sherlock/.secret"
DATA_CACHE_DIR="$tmp/both/.sherlock" migrate_legacy_data_dir >/dev/null 2>&1
check "existing new data dir is not overwritten" "new" "$(cat "$tmp/both/.sherlock/.secret")"

check "legacy default database url is rewritten" "postgresql://postgres@localhost:5432/sherlock" "$(export DATABASE_URL=postgresql://postgres@localhost:5432/sourcebot ; adopt_legacy_database_url >/dev/null 2>&1; echo "$DATABASE_URL")" 
check "custom database url is untouched" "postgresql://u@h/db" "$(export DATABASE_URL=postgresql://u@h/db ; adopt_legacy_database_url >/dev/null 2>&1; echo "$DATABASE_URL")"

rm -rf "$tmp"
[ "$failures" -eq 0 ]
