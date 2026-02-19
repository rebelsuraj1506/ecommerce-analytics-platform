# 🛍️ E-Commerce Analytics Platform

A production-ready microservices-based e-commerce analytics platform built with Docker, AWS (EC2, RDS, S3), Redis, MySQL, PostgreSQL, MongoDB, and React.js.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           EC2 Instance (Docker Host)        │
│  ┌──────────────────────────────────────┐  │
│  │  • Nginx (Reverse Proxy)             │  │
│  │  • API Gateway (Rate Limiting)       │  │
│  │  • User Service (MySQL)              │  │
│  │  • Product Service (MongoDB)         │  │
│  │  • Order Service (PostgreSQL + MongoDB)     │  │
│  │  • Analytics Service (Redis)         │  │
│  │  • Frontend (React Dashboard)        │  │
│  │  • Redis (Cache/Sessions/Queue)      │  │
│  │  • MongoDB (Products DB)             │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         ↓                           ↓
  ┌──────────────┐          ┌──────────────┐
  │  AWS RDS     │          │   AWS S3     │
  │  • MySQL     │          │  • Images    │
  │  • PostgreSQL│          │  • Assets    │
  └──────────────┘          └──────────────┘
```

## 🎯 Tech Stack

### Backend
- **Node.js** + Express.js - Microservices
- **MySQL** (RDS) - User authentication & management
- **PostgreSQL** (RDS) - Orders & transactions (core order records)
- **MongoDB** (Docker) - Orders extended data (soft-delete, restoration workflow)
- **MongoDB** (Docker) - Product catalog
- **Redis** (Docker) - Caching, sessions, rate limiting, analytics

### Frontend
- **React.js** - Admin dashboard
- **Recharts** - Data visualization
- **Axios** - API client
- **CSS3** - Styling

### DevOps & Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **AWS EC2** - Application hosting
- **AWS RDS** - Managed databases
- **AWS S3** - Object storage
- **Nginx** - Reverse proxy & load balancing
- **GitHub Actions** - CI/CD pipeline
- **Git** - Version control

## 📁 Project Structure

```
ecommerce-analytics-platform/
├── services/
│   ├── api-gateway/          # Central API gateway with rate limiting
│   ├── user-service/         # Authentication & user management (MySQL)
│   ├── product-service/      # Product catalog management (MongoDB)
│   ├── order-service/        # Order processing (PostgreSQL)
│   └── analytics-service/    # Real-time analytics (Redis)
├── frontend/                 # React.js dashboard
├── infrastructure/
│   ├── ec2/                  # EC2 setup scripts
│   ├── rds/                  # Database initialization
│   ├── s3/                   # S3 bucket policies
│   └── terraform/            # Infrastructure as Code
├── nginx/                    # Nginx configuration
├── .github/workflows/        # CI/CD pipelines
└── docker-compose.yml        # Local development
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Step-by-step setup with env examples and health checks |
| [COMMANDS.md](./COMMANDS.md) | Command reference: Docker, DB, API testing, troubleshooting |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | AWS EC2, RDS, S3 deployment guide |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Git
- AWS Account (for production deployment)

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd ecommerce-analytics-platform
```

2. **Set up environment variables**
```bash
# Copy example env files for each service
cp services/user-service/.env.example services/user-service/.env
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
cp services/analytics-service/.env.example services/analytics-service/.env
cp services/api-gateway/.env.example services/api-gateway/.env
cp frontend/.env.example frontend/.env
```

3. **Start all services with Docker Compose**
```bash
docker-compose up -d
```

4. **Wait for services to be healthy (about 30 seconds)**
```bash
docker-compose ps
```

5. **Access the application**
- **Frontend Dashboard:** http://localhost:3000 (login and use the app here)
- **API Gateway:** http://localhost:8000 (use this for unified API + rate limiting)
- **Services (direct):** User 8001 | Product 8002 | Order 8003 | Analytics 8004  

The React app currently calls services directly on ports 8001–8004. For production, route all traffic via the API Gateway (8000).

### First Time Setup

1. **Initialize databases (optional)**
```bash
# User service migrations (if available)
docker-compose exec user-service npm run migrate

# Order service creates tables automatically on first start.
# Product service: seed sample products (optional)
docker-compose exec product-service npm run seed
```

3. **Create admin user**
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "name": "Admin User",
    "role": "admin"
  }'
```

4. **Sync inventory for previous orders (one-time)**  
If you had orders placed before inventory deduction was enabled, run this once (as admin) so product stock reflects those orders:
```bash
curl -X POST http://localhost:8003/api/orders/sync-inventory \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
Response includes `synced` (count of orders processed) and any `errors` or `skippedOrderIds`.  
If inventory was zeroed by mistake (e.g. sync ran multiple times), restore it with:
```bash
curl -X POST http://localhost:8003/api/orders/undo-sync-inventory \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
Then run `sync-inventory` again once if needed.

## 🔧 Development

### Running Individual Services

