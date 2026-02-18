#!/bin/bash

# E-Commerce Platform Diagnostic Script
# This script checks the health of all services and identifies issues

set -e

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}E-Commerce Platform Diagnostics${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}\n"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker installation
echo -e "${BOLD}1. Checking Docker Installation...${NC}"
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker installed: $DOCKER_VERSION${NC}"
else
    echo -e "${RED}✗ Docker not found. Please install Docker.${NC}"
    exit 1
fi

if command_exists docker-compose; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose installed: $COMPOSE_VERSION${NC}"
else
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

echo ""

# Check if Docker daemon is running
echo -e "${BOLD}2. Checking Docker Daemon...${NC}"
if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
else
    echo -e "${RED}✗ Docker daemon is not running. Please start Docker.${NC}"
    exit 1
fi

echo ""

# Check container status
echo -e "${BOLD}3. Checking Container Status...${NC}"
CONTAINERS=(
    "user-service:8001"
    "product-service:8002"
    "order-service:8003"
    "analytics-service:8004"
    "api-gateway:8000"
    "ecommerce-mysql:3307"
    "ecommerce-postgres:5432"
    "ecommerce-mongodb:27017"
    "ecommerce-redis:6379"
    "frontend:3000"
)

ALL_RUNNING=true

for container_info in "${CONTAINERS[@]}"; do
    IFS=':' read -r container port <<< "$container_info"
    
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
        if [ "$STATUS" = "running" ]; then
            echo -e "${GREEN}✓ $container is running${NC}"
        else
            echo -e "${RED}✗ $container status: $STATUS${NC}"
            ALL_RUNNING=false
        fi
    else
        echo -e "${RED}✗ $container is not running${NC}"
        ALL_RUNNING=false
    fi
done

echo ""

# Check port availability
echo -e "${BOLD}4. Checking Port Availability...${NC}"
PORTS=(8001 8002 8003 8004 8000 3307 5432 27017 6379 3000)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Port $port is listening${NC}"
    else
        echo -e "${YELLOW}⚠ Port $port is NOT listening${NC}"
    fi
done

echo ""

# Check container logs for errors
echo -e "${BOLD}5. Checking User Service Logs (last 20 lines)...${NC}"
if docker ps --format '{{.Names}}' | grep -q "^user-service$"; then
    echo -e "${BLUE}--- User Service Logs ---${NC}"
    docker logs user-service --tail 20 2>&1 | sed 's/^/  /'
else
    echo -e "${RED}✗ user-service container not found${NC}"
fi

echo ""

# Test database connectivity
echo -e "${BOLD}6. Testing Database Connectivity...${NC}"

# MySQL
if docker ps --format '{{.Names}}' | grep -q "^ecommerce-mysql$"; then
    if docker exec ecommerce-mysql mysqladmin ping -h localhost -u root -prootpassword >/dev/null 2>&1; then
        echo -e "${GREEN}✓ MySQL is responsive${NC}"
    else
        echo -e "${RED}✗ MySQL is not responsive${NC}"
    fi
else
    echo -e "${RED}✗ MySQL container not found${NC}"
fi

# PostgreSQL
if docker ps --format '{{.Names}}' | grep -q "^ecommerce-postgres$"; then
    if docker exec ecommerce-postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is responsive${NC}"
    else
        echo -e "${RED}✗ PostgreSQL is not responsive${NC}"
    fi
else
    echo -e "${RED}✗ PostgreSQL container not found${NC}"
fi

# MongoDB
if docker ps --format '{{.Names}}' | grep -q "^ecommerce-mongodb$"; then
    if docker exec ecommerce-mongodb mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
        echo -e "${GREEN}✓ MongoDB is responsive${NC}"
    else
        echo -e "${RED}✗ MongoDB is not responsive${NC}"
    fi
else
    echo -e "${RED}✗ MongoDB container not found${NC}"
fi

# Redis
if docker ps --format '{{.Names}}' | grep -q "^ecommerce-redis$"; then
    if docker exec ecommerce-redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is responsive${NC}"
    else
        echo -e "${RED}✗ Redis is not responsive${NC}"
    fi
else
    echo -e "${RED}✗ Redis container not found${NC}"
fi

echo ""

# Test service health endpoints
echo -e "${BOLD}7. Testing Service Health Endpoints...${NC}"

test_endpoint() {
    local name=$1
    local url=$2
    
    if curl -sf "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ $name is not responding${NC}"
        return 1
    fi
}

test_endpoint "User Service" "http://localhost:8001/health"
test_endpoint "Product Service" "http://localhost:8002/health"
test_endpoint "Order Service" "http://localhost:8003/health"
test_endpoint "Analytics Service" "http://localhost:8004/health"
test_endpoint "API Gateway" "http://localhost:8000/health"

echo ""

# Network check
echo -e "${BOLD}8. Checking Docker Network...${NC}"
NETWORK_NAME="ecommerce-analytics-platform-enhanced_ecommerce-network"

if docker network ls --format '{{.Name}}' | grep -q "$NETWORK_NAME"; then
    echo -e "${GREEN}✓ Network exists: $NETWORK_NAME${NC}"
    
    # Check if user-service is connected to the network
    if docker network inspect "$NETWORK_NAME" --format='{{range .Containers}}{{.Name}} {{end}}' | grep -q "user-service"; then
        echo -e "${GREEN}✓ user-service is connected to network${NC}"
    else
        echo -e "${RED}✗ user-service is NOT connected to network${NC}"
    fi
else
    echo -e "${RED}✗ Network not found: $NETWORK_NAME${NC}"
fi

echo ""

# Resource usage
echo -e "${BOLD}9. Checking Resource Usage...${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -n 12

echo ""

# Summary and recommendations
echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Summary & Recommendations${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}\n"

if [ "$ALL_RUNNING" = true ]; then
    echo -e "${GREEN}✓ All containers are running${NC}"
else
    echo -e "${RED}✗ Some containers are not running${NC}"
    echo -e "${YELLOW}Recommendation: Run 'docker-compose up -d' to start all services${NC}"
fi

# Check if user-service is accessible
if curl -sf http://localhost:8001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ User service is accessible on port 8001${NC}"
    echo -e "${GREEN}✓ You can now register users${NC}"
    echo ""
    echo -e "${BOLD}Try this command:${NC}"
    echo 'curl -X POST http://localhost:8001/api/auth/register \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -d '"'"'{"name":"Suraj Anand","email":"suraj@gmail.com","password":"Suraj@123","role":"admin"}'"'"
else
    echo -e "${RED}✗ User service is NOT accessible on port 8001${NC}"
    echo ""
    echo -e "${BOLD}${YELLOW}Troubleshooting Steps:${NC}"
    echo ""
    echo -e "${BOLD}Step 1:${NC} Check user-service logs for errors"
    echo "  docker logs user-service --tail 50"
    echo ""
    echo -e "${BOLD}Step 2:${NC} Check if MySQL is ready"
    echo "  docker exec ecommerce-mysql mysqladmin ping -h localhost -u root -prootpassword"
    echo ""
    echo -e "${BOLD}Step 3:${NC} Restart user-service"
    echo "  docker-compose restart user-service"
    echo "  sleep 10"
    echo "  curl http://localhost:8001/health"
    echo ""
    echo -e "${BOLD}Step 4:${NC} If still failing, rebuild user-service"
    echo "  docker-compose down"
    echo "  docker-compose up -d --build user-service"
    echo "  docker logs -f user-service"
    echo ""
fi

echo ""
echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}For detailed troubleshooting, see:${NC}"
echo -e "TROUBLESHOOTING_GUIDE.md"
echo -e "${BOLD}${BLUE}========================================${NC}"