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
node server.js &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Test backend
echo "🧪 Testing backend..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running at http://localhost:3001"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
VITE_BACKEND_URL=http://localhost:3001/api npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 5

# Test frontend
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is running at http://localhost:5173"
else
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 drawDB with Database Storage is ready!"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:3001"
echo ""
echo "To stop the services, run: pkill -f 'node.*server.js' && pkill -f 'vite'"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait 