LEGACY_DATABASE_URL="postgresql://postgres@localhost:5432/sourcebot"
DEFAULT_DATABASE_URL="postgresql://postgres@localhost:5432/sherlock"

adopt_legacy_env() {
    for suffix in ENCRYPTION_KEY TELEMETRY_DISABLED AUTH_ENABLED TENANCY_MODE LOG_LEVEL INSTALL_ID; do
        eval "current=\${SHERLOCK_$suffix:-}"
        eval "legacy=\${SOURCEBOT_$suffix:-}"
        if [ -z "$current" ] && [ -n "$legacy" ]; then
            printf '%b\n' "\033[33m[Warning] SOURCEBOT_$suffix is deprecated, use SHERLOCK_$suffix.\033[0m" >&2
            export "SHERLOCK_$suffix=$legacy"
        fi
    done
}

adopt_legacy_database_url() {
    if [ "$DATABASE_URL" = "$LEGACY_DATABASE_URL" ]; then
        printf '%b\n' "\033[33m[Warning] DATABASE_URL points at the legacy database name, using $DEFAULT_DATABASE_URL.\033[0m" >&2
        export DATABASE_URL="$DEFAULT_DATABASE_URL"
    fi
}

migrate_legacy_data_dir() {
    legacy_dir="$(dirname "$DATA_CACHE_DIR")/.sourcebot"
    if [ ! -d "$legacy_dir" ]; then
        return 0
    fi
    if [ -d "$DATA_CACHE_DIR" ] && [ -z "$(ls -A "$DATA_CACHE_DIR")" ]; then
        rmdir "$DATA_CACHE_DIR"
    fi
    if [ -d "$DATA_CACHE_DIR" ]; then
        return 0
    fi
    if mv "$legacy_dir" "$DATA_CACHE_DIR"; then
        printf '%b\n' "\033[34m[Info] Moved legacy data directory $legacy_dir to $DATA_CACHE_DIR.\033[0m"
    else
        printf '%b\n' "\033[31m[Error] Could not move $legacy_dir to $DATA_CACHE_DIR. Mount the volume at $(dirname "$DATA_CACHE_DIR") or rename the directory manually.\033[0m" >&2
        return 1
    fi
}
