#!/bin/bash

# Start Backend in background
uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir /app/backend &

# Start Nginx in foreground
nginx -g "daemon off;"
