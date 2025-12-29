#!/bin/bash
set -e

echo "=== FinControl AI Startup ==="
echo "Environment: ${ENVIRONMENT:-production}"
echo "Checking critical environment variables..."

# Verify critical environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set!"
    echo "Please configure the DATABASE_URL secret in Google Cloud."
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY environment variable is not set!"
    echo "Please configure the SECRET_KEY secret in Google Cloud."
    exit 1
fi

echo "✓ Critical environment variables are set"

# Step 1: Inicializar tabelas do banco
echo ""
echo "Step 1: Initializing database tables..."
if ! python -m backend.init_tables; then
    echo "ERROR: Database initialization failed"
    echo "Please check:"
    echo "  1. DATABASE_URL is correct and accessible"
    echo "  2. Database server is running and reachable"
    echo "  3. Database credentials are valid"
    exit 1
fi
echo "✓ Database initialization completed successfully"

# Step 2: subir FastAPI / uvicorn na porta 8000 (porta interna)
echo ""
echo "Step 2: Starting FastAPI backend on port 8000..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level info &
BACKEND_PID=$!

# Verify that the process started
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: FastAPI backend process failed to start or crashed immediately"
    echo "Process ID was: $BACKEND_PID"
    exit 1
fi

echo "✓ FastAPI backend process started (PID: $BACKEND_PID)"

# Step 3: esperar backend ficar pronto
echo ""
echo "Step 3: Waiting for backend to be ready..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Check if process is still alive
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend process died unexpectedly during startup"
        echo "This usually means there's an error in the application code or imports"
        exit 1
    fi

    # Check if backend is responding
    if curl -s -f http://127.0.0.1:8000/openapi.json > /dev/null 2>&1; then
        echo "✓ Backend is ready and responding!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "ERROR: Backend failed to start after $MAX_ATTEMPTS attempts (${MAX_ATTEMPTS}*2 = $((MAX_ATTEMPTS*2)) seconds)"
        echo ""
        echo "Possible issues:"
        echo "  1. Application is taking too long to initialize"
        echo "  2. There's an error in the application startup"
        echo "  3. Port 8000 is already in use"
        echo "  4. Database connection is slow or failing"
        echo ""
        echo "Backend process status:"
        if kill -0 $BACKEND_PID 2>/dev/null; then
            echo "  - Process is still running (PID: $BACKEND_PID)"
        else
            echo "  - Process has died"
        fi
        exit 1
    fi

    if [ $((ATTEMPT % 10)) -eq 0 ]; then
        echo "Still waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS, ${ATTEMPT}*2 = $((ATTEMPT*2))s elapsed)"
    fi
    sleep 2
done

# Step 4: subir Nginx em primeiro plano (porta 8080)
echo ""
echo "Step 4: Starting Nginx on port 8080..."
echo "Container is ready to receive requests!"

# Trap to handle graceful shutdown
trap 'echo "Shutting down..."; kill $BACKEND_PID 2>/dev/null; exit 0' SIGTERM SIGINT

exec nginx -g "daemon off;"
