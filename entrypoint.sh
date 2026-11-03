#!/bin/sh
set -e

. "$(dirname "$0")/legacy-compat.sh"
adopt_legacy_env
adopt_legacy_database_url
migrate_legacy_data_dir

export SHERLOCK_LOG_LEVEL="${SHERLOCK_LOG_LEVEL:-info}"

if [ "$DATABASE_URL" = "postgresql://postgres@localhost:5432/sherlock" ]; then
    DATABASE_EMBEDDED="true"
fi

echo -e "\e[34m[Info] Sherlock version: $NEXT_PUBLIC_SHERLOCK_VERSION\e[0m"

# If we don't have a PostHog key, then we need to disable telemetry.
if [ -z "$NEXT_PUBLIC_POSTHOG_PAPIK" ]; then
    echo -e "\e[33m[Warning] NEXT_PUBLIC_POSTHOG_PAPIK was not set. Setting SHERLOCK_TELEMETRY_DISABLED.\e[0m"
    export SHERLOCK_TELEMETRY_DISABLED=true
fi

if [ -n "$SHERLOCK_TELEMETRY_DISABLED" ]; then
    # Validate that SHERLOCK_TELEMETRY_DISABLED is either "true" or "false"
    if [ "$SHERLOCK_TELEMETRY_DISABLED" != "true" ] && [ "$SHERLOCK_TELEMETRY_DISABLED" != "false" ]; then
        echo -e "\e[31m[Error] SHERLOCK_TELEMETRY_DISABLED must be either 'true' or 'false'. Got '$SHERLOCK_TELEMETRY_DISABLED'\e[0m"
        exit 1
    fi
else
    export SHERLOCK_TELEMETRY_DISABLED=true
fi

# Issue a info message about telemetry
if [ "$SHERLOCK_TELEMETRY_DISABLED" = "true" ]; then
    echo -e "\e[34m[Info] Disabling telemetry since SHERLOCK_TELEMETRY_DISABLED was set.\e[0m"
fi

# Check if DATA_CACHE_DIR exists, if not create it
if [ ! -d "$DATA_CACHE_DIR" ]; then
    mkdir -p "$DATA_CACHE_DIR"
fi

# Check if DATABASE_DATA_DIR exists, if not initialize it
if [ "$DATABASE_EMBEDDED" = "true" ] && [ ! -d "$DATABASE_DATA_DIR" ]; then
    echo -e "\e[34m[Info] Initializing database at $DATABASE_DATA_DIR...\e[0m"
    mkdir -p $DATABASE_DATA_DIR && chown -R postgres:postgres "$DATABASE_DATA_DIR"
    su postgres -c "initdb -D $DATABASE_DATA_DIR"
fi

# Create the redis data directory if it doesn't exist
if [ ! -d "$REDIS_DATA_DIR" ]; then
    mkdir -p $REDIS_DATA_DIR
fi

if [ -z "$SHERLOCK_ENCRYPTION_KEY" ]; then
    echo -e "\e[33m[Warning] SHERLOCK_ENCRYPTION_KEY is not set.\e[0m"

    if [ -f "$DATA_CACHE_DIR/.secret" ]; then
        echo -e "\e[34m[Info] Loading environment variables from $DATA_CACHE_DIR/.secret\e[0m"
    else
        echo -e "\e[34m[Info] Generating a new encryption key...\e[0m"
        SHERLOCK_ENCRYPTION_KEY=$(openssl rand -base64 24)
        echo "SHERLOCK_ENCRYPTION_KEY=\"$SHERLOCK_ENCRYPTION_KEY\"" >> "$DATA_CACHE_DIR/.secret"
    fi

    set -a
    . "$DATA_CACHE_DIR/.secret"
    set +a
    adopt_legacy_env
fi

# @see : https://authjs.dev/getting-started/deployment#auth_secret
if [ -z "$AUTH_SECRET" ]; then
    echo -e "\e[33m[Warning] AUTH_SECRET is not set.\e[0m"

    if [ -f "$DATA_CACHE_DIR/.authjs-secret" ]; then
        echo -e "\e[34m[Info] Loading environment variables from $DATA_CACHE_DIR/.authjs-secret\e[0m"
    else
        echo -e "\e[34m[Info] Generating a new encryption key...\e[0m"
        AUTH_SECRET=$(openssl rand -base64 33)
        echo "AUTH_SECRET=\"$AUTH_SECRET\"" >> "$DATA_CACHE_DIR/.authjs-secret"
    fi

    set -a
    . "$DATA_CACHE_DIR/.authjs-secret"
    set +a
