#!/bin/bash

# Final Fix for order-service - Add node-cron

set -e

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Final Fix: Adding node-cron${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}\n"

PROJECT_DIR="$HOME/Downloads/AWS/ecommerce-analytics-platform-enhanced"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Project directory not found at: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

echo -e "${BOLD}Step 1: Checking current dependencies...${NC}"
echo -e "${BLUE}Current dependencies in order-service:${NC}\n"
grep -A 15 '"dependencies"' services/order-service/package.json | sed 's/^/  /'

echo ""

# Check if node-cron is there
if grep -q '"node-cron"' services/order-service/package.json; then
    echo -e "${GREEN}✓ node-cron already present${NC}\n"
else
    echo -e "${YELLOW}⚠ node-cron missing, adding it...${NC}"
    
    # Backup
    cp services/order-service/package.json services/order-service/package.json.backup2
    
    # Add node-cron after mongoose
    sed -i.tmp 's|"mongoose": "^8.0.3",|"mongoose": "^8.0.3",\n    "node-cron": "^3.0.3",|' services/order-service/package.json 2>/dev/null || \
    sed -i '' 's|"mongoose": "^8.0.3",|"mongoose": "^8.0.3",\n    "node-cron": "^3.0.3",|' services/order-service/package.json
    
    echo -e "${GREEN}✓ Added node-cron${NC}\n"
fi

echo -e "${BOLD}Step 2: Verifying all required dependencies...${NC}"

REQUIRED_DEPS=("express" "axios" "jsonwebtoken" "mongoose" "node-cron" "pg")
MISSING=()

for dep in "${REQUIRED_DEPS[@]}"; do
    if grep -q "\"$dep\"" services/order-service/package.json; then
        echo -e "${GREEN}✓ $dep${NC}"
    else
        echo -e "${RED}✗ $dep - MISSING${NC}"
        MISSING+=("$dep")
    fi
done

echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${RED}Still missing dependencies: ${MISSING[*]}${NC}"
    echo -e "${YELLOW}Please add them manually to package.json${NC}\n"
fi

echo -e "${BOLD}Step 3: Updated dependencies:${NC}\n"
grep -A 15 '"dependencies"' services/order-service/package.json | sed 's/^/  /'

echo ""
echo -e "${BOLD}Step 4: Rebuilding order-service...${NC}"
docker-compose build order-service

echo -e "${GREEN}✓ Build complete${NC}\n"

echo -e "${BOLD}Step 5: Restarting order-service...${NC}"
docker-compose up -d order-service

echo -e "${GREEN}✓ Service restarted${NC}\n"

echo -e "${BOLD}Step 6: Waiting for initialization (30 seconds)...${NC}"
for i in {30..1}; do
    printf "\r${BLUE}   %2d seconds remaining...${NC}" "$i"
    sleep 1
done
echo -e "\n"

echo -e "${BOLD}Step 7: Checking logs...${NC}\n"
docker logs order-service --tail 20 2>&1 | sed 's/^/  /'

echo ""
echo -e "${BOLD}Step 8: Testing health endpoint...${NC}"

if curl -sf http://localhost:8003/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Order service is healthy!${NC}\n"
    
    HEALTH=$(curl -s http://localhost:8003/health)
    echo -e "${BLUE}Health response:${NC}"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo -e "${YELLOW}⚠ Service not responding yet${NC}"
    echo -e "${BLUE}This might be normal - services can take up to 60 seconds to fully initialize${NC}"
    echo ""
    echo -e "${BOLD}Try waiting a bit longer and run:${NC}"
    echo -e "  ${YELLOW}curl http://localhost:8003/health${NC}"
    echo ""
    echo -e "${BOLD}Or check the logs:${NC}"
    echo -e "  ${YELLOW}docker logs order-service${NC}"
fi

echo ""
echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${GREEN}All Fixes Applied!${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}\n"

echo -e "${BOLD}Final Status of All Services:${NC}\n"

check_service() {
    local name=$1
    local port=$2
    local padding=$3
    
    if curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ $name${padding}(port $port)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ $name${padding}(port $port)${NC}"
        return 1
    fi
}

check_service "User Service    " "8001" " "
check_service "Product Service " "8002" " "
check_service "Order Service   " "8003" " "
check_service "Analytics Service" "8004" ""
check_service "API Gateway     " "8000" " "

echo ""

# Final test
HEALTHY_COUNT=0
for port in 8001 8002 8003 8004 8000; do
    if curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then
        ((HEALTHY_COUNT++))
    fi
done

if [ $HEALTHY_COUNT -eq 5 ]; then
    echo -e "${GREEN}${BOLD}🎉 SUCCESS! All 5 services are healthy!${NC}\n"
    
    echo -e "${BOLD}You can now test your registration:${NC}\n"
    echo -e "${YELLOW}curl -X POST http://localhost:8001/api/auth/register \\${NC}"
    echo -e "${YELLOW}  -H \"Content-Type: application/json\" \\${NC}"
    echo -e "${YELLOW}  -d '{\"name\":\"Suraj Anand\",\"email\":\"suraj@gmail.com\",\"password\":\"Suraj@123\",\"role\":\"admin\"}'${NC}"
    
elif [ $HEALTHY_COUNT -ge 3 ]; then
    echo -e "${YELLOW}Most services are running ($HEALTHY_COUNT/5)${NC}"
    echo -e "${BLUE}Some services may still be initializing. Wait a minute and check again.${NC}"
else
    echo -e "${RED}Several services are not responding ($HEALTHY_COUNT/5)${NC}"
    echo -e "${YELLOW}Check logs for each service:${NC}"
    echo -e "  docker logs user-service"
    echo -e "  docker logs order-service"
fi

echo ""