#!/bin/bash
set -e

echo "=== FinControl AI Startup ==="

# Initialize database tables
echo "Step 1: Initializing database tables..."
# Isso já estava funcionando, mantemos igual
python -m backend.init_tables
if [ $? -ne 0 ]; then
    echo "ERROR: Database initialization failed"
    exit 1
fi

# Start FastAPI backend in background
echo "Step 2: Starting FastAPI backend on port 8080..."

# --- CORREÇÃO AQUI ---
# Não usamos 'cd'. Rodamos da raiz (/app).
# Chamamos 'backend.main:app' em vez de apenas 'main:app'.
# Isso permite que o Python resolva imports como 'from backend import X' corretamente.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --log-level info &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Step 3: Waiting for backend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Verifica a raiz (/) pois é mais garantido que /categories se não houver dados
    if curl -s -f http://localhost:8080/ > /dev/null 2>&1; then
        echo "✓ Backend is ready and responding!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "ERROR: Backend failed to start after $MAX_ATTEMPTS attempts"
        echo "--- Last backend logs ---"
        # Tenta ler os logs de erro do processo
        cat /proc/$BACKEND_PID/fd/2 2>/dev/null || echo "No stderr logs available"
        exit 1
    fi
    echo "Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

# Start Nginx in foreground
echo "Step 4: Starting Nginx..."
exec nginx -g "daemon off;"
