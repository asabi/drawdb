#!/bin/bash

echo "🚀 Starting drawDB with Database Storage..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the drawDB root directory"
    exit 1
fi

# Load environment variables (priority: .env > docker.env > defaults)
if [ -f ".env" ]; then
    echo "⚙️ Loading environment from .env"
    set -a && source .env && set +a
elif [ -f "docker.env" ]; then
    echo "⚙️ Loading environment from docker.env"
    set -a && source docker.env && set +a
else
    echo "⚙️ Using default environment configuration"
fi

# Set development-specific paths (override Docker container paths)
export SQLITE_DB_PATH=${SQLITE_DB_PATH:-./server/drawdb.sqlite}
export CONFIG_DB_PATH=${CONFIG_DB_PATH:-./server/config.sqlite}
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}

# Set development defaults for missing variables
export RATE_LIMIT_ENABLED=${RATE_LIMIT_ENABLED:-false}
export RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS:-900000}
export RATE_LIMIT_MAX_REQUESTS=${RATE_LIMIT_MAX_REQUESTS:-100}
export ENCRYPTION_KEY=${ENCRYPTION_KEY:-drawdb-default-key-change-in-production}
export FRONTEND_DEV_PORT=${FRONTEND_DEV_PORT:-5173}

echo "🔧 Development Configuration:"
echo "   Backend Port: ${PORT}"
echo "   Frontend Dev Port: ${FRONTEND_DEV_PORT}"
echo "   SQLite DB: ${SQLITE_DB_PATH}"
echo "   Config DB: ${CONFIG_DB_PATH}"
echo "   Rate Limiting: ${RATE_LIMIT_ENABLED}"

# Kill any existing processes on our ports
echo "🛑 Stopping existing processes..."
pkill -f "node.*server.js" 2>/dev/null
lsof -ti:${PORT} | xargs kill -9 2>/dev/null
lsof -ti:${FRONTEND_DEV_PORT} | xargs kill -9 2>/dev/null

# Create data directories for development if they don't exist
mkdir -p ./server ./data/sqlite ./data/config

# Start backend server
echo "🔧 Starting backend server..."
cd server

# Check if database exists and initialize if needed
DB_PATH=$(basename "$SQLITE_DB_PATH")
if [ ! -f "$DB_PATH" ]; then
    echo "📊 Initializing database at $SQLITE_DB_PATH..."
    npm run init-db
fi

echo "Starting server from $(pwd)..."
echo "Using database: $SQLITE_DB_PATH"
node server.js > /tmp/drawdb-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test backend
echo "🧪 Testing backend..."
if curl -s http://localhost:${PORT}/api/health > /dev/null; then
    echo "✅ Backend is running at http://localhost:${PORT}"
else
    echo "❌ Backend failed to start"
    echo "Backend log:"
    cat /tmp/drawdb-backend.log 2>/dev/null || echo "No log file found"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Get machine IP address
MACHINE_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ -z "$MACHINE_IP" ]; then
    MACHINE_IP="localhost"
fi

echo "🌐 Machine IP: $MACHINE_IP"

# Set frontend environment for API communication
export VITE_BACKEND_URL="http://$MACHINE_IP:${PORT}"

# Start frontend
echo "🎨 Starting frontend..."
echo "Frontend will proxy API calls to: $VITE_BACKEND_URL"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 5

# Test frontend
if curl -s http://localhost:${FRONTEND_DEV_PORT} > /dev/null; then
    echo "✅ Frontend is running at http://localhost:${FRONTEND_DEV_PORT}"
    echo "✅ Frontend is accessible at http://$MACHINE_IP:${FRONTEND_DEV_PORT}"
else
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 drawDB with Database Storage is ready!"
echo "📱 Frontend (Local): http://localhost:${FRONTEND_DEV_PORT}"
echo "📱 Frontend (Network): http://$MACHINE_IP:${FRONTEND_DEV_PORT}"
echo "🔧 Backend (Local): http://localhost:${PORT}"
echo "🔧 Backend (Network): http://$MACHINE_IP:${PORT}"
echo ""
echo "📊 Database Configuration:"
echo "   SQLite: ${SQLITE_DB_PATH}"
echo "   Config: ${CONFIG_DB_PATH}"
echo "   Rate Limiting: ${RATE_LIMIT_ENABLED}"
echo ""
echo "🌐 Access from other machines using: http://$MACHINE_IP:${FRONTEND_DEV_PORT}"
echo ""
echo "To stop the services, run: pkill -f 'node.*server.js' && pkill -f 'vite'"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait 