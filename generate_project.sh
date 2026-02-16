#!/bin/bash

echo "========================================="
echo "Generating E-Commerce Analytics Platform"
echo "========================================="

# Copy shared utilities to all services
for service in product-service order-service analytics-service api-gateway; do
  echo "Creating utilities for $service..."
  
  # Logger
  cp services/user-service/src/utils/logger.js services/$service/src/utils/
  
  # Redis config
  cp services/user-service/src/config/redis.js services/$service/src/config/
  
  # Middleware
  cp services/user-service/src/middleware/errorHandler.js services/$service/src/middleware/
  cp services/user-service/src/middleware/requestLogger.js services/$service/src/middleware/
  
  # Dockerfile
  cp services/user-service/Dockerfile services/$service/
  
done

echo "✓ Shared utilities copied to all services"

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.sw

p
*.swn
*.swo

# Build outputs
dist/
build/
.next/
out/

# Docker
.docker/

# AWS
.aws/

# Terraform
*.tfstate
*.tfstate.backup
.terraform/

# Test coverage
coverage/
.nyc_output/
EOF

echo "✓ .gitignore created"

echo ""
echo "========================================="
echo "Project Structure Created Successfully!"
echo "========================================="
echo ""
echo "Services created:"
echo "  ✓ User Service (MySQL + JWT Auth)"
echo "  ✓ Product Service (MongoDB + Redis Cache)"
echo "  ✓ Order Service (PostgreSQL + Transactions)"
echo "  ✓ Analytics Service (Redis + Real-time)"
echo "  ✓ API Gateway (Rate Limiting)"
echo ""
echo "Infrastructure:"
echo "  ✓ Docker Compose (Local Development)"
echo "  ✓ Individual Dockerfiles"
echo "  ✓ Shared Utilities"
echo ""

