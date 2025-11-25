#!/bin/bash

# Initialize the database
python -m backend.init_db

# Start Backend in background
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &

# Start Nginx in foreground
nginx -g "daemon off;"
