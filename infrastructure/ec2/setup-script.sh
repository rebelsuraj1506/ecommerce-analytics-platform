#!/bin/bash

# E-Commerce Analytics Platform - EC2 Setup Script
# This script sets up an EC2 instance with Docker and deploys the application

set -e

echo "=================================================="
echo "E-Commerce Analytics Platform - EC2 Setup"
echo "=================================================="

# Update system
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
echo "Installing Docker..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose standalone
echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo "Installing Git..."
sudo apt-get install -y git

# Install Node.js (for potential debugging)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create application directory
echo "Creating application directory..."
mkdir -p /home/ubuntu/ecommerce-analytics-platform
cd /home/ubuntu/ecommerce-analytics-platform

# Clone repository (update with your repo URL)
echo "Cloning repository..."
# git clone https://github.com/yourusername/ecommerce-analytics-platform.git .

# Create environment files
echo "Creating environment files..."

# User Service
cat > services/user-service/.env << 'EOF'
PORT=8001
NODE_ENV=production
DB_HOST=${RDS_MYSQL_ENDPOINT}
DB_PORT=3306
DB_USER=${RDS_MYSQL_USER}
DB_PASSWORD=${RDS_MYSQL_PASSWORD}
DB_NAME=users_db
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=*
EOF

# Product Service
cat > services/product-service/.env << 'EOF'
PORT=8002
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/products_db
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=*
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_NAME=${S3_BUCKET_NAME}
EOF

# Order Service
cat > services/order-service/.env << 'EOF'
PORT=8003
NODE_ENV=production
DB_HOST=${RDS_POSTGRES_ENDPOINT}
DB_PORT=5432
DB_USER=${RDS_POSTGRES_USER}
DB_PASSWORD=${RDS_POSTGRES_PASSWORD}
DB_NAME=orders_db
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=*
USER_SERVICE_URL=http://user-service:8001
PRODUCT_SERVICE_URL=http://product-service:8002
EOF

# Analytics Service
cat > services/analytics-service/.env << 'EOF'
PORT=8004
NODE_ENV=production
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=*
ORDER_SERVICE_URL=http://order-service:8003
PRODUCT_SERVICE_URL=http://product-service:8002
EOF

# API Gateway
cat > services/api-gateway/.env << 'EOF'
PORT=8000
NODE_ENV=production
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=*
USER_SERVICE_URL=http://user-service:8001
PRODUCT_SERVICE_URL=http://product-service:8002
ORDER_SERVICE_URL=http://order-service:8003
ANALYTICS_SERVICE_URL=http://analytics-service:8004
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

echo "Environment files created. Please update them with actual values."

# Create production docker-compose file
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    restart: always
    volumes:
      - mongodb_data:/data/db
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - app-network

  user-service:
    image: ${DOCKER_USERNAME}/user-service:latest
    restart: always
    env_file:
      - ./services/user-service/.env
    depends_on:
      - redis
    networks:
      - app-network

  product-service:
    image: ${DOCKER_USERNAME}/product-service:latest
    restart: always
    env_file:
      - ./services/product-service/.env
    depends_on:
      - mongodb
      - redis
    networks:
      - app-network

  order-service:
    image: ${DOCKER_USERNAME}/order-service:latest
    restart: always
    env_file:
      - ./services/order-service/.env
    depends_on:
      - redis
    networks:
      - app-network

  analytics-service:
    image: ${DOCKER_USERNAME}/analytics-service:latest
    restart: always
    env_file:
      - ./services/analytics-service/.env
    depends_on:
      - redis
    networks:
      - app-network

  api-gateway:
    image: ${DOCKER_USERNAME}/api-gateway:latest
    restart: always
    ports:
      - "8000:8000"
    env_file:
      - ./services/api-gateway/.env
    depends_on:
      - user-service
      - product-service
      - order-service
      - analytics-service
    networks:
      - app-network

  frontend:
    image: ${DOCKER_USERNAME}/frontend:latest
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - api-gateway
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api-gateway
      - frontend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  mongodb_data:
  redis_data:
EOF

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Update environment files with actual RDS endpoints and credentials"
echo "2. Set DOCKER_USERNAME environment variable"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "To check service status:"
echo "  docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