fi

if [ -z "$AUTH_URL" ]; then
    echo -e "\e[33m[Warning] AUTH_URL is not set.\e[0m"
    export AUTH_URL="http://localhost:3000"
fi

# In order to detect if this is the first run, we create a `.installed` file in
# the cache directory.
FIRST_RUN_FILE="$DATA_CACHE_DIR/.installedv3"

if [ ! -f "$FIRST_RUN_FILE" ]; then
    touch "$FIRST_RUN_FILE"
    export SHERLOCK_INSTALL_ID=$(uuidgen)

    # If this is our first run, send a `install` event to PostHog
    # (if telemetry is enabled)
    if [ "$SHERLOCK_TELEMETRY_DISABLED" = "false" ] && [ -n "$NEXT_PUBLIC_POSTHOG_PAPIK" ]; then
        if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
            "api_key": "'"$NEXT_PUBLIC_POSTHOG_PAPIK"'",
            "event": "install",
            "distinct_id": "'"$SHERLOCK_INSTALL_ID"'",
            "properties": {
                "sherlock_version": "'"$NEXT_PUBLIC_SHERLOCK_VERSION"'"
            }
        }' https://us.i.posthog.com/capture/ ) then
            echo -e "\e[33m[Warning] Failed to send install event.\e[0m"
        fi
    fi
else
    export SHERLOCK_INSTALL_ID=$(cat "$FIRST_RUN_FILE" | jq -r '.install_id')
    PREVIOUS_VERSION=$(cat "$FIRST_RUN_FILE" | jq -r '.version')

    # If the version has changed, we assume an upgrade has occurred.
    if [ "$PREVIOUS_VERSION" != "$NEXT_PUBLIC_SHERLOCK_VERSION" ]; then
        echo -e "\e[34m[Info] Upgraded from version $PREVIOUS_VERSION to $NEXT_PUBLIC_SHERLOCK_VERSION\e[0m"

        if [ "$SHERLOCK_TELEMETRY_DISABLED" = "false" ] && [ -n "$NEXT_PUBLIC_POSTHOG_PAPIK" ]; then
            if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
                "api_key": "'"$NEXT_PUBLIC_POSTHOG_PAPIK"'",
                "event": "upgrade",
                "distinct_id": "'"$SHERLOCK_INSTALL_ID"'",
                "properties": {
                    "from_version": "'"$PREVIOUS_VERSION"'",
                    "to_version": "'"$NEXT_PUBLIC_SHERLOCK_VERSION"'"
                }
            }' https://us.i.posthog.com/capture/ ) then
                echo -e "\e[33m[Warning] Failed to send upgrade event.\e[0m"
            fi
        fi
    fi
fi

echo "{\"version\": \"$NEXT_PUBLIC_SHERLOCK_VERSION\", \"install_id\": \"$SHERLOCK_INSTALL_ID\"}" > "$FIRST_RUN_FILE"


# Start the database and wait for it to be ready before starting any other service
if [ "$DATABASE_EMBEDDED" = "true" ]; then
    su postgres -c "postgres -D $DATABASE_DATA_DIR" &
    until pg_isready -h localhost -p 5432 -U postgres; do
        echo -e "\e[34m[Info] Waiting for the database to be ready...\e[0m"
        sleep 1
    done

    # Check if the database already exists, and create it if it dne
    EXISTING_DB=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sherlock'")
    LEGACY_DB=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sourcebot'")

    if [ "$EXISTING_DB" != "1" ] && [ "$LEGACY_DB" = "1" ]; then
        echo -e "\e[34m[Info] Renaming legacy database 'sourcebot' to 'sherlock'...\e[0m"
        psql -U postgres -c "ALTER DATABASE \"sourcebot\" RENAME TO \"sherlock\""
    elif [ "$EXISTING_DB" = "1" ]; then
        echo "Database 'sherlock' already exists; skipping creation."
    else
        echo "Creating database 'sherlock'..."
        psql -U postgres -c "CREATE DATABASE \"sherlock\""
    fi
fi

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
yarn workspace @sherlock/db prisma:migrate:prod

# Create the log directory
mkdir -p /var/log/sherlock

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
