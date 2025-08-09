#!/bin/sh
set -e

# Set container directory defaults
export CONTAINER_DATA_DIR=${CONTAINER_DATA_DIR:-/app/data}
export CONTAINER_CONFIG_DIR=${CONTAINER_CONFIG_DIR:-/app/config}

# Create necessary directories for volume mounts
mkdir -p "$CONTAINER_DATA_DIR"
mkdir -p "$CONTAINER_CONFIG_DIR"

# Set database paths based on container directories
export SQLITE_DB_PATH=${SQLITE_DB_PATH:-$CONTAINER_DATA_DIR/drawdb.sqlite}
export CONFIG_DB_PATH=${CONFIG_DB_PATH:-$CONTAINER_CONFIG_DIR/config.sqlite}

echo "Environment configuration:"
echo "SQLite Database: $SQLITE_DB_PATH"
echo "Config Database: $CONFIG_DB_PATH"

# Initialize database if it doesn't exist
if [ ! -f "$SQLITE_DB_PATH" ]; then
    echo "Initializing SQLite database at $SQLITE_DB_PATH..."
    node init-db.js
fi

# If config database doesn't exist or if we're using a new path, ensure it gets created
if [ ! -f "$CONFIG_DB_PATH" ]; then
    echo "Config database will be initialized at $CONFIG_DB_PATH"
fi

# Start the application
echo "Starting drawDB backend server..."

exec "$@"
