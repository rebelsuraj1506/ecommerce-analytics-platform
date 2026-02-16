# 🚀 Quick Start Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (v20.10+) and **Docker Compose** (v2.0+)
- **Node.js** (v18+) - for local development
- **Git**
- **AWS CLI** (for production deployment)

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd ecommerce-analytics-platform
```

### 2. Environment Setup

Copy environment files for all services:

```bash
# User Service
cp services/user-service/.env.example services/user-service/.env

# Product Service
cp services/product-service/.env.example services/product-service/.env

# Order Service (create .env)
cat > services/order-service/.env << EOF
PORT=8003
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=orders_db
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3000
USER_SERVICE_URL=http://user-service:8001
PRODUCT_SERVICE_URL=http://product-service:8002
EOF

# Analytics Service (create .env)
cat > services/analytics-service/.env << EOF
PORT=8004
NODE_ENV=development
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3000
ORDER_SERVICE_URL=http://order-service:8003
PRODUCT_SERVICE_URL=http://product-service:8002
EOF

# API Gateway (create .env)
cat > services/api-gateway/.env << EOF
PORT=8000
NODE_ENV=development
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3000
USER_SERVICE_URL=http://user-service:8001
PRODUCT_SERVICE_URL=http://product-service:8002
ORDER_SERVICE_URL=http://order-service:8003
ANALYTICS_SERVICE_URL=http://analytics-service:8004
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
```

### 3. Start All Services with Docker Compose

```bash
# Build and start all containers
docker-compose up --build -d

# Check if all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Verify Services are Running

```bash
# User Service
curl http://localhost:8001/health

# Product Service
curl http://localhost:8002/health

# Order Service
curl http://localhost:8003/health

# Analytics Service
curl http://localhost:8004/health

# API Gateway
curl http://localhost:8000/health
```

## 🧪 Testing the Platform

### 1. Register a New User

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!@#",
    "name": "Admin User",
    "role": "admin"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token for subsequent requests!**

### 2. Login

```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!@#"
  }'
```

### 3. Create a Product

```bash
curl -X POST http://localhost:8002/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Laptop Pro 15",
    "description": "High-performance laptop for professionals",
    "price": 1299.99,
    "inventory": 50,
    "category": "electronics",
    "tags": ["laptop", "computer", "tech"]
  }'
```

### 4. Get All Products

```bash
curl http://localhost:8002/api/products
```

### 5. Create an Order

```bash
curl -X POST http://localhost:8003/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_ID_FROM_STEP_3",
        "quantity": 2
      }
    ],
    "paymentMethod": "credit_card",
    "shippingAddress": "123 Main St, City, Country"
  }'
```

### 6. Get Analytics Dashboard

```bash
curl http://localhost:8004/api/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🌐 Access the Frontend

Once all services are running:

1. Open your browser
2. Navigate to: **http://localhost:3000**
3. Login with your credentials
4. Explore the dashboard!

## 🛠️ Development

### Running a Single Service Locally

```bash
# Example: User Service
cd services/user-service

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Database Access

#### MySQL (User Service)
```bash
docker-compose exec mysql mysql -u root -prootpassword

USE users_db;
SHOW TABLES;
SELECT * FROM users;
```

#### PostgreSQL (Order Service)
```bash
docker-compose exec postgres psql -U postgres -d orders_db

\dt
SELECT * FROM orders;
```

#### MongoDB (Product Service)
```bash
docker-compose exec mongodb mongosh

use products_db
show collections
db.products.find()
```

#### Redis
```bash
docker-compose exec redis redis-cli

KEYS *
GET session:*
```

## 🐛 Troubleshooting

### Services won't start

```bash
# Check logs for specific service
docker-compose logs user-service
docker-compose logs product-service

# Restart specific service
docker-compose restart user-service

# Rebuild and restart
docker-compose up --build -d
```

### Port conflicts

If ports 3000, 8000-8004, 3306, 5432, 27017, or 6379 are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.yml`

### Clear all data and restart fresh

```bash
# Stop and remove all containers, volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up --build -d
```

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| API Gateway | 8000 | http://localhost:8000 |
| User Service | 8001 | http://localhost:8001 |
| Product Service | 8002 | http://localhost:8002 |
| Order Service | 8003 | http://localhost:8003 |
| Analytics Service | 8004 | http://localhost:8004 |
| MySQL | 3306 | localhost:3306 |
| PostgreSQL | 5432 | localhost:5432 |
| MongoDB | 27017 | localhost:27017 |
| Redis | 6379 | localhost:6379 |
| Nginx | 80 | http://localhost |

## 🚀 Production Deployment

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for AWS EC2 deployment instructions.

## 📚 Additional Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Database Schemas](./docs/SCHEMAS.md)
- [CI/CD Pipeline](./docs/CICD.md)
- [AWS Deployment Guide](./docs/DEPLOYMENT.md)

## ❓ Need Help?

- Check the [FAQ](./docs/FAQ.md)
- Open an issue on GitHub
- Review service logs: `docker-compose logs -f [service-name]`

---

**Happy Coding! 🎉**
