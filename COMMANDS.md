# 🚀 Quick Reference Commands

## 🏃 Getting Started (2 Minutes)

```bash
# Navigate to project
cd ecommerce-analytics-platform

# Start all services
docker-compose up -d

# Wait 30 seconds for services to start, then test
curl http://localhost:8001/health

# Access frontend
open http://localhost:3000
```

## 📦 Essential Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart user-service

# View all running containers
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f user-service

# Last 100 lines
docker-compose logs --tail=100 user-service
```

### Database Access
```bash
# MySQL (User Service)
docker-compose exec mysql mysql -u root -prootpassword
> USE users_db;
> SELECT * FROM users;

# PostgreSQL (Order Service)
docker-compose exec postgres psql -U postgres -d orders_db
> \dt
> SELECT * FROM orders;

# MongoDB (Product Service)
docker-compose exec mongodb mongosh
> use products_db
> db.products.find()

# Redis
docker-compose exec redis redis-cli
> KEYS *
> GET analytics:orders:total
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build user-service

# Rebuild and restart
docker-compose up -d --build
```

## 🧪 API Testing Commands

### 1. Register User
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!@#",
    "name": "Admin User",
    "role": "admin"
  }'

# Save the token from response!
```

### 2. Login
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!@#"
  }'
```

### 3. Create Product
```bash
TOKEN="your-token-here"

curl -X POST http://localhost:8002/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "MacBook Pro 16",
    "description": "Powerful laptop for professionals",
    "price": 2499.99,
    "inventory": 25,
    "category": "electronics",
    "tags": ["laptop", "apple", "computer"]
  }'

# Save the product _id from response!
```

### 4. Get All Products
```bash
curl http://localhost:8002/api/products
```

### 5. Create Order
```bash
TOKEN="your-token-here"
PRODUCT_ID="product-id-from-step-3"

curl -X POST http://localhost:8003/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {
        "productId": "'$PRODUCT_ID'",
        "name": "Product Name",
        "quantity": 2,
        "price": 99.99
      }
    ],
    "paymentMethod": "credit_card",
    "shippingAddress": {
      "street": "123 Tech Street",
      "city": "Silicon Valley",
      "state": "CA",
      "zipCode": "94000",
      "phone": "+1 555-123-4567"
    }
  }'
```

### 6. Get Analytics
```bash
TOKEN="your-token-here"

curl http://localhost:8004/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Health Checks
```bash
# All services
for port in 8000 8001 8002 8003 8004; do
  echo "Checking port $port..."
  curl http://localhost:$port/health
  echo ""
done
```

## 🛠️ Development Commands

### Install Dependencies (If running locally)
```bash
# Install for all services
for service in user-service product-service order-service analytics-service api-gateway; do
  cd services/$service
  npm install
  cd ../..
done

# Install frontend
cd frontend
npm install
```

### Run Individual Service
```bash
# Example: User Service
cd services/user-service
npm run dev
```

### Run Tests
```bash
# All services
for service in user-service product-service order-service; do
  echo "Testing $service..."
  cd services/$service
  npm test
  cd ../..
done
```

## 🔍 Debugging

### Check Service Status
```bash
docker-compose ps
```

### Check Container Resource Usage
```bash
docker stats
```

### Inspect Container
```bash
docker inspect user-service
```

### Enter Container Shell
```bash
docker-compose exec user-service sh
```

### Check Network
```bash
docker network ls
docker network inspect ecommerce-analytics-platform_ecommerce-network
```

## 🗑️ Clean Up

### Remove All Containers and Volumes
```bash
# Stop and remove everything
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Full clean (careful!)
docker-compose down -v --rmi all
docker system prune -a
```

### Remove Specific Service Data
```bash
# Remove only MySQL data
docker volume rm ecommerce-analytics-platform_mysql_data

# Remove only MongoDB data
docker volume rm ecommerce-analytics-platform_mongodb_data
```

## 📊 Monitoring

### Check Logs for Errors
```bash
# Find errors in all logs
docker-compose logs | grep -i error

# Find errors in specific service
docker-compose logs user-service | grep -i error
```

### Watch Real-time Logs
```bash
# All services
docker-compose logs -f --tail=50

# Specific service
docker-compose logs -f --tail=50 user-service
```

## 🚀 Production Deployment

### Build for Production
```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Push to Docker Hub
docker-compose -f docker-compose.prod.yml push
```

### Deploy on EC2
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Pull and start
cd /home/ubuntu/ecommerce-analytics-platform
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Useful Aliases (Add to ~/.bashrc or ~/.zshrc)

```bash
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcl='docker-compose logs -f'
alias dcp='docker-compose ps'
alias dcr='docker-compose restart'
alias dcb='docker-compose build'

# Usage: dcl user-service
# Usage: dcr order-service
```

## 🎯 Testing Workflow

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for health
sleep 30

# 3. Register user and save token
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}' \
  | jq -r '.data.token')

echo $TOKEN

# 4. Create product and save ID
PRODUCT_ID=$(curl -s -X POST http://localhost:8002/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":99.99,"inventory":10,"category":"electronics","description":"Test"}' \
  | jq -r '.data.product._id')

echo $PRODUCT_ID

# 5. Create order (use real product name/price from step 4)
curl -X POST http://localhost:8003/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"name\":\"Test Product\",\"quantity\":1,\"price\":99.99}],\"paymentMethod\":\"credit_card\",\"shippingAddress\":{\"street\":\"1 Test St\",\"city\":\"City\",\"state\":\"ST\",\"zipCode\":\"12345\",\"phone\":\"+1234567890\"}}"

# 6. Check analytics
curl http://localhost:8004/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

## 🆘 Common Issues

### Port Already in Use
```bash
# Find process using port
lsof -i :3306  # MySQL
lsof -i :5432  # PostgreSQL
lsof -i :27017 # MongoDB
lsof -i :6379  # Redis

# Kill process
kill -9 <PID>
```

### Services Not Starting
```bash
# Check logs
docker-compose logs user-service

# Rebuild
docker-compose build user-service
docker-compose up -d user-service
```

### Database Connection Issues
```bash
# Restart database services
docker-compose restart mysql postgres mongodb redis

# Check if databases are ready
docker-compose exec mysql mysqladmin ping -h localhost
docker-compose exec postgres pg_isready
```

---

**Happy Coding! 🎉**

For more details, see:
- [README.md](./README.md) - Complete documentation and API overview
- [QUICKSTART.md](./QUICKSTART.md) - Detailed setup and env examples
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - What was built
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - AWS deployment guide
