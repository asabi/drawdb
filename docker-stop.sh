#!/bin/bash

echo "🛑 Stopping drawDB Docker containers..."

# Stop and remove containers
if docker compose version &> /dev/null; then
    # Use newer docker compose (v2)
    docker compose down
else
    # Use older docker-compose (v1)
    docker-compose down
fi

echo "✅ drawDB containers stopped"
echo ""
echo "💾 Your data is preserved in: $(pwd)/data/"
echo "To start again, run: ./docker-start.sh"
