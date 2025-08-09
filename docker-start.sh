#!/bin/bash

echo "🐳 Starting drawDB with Docker..."

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create local data directories if they don't exist
echo "📁 Creating local data directories..."
mkdir -p ./data/sqlite
mkdir -p ./data/config

# Set appropriate permissions
chmod 755 ./data/sqlite ./data/config

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Check if data directory is empty and show info
if [ ! -f "./data/sqlite/drawdb.sqlite" ]; then
    echo "📊 First run detected - SQLite database will be initialized"
else
    echo "📊 Using existing SQLite database at ./data/sqlite/drawdb.sqlite"
fi

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

# Show volume configuration
echo "💾 Volume Configuration:"
echo "   Data: ${HOST_DATA_DIR:-./data/sqlite} → ${CONTAINER_DATA_DIR:-/app/data}"
echo "   Config: ${HOST_CONFIG_DIR:-./data/config} → ${CONTAINER_CONFIG_DIR:-/app/config}"

# Build and start containers
echo "🔧 Building and starting containers..."
if docker compose version &> /dev/null; then
    # Use newer docker compose (v2)
    docker compose up --build -d
else
    # Use older docker-compose (v1)
    docker-compose up --build -d
fi

# Wait for services to be healthy
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
fi

# Check frontend
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT:-80} 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✅ Frontend is healthy at http://localhost:${FRONTEND_PORT:-80}"
else
    echo "❌ Frontend health check failed (HTTP $FRONTEND_HEALTH)"
fi

# Get machine IP
MACHINE_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' 2>/dev/null || \
            ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1 || \
            hostname -I 2>/dev/null | awk '{print $1}' || \
            echo "localhost")

echo ""
echo "🎉 drawDB is running with Docker!"
echo "📱 Frontend (Local): http://localhost:${FRONTEND_PORT:-80}"
echo "📱 Frontend (Network): http://$MACHINE_IP:${FRONTEND_PORT:-80}"
echo "🔧 Backend (Local): http://localhost:${BACKEND_PORT:-3001}"
echo "🔧 Backend (Network): http://$MACHINE_IP:${BACKEND_PORT:-3001}"
echo ""
echo "💾 Database files are stored in: $(pwd)/data/sqlite/"
echo "⚙️  Configuration files are stored in: $(pwd)/data/config/"
echo ""
echo "To stop the services, run: ./docker-stop.sh"
echo "To view logs, run: docker-compose logs -f"
echo "To restart, run: ./docker-restart.sh"
