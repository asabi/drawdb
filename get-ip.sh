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
echo "💡 Use any of these IPs to access drawDB from other machines:"
echo "   http://[IP]:5173"
echo ""
echo "🔧 Backend API: http://[IP]:3001/api/health" 