```bash
# Start specific service
cd services/user-service
npm install
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Database Access

```bash
# MySQL (User Service) - password: rootpassword
docker-compose exec mysql mysql -u root -prootpassword users_db

# PostgreSQL (Order Service)
docker-compose exec postgres psql -U postgres -d orders_db

# MongoDB (Product Service)
docker-compose exec mongodb mongosh
# Then: use products_db; db.products.find()
```

### Redis CLI

```bash
docker-compose exec redis redis-cli
```

## 🌐 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "John Doe",
  "role": "customer"
}
```
Use `"role": "admin"` for the first admin user. Omit `role` for default `customer`.

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

### Product Endpoints

#### Get All Products
```http
GET /api/products?page=1&limit=10
```

#### Create Product (Admin)
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Product description",
  "price": 99.99,
  "inventory": 100,
  "category": "electronics"
}
```

### Order Endpoints

#### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "<product-_id>",
      "name": "Product Name",
      "quantity": 2,
      "price": 99.99
    }
  ],
  "paymentMethod": "credit_card",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zipCode": "400001",
    "phone": "+91 9876543210"
  }
}
```

#### Get Orders (user: own orders; admin: all orders)
```http
GET /api/orders?page=1&limit=10
Authorization: Bearer <token>
```

#### Order tracking & cancellation
- `GET /api/orders/:id` - Order details  
- `GET /api/orders/:id/tracking` - Tracking timeline  
- `PUT /api/orders/:id/status` - Update status (admin)  
- `POST /api/orders/:id/cancel-request` - Request cancellation  
- `PUT /api/orders/:id/approve-cancel` / `reject-cancel` - Admin actions  
All require `Authorization: Bearer <token>`.

### Analytics Endpoints

#### Get Dashboard Metrics
```http
GET /api/analytics/dashboard
Authorization: Bearer <token>
```

#### Get Revenue Analytics
```http
GET /api/analytics/revenue?period=7d
Authorization: Bearer <token>
```

## 🎨 Frontend Features

- **Real-time Dashboard** - Live metrics and KPIs
- **Order Management** - View and manage all orders; status updates, tracking, cancellation flow
- **My Orders** - User-specific orders with delivery address and phone
- **Product Catalog** - CRUD operations for products and categories
- **User Management** - Admin panel for users and roles
- **Analytics Charts** - Revenue trends, top products
- **Responsive Design** - Mobile-friendly interface

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting (100 requests/15 minutes)
- CORS protection
- SQL injection prevention
- Input validation
- Secure headers (Helmet.js)
- Environment variable management

## 📊 Monitoring & Logging

- Health check endpoints for all services
- Structured logging with Winston
- Request/response logging
- Error tracking
- Performance monitoring

## 🚢 Production Deployment (AWS)

### Prerequisites
- AWS Account with EC2, RDS, S3 access
- AWS CLI configured
- Terraform installed (optional)

### Manual Deployment

1. **Launch EC2 Instance**
   - AMI: Ubuntu 22.04
   - Instance Type: t3.medium (2 vCPU, 4GB RAM)
   - Security Group: Allow ports 22, 80, 443

2. **Create RDS Instances**
   - MySQL 8.0 (db.t3.micro)
   - PostgreSQL 15 (db.t3.micro)

3. **Create S3 Bucket**
   - Bucket name: `ecommerce-platform-images-{random}`
   - Enable versioning
   - Block public access (use signed URLs)

4. **Setup EC2**
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<ec2-public-ip>

# Run setup script
curl -o setup.sh https://raw.githubusercontent.com/your-repo/main/infrastructure/ec2/setup-script.sh
chmod +x setup.sh
sudo ./setup.sh
```

5. **Deploy Application**
```bash
# Clone repository
git clone <your-repo>
cd ecommerce-analytics-platform

# Set production environment variables
nano .env.production

# Start with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Automated Deployment with Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply configuration
terraform apply
```

### CI/CD with GitHub Actions

The project includes automated CI/CD pipelines:

- **On Push/PR**: Lint, test, build
- **On Merge to Main**: Build images, deploy to EC2

**Setup Required:**
1. Add GitHub Secrets:
   - `EC2_SSH_KEY`
   - `EC2_HOST`
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`

## 📈 Scaling Considerations

### Horizontal Scaling
- Add more EC2 instances behind a load balancer
- Use AWS Application Load Balancer (ALB)
- Implement session affinity or centralized sessions in Redis

### Database Scaling
- Enable RDS read replicas
- Implement connection pooling
- Use database caching strategies

### Caching Strategy
- Redis for frequently accessed data
- CDN for static assets (S3 + CloudFront)
- Browser caching headers

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- E-Commerce Analytics Platform contributors

## 🙏 Acknowledgments

- Inspired by modern microservices architecture
- Built for learning and portfolio purposes
- Community feedback and contributions

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- See [QUICKSTART.md](./QUICKSTART.md) and [COMMANDS.md](./COMMANDS.md) for setup and troubleshooting

---

**Happy Coding! 🚀**