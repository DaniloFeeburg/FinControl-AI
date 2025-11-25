# Stage 1: Build React App
FROM node:20 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final Image with Python and Nginx
FROM python:3.12-slim

# Install Nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Set up Backend
WORKDIR /app
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend /app/backend
COPY entrypoint.sh /app/

# Copy Frontend Build
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy Nginx Config
COPY nginx.conf /etc/nginx/nginx.conf

# Initialize DB (Optional, or run as a separate job/manually)
# It's better to not run this on every container start if it's destructive or slow,
# but our init_db.py uses `create_all` which is safe.
# However, we need to make sure we are in the right directory or path.
# Let's run it in entrypoint or here. For now, let's assume it's run manually or we add it to entrypoint.

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
