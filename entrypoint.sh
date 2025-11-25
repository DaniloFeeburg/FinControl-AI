#!/bin/bash
set -e

echo "=== FinControl AI Startup ==="

# Initialize database tables
echo "Step 1: Initializing database tables..."
python -m backend.init_tables
if [ $? -ne 0 ]; then
    echo "ERROR: Database initialization failed"
    exit 1
fi

# Start FastAPI backend in background
echo "Step 2: Starting FastAPI backend on port 8080..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --log-level info &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Step 3: Waiting for backend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -f http://localhost:8080/categories > /dev/null 2>&1; then
        echo "✓ Backend is ready and responding!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "ERROR: Backend failed to start after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    echo "Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 1
done

# Start Nginx in foreground
echo "Step 4: Starting Nginx..."
exec nginx -g "daemon off;"
