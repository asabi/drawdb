#!/bin/bash

echo "🚀 Starting drawDB with Database Storage..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the drawDB root directory"
    exit 1
fi

# Kill any existing processes on our ports
echo "🛑 Stopping existing processes..."
pkill -f "node.*server.js" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start backend server
echo "🔧 Starting backend server..."
cd server
if [ ! -f "drawdb.sqlite" ]; then
    echo "📊 Initializing database..."
    npm run init-db
fi
echo "Starting server from $(pwd)..."
node server.js > /tmp/drawdb-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test backend
echo "🧪 Testing backend..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running at http://localhost:3001"
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

# Start frontend
echo "🎨 Starting frontend..."
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 5

# Test frontend
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is running at http://localhost:5173"
    echo "✅ Frontend is accessible at http://$MACHINE_IP:5173"
else
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 drawDB with Database Storage is ready!"
echo "📱 Frontend (Local): http://localhost:5173"
echo "📱 Frontend (Network): http://$MACHINE_IP:5173"
echo "🔧 Backend (Local): http://localhost:3001"
echo "🔧 Backend (Network): http://$MACHINE_IP:3001"
echo ""
echo "🌐 Access from other machines using: http://$MACHINE_IP:5173"
echo ""
echo "To stop the services, run: pkill -f 'node.*server.js' && pkill -f 'vite'"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait 