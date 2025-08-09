#!/bin/bash

echo "🧪 Testing Rate Limiting Configuration"
echo "======================================"

# Check if backend is running
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Backend is not running. Please start drawDB first."
    echo "Run: ./docker-start.sh"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Test current rate limiting status
echo "📊 Current Rate Limiting Status:"
echo "--------------------------------"

# Make a few test requests to see rate limit headers
echo "Making test requests to check rate limit headers..."
for i in {1..3}; do
    echo "Request $i:"
    curl -s -I http://localhost:3001/api/health | grep -i "rate\|limit" || echo "  No rate limit headers found"
    sleep 1
done

echo ""
echo "🔍 Rate Limiting Test Results:"
echo "- If you see 'X-RateLimit-*' headers, rate limiting is ENABLED"
echo "- If no rate limit headers are shown, rate limiting is DISABLED"
echo ""
echo "💡 To disable rate limiting:"
echo "   1. Copy docker.env to .env: cp docker.env .env"
echo "   2. Edit .env and set: RATE_LIMIT_ENABLED=false"
echo "   3. Restart containers: ./docker-restart.sh"
echo ""
echo "💡 To enable rate limiting:"
echo "   1. Edit .env and set: RATE_LIMIT_ENABLED=true"
echo "   2. Restart containers: ./docker-restart.sh"
