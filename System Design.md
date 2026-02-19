# System Design: E-Commerce Analytics Platform

## 1. Overview

The **E-Commerce Analytics Platform** is a cloud-ready, containerized application built on a microservices architecture. It provides core e-commerce capabilities (user management, product catalog, order processing) alongside a dedicated analytics engine — all orchestrated via Docker Compose and deployable to AWS EC2.

---

## 2. Architecture Diagram

```
                          ┌────────────────────────────────────────┐
                          │                 Frontend               │
                          │             (React / Node.js)          │
                          │               localhost:3000           │
                          └─────────────────────┬──────────────────┘
                                                │ HTTP
                          ┌────────────────────▼───────────────────┐
                          │               API Gateway              │
                          │             localhost:8000             │
                          └──┬──────────┬───────────┬────────────┬─┘
                             │          │           │            │
              ┌──────────────┘          │           └────────┐   └────────────────────────┐
              │                      ┌──┘                    │                            │
   ┌──────────▼──────┐      ┌────────▼────────┐     ┌────────▼───────┐          ┌─────────▼──────────┐
   │  User Service   │      │Product Service  │     │ Order Service  │          │  Analytics Service │
   │  localhost:8001 │      │ localhost:8002  │     │ localhost:8003 │          │  localhost:8004    │
   └──────┬──────────┘      └──────┬──────────┘     └──────┬─────────┘          └────────┬───────────┘
          │                        │                       │                             │
          ▼                        ▼                       ▼                             ▼
       MySQL                    MongoDB                 PostgreSQL                      Redis
    (users_db)                 (products_db)            (orders_db)                 (Cache / Analytics)
```

---

## 3. Services

### 3.1 API Gateway (Port 8000)
The single entry point for all client requests. Responsible for routing incoming HTTP traffic to the appropriate downstream microservice, and potentially handling cross-cutting concerns like rate limiting and request logging.

### 3.2 User Service (Port 8001)
Manages authentication and user lifecycle. Exposes endpoints for registration, login, and profile management. Issues JWT tokens upon successful authentication, which are consumed by other services for authorization. Backed by **MySQL** (`users_db`).

### 3.3 Product Service (Port 8002)
Manages the product catalog including creation, retrieval, and inventory tracking. Products are schema-flexible, stored in **MongoDB** (`products_db`), which accommodates varying product attributes across categories.

### 3.4 Order Service (Port 8003)
Handles order creation and management, including line items, payment method, and shipping address. Uses **PostgreSQL** (`orders_db`) for its relational and transactional integrity guarantees.

### 3.5 Analytics Service (Port 8004)
Aggregates data across services to power a real-time dashboard. Uses **Redis** for fast in-memory caching and storing computed metrics (e.g., `analytics:orders:total`). Requires admin-level JWT authorization.

### 3.6 Frontend (Port 3000)
A Node.js-based frontend (likely React) that interacts with the backend through the API Gateway. Built and served as a separate container.

---

## 4. Data Stores

| Store      | Used By          | Reason for Choice                                           |
|------------|------------------|-------------------------------------------------------------|
| MySQL      | User Service     | Structured user/auth data; strong ACID compliance           |
| MongoDB    | Product Service  | Flexible, document-based schema for varied product catalogs |
| PostgreSQL | Order Service    | Relational integrity for orders and line items              |
| Redis      | Analytics Service| Fast in-memory key-value store for caching aggregated stats |

---

## 5. Authentication & Authorization

- **JWT-based authentication** is issued by the User Service upon login or registration.
- The token is passed as a `Bearer` token in the `Authorization` header to Product, Order, and Analytics services.
- Role-based access is supported (e.g., `admin` role), enabling privileged operations like analytics dashboard access.

---

## 6. Communication Pattern

All inter-client communication is **synchronous REST over HTTP**. Services are isolated within a shared Docker network (`ecommerce-network`), and communicate using Docker service names as hostnames. There is no evidence of async messaging (e.g., Kafka/RabbitMQ) in the current design — the Analytics Service likely queries other services or a shared Redis cache directly.

---

## 7. Infrastructure & Deployment

### Local Development
All services are orchestrated via **Docker Compose** (`docker-compose.yml`). Each service is containerized and communicates over an internal Docker bridge network.

### Production (AWS)
- Deployed to **AWS EC2** using a production Docker Compose file (`docker-compose.prod.yml`).
- Images are built and pushed to **Docker Hub**, then pulled on the EC2 instance.
- SSH access is used for manual deployments.

### Persistent Storage
Docker **named volumes** are used for data persistence across container restarts:
- `mysql_data` — MySQL user database
- `mongodb_data` — MongoDB product catalog
- `postgres_data` — PostgreSQL orders
- Redis data is ephemeral by default (used for caching)

---

## 8. API Surface Summary

| Service          | Endpoint                           | Method | Auth Required |
|------------------|------------------------------------|--------|---------------|
| User Service     | `/api/auth/register`               | POST   | No            |
| User Service     | `/api/auth/login`                  | POST   | No            |
| Product Service  | `/api/products`                    | GET    | No            |
| Product Service  | `/api/products`                    | POST   | Yes           |
| Order Service    | `/api/orders`                      | POST   | Yes           |
| Analytics Service| `/api/analytics/dashboard`         | GET    | Yes (Admin)   |
| All Services     | `/health`                          | GET    | No            |

---

## 9. Scalability & Extensibility Considerations

**Current State:** Single-instance per service, suitable for development and small-scale production.

**Potential Improvements:**
- **Message Queue (Kafka / RabbitMQ):** Decouple Order Service from Analytics Service using event-driven architecture. Order events can be published and consumed asynchronously.
- **Horizontal Scaling:** Services are stateless (JWT-based auth), making them candidates for horizontal scaling behind a load balancer.
- **Kubernetes:** Migrating from Docker Compose to Kubernetes (EKS/GKE) would enable auto-scaling, self-healing, and rolling deployments.
- **Service Mesh (Istio):** For mutual TLS, advanced traffic management, and observability between services.
- **CDN:** Static frontend assets can be served via CloudFront for reduced latency.
- **Centralized Logging:** Integrating ELK Stack (Elasticsearch, Logstash, Kibana) or AWS CloudWatch for aggregated log monitoring.

---

## 10. Technology Stack Summary

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | React / Node.js                   |
| API Gateway    | Node.js (Express or similar)      |
| Microservices  | Node.js (Express) × 4             |
| Databases      | MySQL, PostgreSQL, MongoDB, Redis  |
| Containerization | Docker + Docker Compose          |
| Auth           | JWT (Bearer tokens)               |
| Deployment     | AWS EC2 + Docker Hub              |
| Testing        | npm test (per-service)            |
| Dev Tooling    | curl, jq, docker-compose CLI      |