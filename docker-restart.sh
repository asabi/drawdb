#!/bin/bash

echo "🔄 Restarting drawDB Docker containers..."

# Stop containers
./docker-stop.sh

echo ""
echo "⏳ Waiting 3 seconds..."
sleep 3

# Start containers
./docker-start.sh
