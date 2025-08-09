#!/bin/bash

# drawDB Docker Quick Rebuild Script
# Quickly rebuilds and restarts containers (faster for minor code changes)

set -e  # Exit on any error

echo "⚡ Quick Rebuild of drawDB Docker Environment"
echo "============================================="

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH"
    echo "Please install Docker Compose and try again"
    exit 1
fi

# Get port configuration from env files
if [ -f ".env" ]; then
    set -a && source .env && set +a
    echo "⚙️  Using custom environment configuration"
else
    echo "⚙️  Using default environment configuration"
    FRONTEND_PORT=80
    BACKEND_PORT=3001
fi

echo "🌐 Ports: Frontend:${FRONTEND_PORT:-80}, Backend:${BACKEND_PORT:-3001}"

# Quick rebuild and restart
echo "🔧 Quick rebuild and restart..."
if docker compose version &> /dev/null; then
    # Use newer docker compose (v2)
    docker compose build
    docker compose up -d --force-recreate
else
    # Fall back to docker-compose (v1)
    docker-compose build
    docker-compose up -d --force-recreate
fi

# Brief wait and health check
echo "⏳ Waiting for services..."
sleep 5

# Quick health check
BACKEND_HEALTH=$(curl -s http://localhost:${BACKEND_PORT:-3001}/api/health 2>/dev/null || echo "failed")
if echo "$BACKEND_HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ Backend: OK"
else
    echo "⚠️  Backend: Check logs"
fi

FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT:-80} 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✅ Frontend: OK"
else
    echo "⚠️  Frontend: Starting up..."
fi

echo ""
echo "🎉 Quick rebuild complete!"
echo "📱 Access at: http://localhost:${FRONTEND_PORT:-80}"
echo ""
echo "💡 For full rebuild with cleanup: ./docker-rebuild.sh --force"
