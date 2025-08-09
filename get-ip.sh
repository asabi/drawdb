#!/bin/bash

echo "🌐 Your machine's IP addresses:"
echo ""

# Get all IP addresses
ifconfig | grep "inet " | grep -v 127.0.0.1 | while read line; do
    IP=$(echo $line | awk '{print $2}')
    INTERFACE=$(echo $line | awk '{print $1}' | sed 's/://')
    echo "📡 $INTERFACE: $IP"
done

echo ""
# Load environment for port configuration
if [ -f ".env" ]; then
    source .env
elif [ -f "docker.env" ]; then
    source docker.env
fi

FRONTEND_DEV_PORT=${FRONTEND_DEV_PORT:-5173}

echo "💡 Use any of these IPs to access drawDB from other machines:"
echo "   http://[IP]:${FRONTEND_DEV_PORT}"
echo ""
BACKEND_PORT=${PORT:-3001}
echo "🔧 Backend API: http://[IP]:${BACKEND_PORT}/api/health" 