#!/bin/bash
set -e

echo "=== FinControl AI Startup ==="

# Step 1: Inicializar tabelas do banco
echo "Step 1: Initializing database tables..."
# Define ENVIRONMENT=dev se nao estiver definido, para garantir o comportamento desejado na demo,
# mas em producao deve ser 'prod'.
# O usuario nao especificou como definir a var, entao vou deixar o padrao do sistema.
python -m backend.init_tables
if [ $? -ne 0 ]; then
    echo "ERROR: Database initialization failed"
    exit 1
fi

# Step 2: subir FastAPI / uvicorn na porta 8000 (porta interna)
echo "Step 2: Starting FastAPI backend on port 8000..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level info &
BACKEND_PID=$!

# Step 3: esperar backend ficar pronto
echo "Step 3: Waiting for backend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Usa o OpenAPI, que sempre retorna 200 quando o app está de pé
    if curl -s -f http://127.0.0.1:8000/openapi.json > /dev/null 2>&1; then
        echo "✓ Backend is ready and responding!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "ERROR: Backend failed to start after $MAX_ATTEMPTS attempts"
        echo "--- Last backend logs ---"
        cat /proc/$BACKEND_PID/fd/2 2>/dev/null || echo "No stderr logs available"
        exit 1
    fi

    echo "Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

# Step 4: subir Nginx em primeiro plano (porta 8080)
echo "Step 4: Starting Nginx..."
exec nginx -g "daemon off;"
