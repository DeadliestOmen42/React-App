#!/bin/bash
# AI Music Studio - Server Startup Script

echo "🎵 AI Music Studio - Starting Servers"
echo "======================================"

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node.*index\.cjs" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
echo ""
echo "Starting backend server..."
cd /workspaces/React-App/server
node index.cjs > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✓ Backend started successfully"
    # Show backend logs
    tail -5 /tmp/backend.log
else
    echo "✗ Backend failed to start. Check /tmp/backend.log"
    cat /tmp/backend.log
    exit 1
fi

# Start frontend
echo ""
echo "Starting frontend server..."
cd /workspaces/React-App
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✓ Frontend started successfully"
    # Show frontend logs
    tail -5 /tmp/frontend.log
else
    echo "✗ Frontend failed to start. Check /tmp/frontend.log"
    cat /tmp/frontend.log
    exit 1
fi

echo ""
echo "======================================"
echo "✓ All servers running!"
echo "======================================"
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop servers: pkill -f 'node.*index.cjs'; pkill -f vite"
echo "======================================"
