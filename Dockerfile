# Stage 1: Build React App
FROM node:20 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final Image with Python and Nginx
FROM python:3.12-slim

# Install Nginx and curl (for healthcheck)
RUN apt-get update && \
    apt-get install -y nginx curl procps && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend files
COPY backend /app/backend

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy frontend build from stage 1
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Health check - increased start-period to allow for database initialization
# Check /api/ endpoint to verify backend is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/api/ || exit 1

# Start services via entrypoint
CMD ["/app/entrypoint.sh"]
