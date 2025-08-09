#!/bin/bash

# drawDB Docker Rebuild Script
# Rebuilds Docker containers after code changes

set -e  # Exit on any error

echo "🔨 Rebuilding drawDB Docker Environment"
echo "======================================="

# Function to get machine IP for network access info
get_machine_ip() {
    ip route get 1 2>/dev/null | awk '{print $7; exit}' 2>/dev/null || \
    ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1 || \
    hostname -I 2>/dev/null | awk '{print $1}' || \
    echo "localhost"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH"
    echo "Please install Docker Compose and try again"
    exit 1
fi

# Create data directories if they don't exist
echo "📁 Ensuring data directories exist..."
mkdir -p data/sqlite data/config

# Check if .env file exists and show configuration status
if [ -f ".env" ]; then
    echo "⚙️  Using custom environment configuration from .env"
    # Source the .env file to get port configurations
    set -a && source .env && set +a
    if grep -q "RATE_LIMIT_ENABLED=false" .env 2>/dev/null; then
        echo "🚫 Rate limiting is DISABLED"
    else
        echo "🛡️  Rate limiting is ENABLED"
    fi
else
    echo "⚙️  Using default environment configuration (rate limiting enabled)"
    echo "💡 Tip: Copy docker.env to .env to customize settings"
    # Set defaults if no .env file
    FRONTEND_PORT=80
    BACKEND_PORT=3001
fi

# Show port configuration
echo "🌐 Port Configuration:"
echo "   Frontend: ${FRONTEND_PORT:-80}"
echo "   Backend: ${BACKEND_PORT:-3001}"

# Stop existing containers if running
echo "🛑 Stopping existing containers..."
if docker compose version &> /dev/null; then
    # Use newer docker compose (v2)
    docker compose down --remove-orphans 2>/dev/null || true
else
    # Fall back to docker-compose (v1)
    docker-compose down --remove-orphans 2>/dev/null || true
fi

# Remove existing images (optional - can be controlled by parameter)
FORCE_REBUILD=${1:-false}
if [ "$FORCE_REBUILD" = "--force" ] || [ "$FORCE_REBUILD" = "-f" ]; then
    echo "🗑️  Removing existing images for complete rebuild..."
    docker rmi drawdb-backend drawdb-frontend 2>/dev/null || true
    echo "🧹 Cleaning up unused Docker resources..."
    docker system prune -f
fi

# Build and start containers
echo "🔧 Building containers with latest code..."
if docker compose version &> /dev/null; then
    # Use newer docker compose (v2)
    docker compose build --no-cache
    docker compose up -d
else
    # Fall back to docker-compose (v1)
    docker-compose build --no-cache
    docker-compose up -d
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check backend
BACKEND_HEALTH=$(curl -s http://localhost:${BACKEND_PORT:-3001}/api/health 2>/dev/null || echo "failed")
if echo "$BACKEND_HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ Backend is healthy at http://localhost:${BACKEND_PORT:-3001}"
else
    echo "❌ Backend health check failed"
    echo "Backend response: $BACKEND_HEALTH"
    echo "📋 Backend logs:"
    if docker compose version &> /dev/null; then
        docker compose logs backend --tail=10
    else
        docker-compose logs backend --tail=10
    fi
fi

# Check frontend
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT:-80} 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✅ Frontend is healthy at http://localhost:${FRONTEND_PORT:-80}"
else
    echo "❌ Frontend health check failed (HTTP $FRONTEND_HEALTH)"
    echo "📋 Frontend logs:"
    if docker compose version &> /dev/null; then
        docker compose logs frontend --tail=10
    else
        docker-compose logs frontend --tail=10
    fi
fi

# Get machine IP
MACHINE_IP=$(get_machine_ip)

echo ""
echo "🎉 drawDB rebuild complete!"
echo "📱 Frontend (Local): http://localhost:${FRONTEND_PORT:-80}"
echo "📱 Frontend (Network): http://$MACHINE_IP:${FRONTEND_PORT:-80}"
echo "🔧 Backend (Local): http://localhost:${BACKEND_PORT:-3001}"
echo "🔧 Backend (Network): http://$MACHINE_IP:${BACKEND_PORT:-3001}"
echo ""
echo "💾 Database files are stored in: $(pwd)/data/sqlite/"
echo "⚙️  Configuration files are stored in: $(pwd)/data/config/"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop: ./docker-stop.sh"
echo "   Restart: ./docker-restart.sh"
echo "   Force rebuild: ./docker-rebuild.sh --force"
