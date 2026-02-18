#!/bin/bash

# E-commerce Order Service Database Fix Script
# This script fixes the "user_order_number" column error

echo "🔧 E-commerce Database Fix Script"
echo "=================================="
echo ""

# Stop all containers
echo "📦 Step 1: Stopping all containers..."
docker-compose down
echo "✅ Containers stopped"
echo ""

# Clean up the database volume to force schema recreation
echo "🗑️  Step 2: Cleaning database volumes (this will reset your data)..."
read -p "⚠️  WARNING: This will delete all existing orders. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. No changes made."
    exit 1
fi

docker volume rm ecommerce-modified_postgres_data 2>/dev/null || echo "Volume doesn't exist or already removed"
echo "✅ Database volume cleaned"
echo ""

# Rebuild the order-service with fixed code
echo "🔨 Step 3: Rebuilding order-service..."
docker-compose build --no-cache order-service
echo "✅ Order service rebuilt"
echo ""

# Start all services
echo "🚀 Step 4: Starting all services..."
docker-compose up -d
echo "✅ Services starting..."
echo ""

# Wait for services to initialize
echo "⏳ Step 5: Waiting for services to initialize (60 seconds)..."
sleep 60
echo ""

# Check service health
echo "🏥 Step 6: Checking service health..."
echo ""

echo "Checking PostgreSQL..."
docker-compose exec -T postgres pg_isready -U postgres
if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi
echo ""

echo "Checking Order Service..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8003/health)
if [ "$response" = "200" ]; then
    echo "✅ Order Service is healthy (HTTP $response)"
else
    echo "❌ Order Service is not responding (HTTP $response)"
    echo "Checking logs..."
    docker-compose logs --tail=20 order-service
fi
echo ""

echo "Checking API Gateway..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$response" = "200" ]; then
    echo "✅ API Gateway is healthy (HTTP $response)"
else
    echo "❌ API Gateway is not responding (HTTP $response)"
fi
echo ""

echo "Checking Frontend..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$response" = "200" ]; then
    echo "✅ Frontend is running (HTTP $response)"
else
    echo "❌ Frontend is not responding (HTTP $response)"
fi
echo ""

echo "=================================="
echo "🎉 Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Log in and test the order functionality"
echo "3. If you see errors, check logs with: docker-compose logs -f order-service"
echo ""
echo "To view all logs: docker-compose logs -f"
echo "=================================="