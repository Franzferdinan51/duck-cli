#!/bin/bash
cd ~/.openclaw/workspace/duck-cli-src
node dist/agent/chat-agent.js &
PID=$!
sleep 2
echo "=== Test 1: Simple chat ==="
curl -s -X POST http://localhost:18797/chat -H "Content-Type: application/json" -d '{"userId":"duck","message":"hello"}'
echo ""
echo "=== Test 2: High-stakes (crypto) - should trigger council ==="
curl -s -X POST http://localhost:18797/chat -H "Content-Type: application/json" -d '{"userId":"duck","message":"should I invest in bitcoin?"}'
echo ""
echo "=== Test 3: Complex task - should route to MetaAgent ==="
curl -s -X POST http://localhost:18797/chat -H "Content-Type: application/json" -d '{"userId":"duck","message":"build me a full REST API with authentication and database"}'
echo ""
kill $PID 2>/dev/null
