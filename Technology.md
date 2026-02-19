# 🔧 Technology Stack — Detailed Reference

A deep-dive into every technology used in the E-Commerce Analytics Platform: what it is, what version is running, exactly how and where it is used in this project, and why it was chosen over alternatives.

---

## Table of Contents

1. [Runtime — Node.js](#1-runtime--nodejs)
2. [Web Framework — Express.js](#2-web-framework--expressjs)
3. [Frontend Framework — React.js](#3-frontend-framework--reactjs)
4. [Database — MySQL 8.0](#4-database--mysql-80)
5. [Database — PostgreSQL 15](#5-database--postgresql-15)
6. [Database — MongoDB 7.0](#6-database--mongodb-70)
7. [Cache & Message Store — Redis 7](#7-cache--message-store--redis-7)
8. [Reverse Proxy — Nginx](#8-reverse-proxy--nginx)
9. [Containerisation — Docker](#9-containerisation--docker)
10. [Container Orchestration — Docker Compose](#10-container-orchestration--docker-compose)
11. [Cloud Hosting — AWS EC2](#11-cloud-hosting--aws-ec2)
12. [Managed Databases — AWS RDS](#12-managed-databases--aws-rds)
13. [Object Storage — AWS S3](#13-object-storage--aws-s3)
14. [CI/CD — GitHub Actions](#14-cicd--github-actions)
15. [HTTP Client — Axios](#15-http-client--axios)
16. [Authentication — JSON Web Tokens (JWT)](#16-authentication--json-web-tokens-jwt)
17. [Password Security — bcryptjs](#17-password-security--bcryptjs)
18. [Input Validation — express-validator](#18-input-validation--express-validator)
19. [Security Middleware — Helmet.js](#19-security-middleware--helmetjs)
20. [Logging — Winston](#20-logging--winston)
21. [ODM — Mongoose](#21-odm--mongoose)
22. [PostgreSQL Driver — node-postgres (pg)](#22-postgresql-driver--node-postgres-pg)
23. [MySQL Driver — mysql2](#23-mysql-driver--mysql2)
24. [Task Scheduling — node-cron](#24-task-scheduling--node-cron)
25. [File Uploads — Multer](#25-file-uploads--multer)
26. [AWS SDK](#26-aws-sdk)
27. [Data Visualisation — Recharts](#27-data-visualisation--recharts)
28. [Icon Library — react-icons](#28-icon-library--react-icons)
29. [Routing — react-router-dom](#29-routing--react-router-dom)
30. [External Image API — Unsplash](#30-external-image-api--unsplash)
31. [Development Tools](#31-development-tools)
32. [Security Scanning — Trivy](#32-security-scanning--trivy)

---

## 1. Runtime — Node.js

**Version used:** `18` (LTS, specified in all Dockerfiles and GitHub Actions `setup-node` steps)

Node.js is the JavaScript runtime that executes every backend microservice in this project. It is built on the V8 JavaScript engine and uses a non-blocking, event-driven I/O model, meaning a single thread can handle many concurrent network requests without spawning a new OS thread per connection — the ideal model for microservices that spend most of their time waiting on database queries or HTTP calls to sibling services.

**How it is used here:**
All five backend services (User Service, Product Service, Order Service, Analytics Service, and API Gateway) are Node.js processes. Each service starts by running `node src/index.js` (or `nodemon src/index.js` in development). The `package.json` in every service defines a `start` script for production and a `dev` script for hot-reloading development.

In the Dockerfiles, the base image is `node:18-alpine` — the Alpine Linux variant chosen for its minimal footprint (~5 MB base image vs. ~900 MB for the full Debian-based image). A non-root user called `nodejs` is created in each Dockerfile and the application runs under that user, following the principle of least privilege inside the container.

The `process.on('SIGTERM')` and `process.on('unhandledRejection')` handlers are wired in every service's `index.js` to handle graceful shutdown when Docker stops a container and to catch unhandled promise failures before they silently corrupt state.

---

## 2. Web Framework — Express.js

**Version used:** `^4.18.2` (all five services)

Express.js is a minimal, unopinionated web framework for Node.js. It provides a thin routing layer and a middleware pipeline on top of Node's built-in `http` module, without imposing a project structure or an ORM.

**How it is used here:**

Every backend service creates a single Express `app` instance:

```js
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());
app.use(rateLimiter);
```

Middleware is applied in order: Helmet sets security headers, `cors()` adds cross-origin headers, `express.json()` parses request bodies, and the rate limiter checks the Redis counter before any route handler runs.

Routes are organised by domain. The User Service mounts three route files — `auth.js`, `users.js`, and `profile.js` — at `/api/auth`, `/api/users`, and `/api/users` respectively. The Product Service mounts `products.js` and `categories.js`. The Order Service mounts `orders.js` and `orderDeletion.js`. The Analytics Service defines its four routes directly on `app` rather than on a sub-router, given its simplicity.

**Route validation** uses `express-validator` chains defined inline on each route array before the handler. A shared `validateRequest` middleware collects errors and short-circuits with a `400` response if any validation failed, so handlers only run with clean data.

**Error handling** follows the Express four-argument convention (`(err, req, res, next)`), applied as the final `app.use` in each service to catch anything that falls through.

**The API Gateway** is also an Express app but has no domain routes of its own. Instead, it uses `app.all('/api/auth*', ...)` patterns and an `axios`-based `proxyRequest` helper to forward every incoming request — method, body, headers, query string — to the correct downstream service and stream the response back to the client.

---

## 3. Frontend Framework — React.js

**Version used:** `^18.2.0`

React is a declarative, component-based JavaScript library for building user interfaces. It re-renders the UI efficiently using a virtual DOM — only the parts of the page that have changed are updated in the real DOM.

**How it is used here:**

The frontend is a single-page application (SPA) bootstrapped with `create-react-app` (`react-scripts 5.0.1`). The entry point is `src/index.js` which renders the root `<App />` into the `#root` div in `public/index.html`.

**State management** relies entirely on React's built-in hooks: `useState` for local component state, `useEffect` for side effects (data fetching, polling intervals, `localStorage` sync), and `useContext` to share authentication state across the component tree. There is no Redux or third-party state library.

**Authentication context** (`src/contexts/AuthContext.js`) is a custom context provider that wraps the entire application. On mount it reads `authToken` and `authUser` from `localStorage`, decodes the JWT payload client-side to check the `exp` claim, and sets state if the token is still valid. The `login` function stores the token, `logout` clears `localStorage` and resets state, and `isAuthenticated` is a derived boolean used to gate route rendering.

**The page components** are in `src/pages/`:
- `Dashboard.js` — live-refreshing KPI cards and order management table, polls every 15 seconds via `setInterval` in a `useEffect` cleanup pattern.
- `Products.js` — product CRUD with dynamic Unsplash images.
- `Orders.js` — full admin order management with status filters and bulk delete.
- `MyOrders.js` — customer order history with cancellation requests and detail access requests.
- `AdminPanel.js` — tabbed admin area (users, orders, detail requests) with live search, sort, and manual user creation.
- `UserProfile.js` — tabbed personal info and address book management.
- `Categories.js` — category list view.

**The production build** (`npm run build`) produces a static bundle of minified JavaScript, CSS, and HTML in `/app/build`. In the Docker container, this bundle is served by the `serve` npm package on port 3000 (`CMD ["serve", "-s", "build", "-l", "3000"]`). The `-s` flag enables single-page app mode, redirecting all 404s to `index.html` so client-side routing works correctly.

---

## 4. Database — MySQL 8.0

**Docker image:** `mysql:8.0`
**Driver:** `mysql2 ^3.6.5`
**Port mapping:** `3307:3306` (host port **3307**, container port 3306)
**Database name:** `users_db`
**Owner:** User Service

MySQL is a mature, widely-deployed relational database. It was chosen for user data because user records are highly structured (fixed columns, strict types, strong consistency guarantees), benefits from ACID transactions, and needs fast indexed lookups by email and by user ID — all natural strengths of a relational engine.

**How it is used here:**

The User Service connects to MySQL via a connection pool created with `mysql2/promise`:

```js
pool = mysql.createPool({
  host, port, user, password, database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});
```

A pool of up to 10 concurrent connections is maintained. `enableKeepAlive` prevents idle connections from being silently dropped by the database or network infrastructure after a period of inactivity.

**Schema** is created automatically on first startup by running `CREATE TABLE IF NOT EXISTS` statements inside `connectDB()`, so there is no separate migration step required for a fresh environment. Three tables are created:

- **`users`** — stores `id` (auto-increment PK), `email` (unique, indexed), `password` (bcrypt hash), `name`, `phone`, `role` (ENUM: `customer`/`merchant`/`admin`), and `created_at`/`updated_at` timestamps. Indexed on `email` and `role` for fast login lookups and role-based queries.
- **`sessions`** — stores active JWT tokens per user (used to invalidate sessions on logout). Has a foreign key to `users(id)` with `ON DELETE CASCADE`, and an index on the `token` column (first 255 characters) for fast session lookups.
- **`user_addresses`** — stores multiple delivery addresses per user with `label`, `street`, `city`, `state`, `zip_code`, `country` (defaults to 'India'), `phone`, and `is_default`. Foreign key to `users(id)` with `ON DELETE CASCADE`.

All queries use parameterised placeholders (`?` in `mysql2`) to prevent SQL injection. In production, the service connects to an **AWS RDS MySQL 8.0** instance rather than the Docker container, configured via `DB_HOST` environment variable.

---

## 5. Database — PostgreSQL 15

**Docker image:** `postgres:15-alpine`
**Driver:** `pg ^8.11.3` + `pg-hstore ^2.3.4`
**Port mapping:** `5432:5432`
**Database name:** `orders_db`
**Owner:** Order Service

PostgreSQL is an advanced open-source relational database with richer data types than MySQL. It was chosen for orders because: orders involve multi-table transactions (orders + order_items + transactions must commit or roll back atomically), PostgreSQL's `JSONB` type stores the cancellation images array and shipping address without needing a separate table, and `ADD COLUMN IF NOT EXISTS` makes schema evolution safe to run on every startup.

**How it is used here:**

The Order Service uses `pg.Pool` with a maximum of 20 connections and a 30-second idle timeout:

```js
pool = new Pool({ host, port, user, password, database, max: 20, idleTimeoutMillis: 30000 });
```

Connections are acquired per-request with `pool.connect()` and released in the `finally` block. Multi-step operations (order creation, cancellation approval, soft delete) use explicit `BEGIN`/`COMMIT`/`ROLLBACK` transactions to ensure atomicity.

**Schema** is auto-created on startup with `CREATE TABLE IF NOT EXISTS` and extended with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to safely add new columns to existing databases without data loss. The full `orders` table has 30+ columns covering the full order lifecycle:

- Core: `id`, `user_id`, `user_order_number`, `total_amount`, `status`, `payment_method`, `shipping_address` (JSON string), `inventory_deducted`
- Tracking timestamps: `processing_at`, `shipped_at`, `out_for_delivery_at`, `delivered_at`, plus `tracking_number`, `courier_name`, `estimated_delivery`
- Cancellation: `cancellation_reason`, `cancellation_images` (JSONB array), `cancellation_requested_at`, `cancellation_approved_by`, `cancellation_approved_at`, `cancellation_rejected`, `cancellation_rejection_reason`, `cancellation_rejected_by`, `cancellation_rejected_at`, `cancelled_at`
- Refund: `refund_status`, `refund_amount`, `refund_processing_at`, `refunded_at`
- Soft delete: `deleted_at`, `deleted_by`, `deletion_reason`

The `order_items` table stores individual line items with a foreign key `ON DELETE CASCADE` to orders. The `transactions` table records payment transaction IDs. The `order_detail_requests` table manages the 30-day retention access request workflow, with indexes on `order_id`, `user_id`, and `status`.

`user_order_number` is computed atomically on insert using a PostgreSQL subquery (`SELECT COALESCE(MAX(user_order_number), 0) + 1 FROM orders WHERE user_id = $1`), avoiding a race condition that would occur if this were computed in application code.

In production, the service connects to **AWS RDS PostgreSQL 15**.

---

## 6. Database — MongoDB 7.0

**Docker image:** `mongo:7.0`
**ODM:** `mongoose ^8.0.3`
**Port mapping:** `27017:27017`
**Databases:** `products_db` (Product Service), `orders_db` (Order Service)
**Owners:** Product Service (primary), Order Service (soft-delete workflow)

MongoDB is a document-oriented NoSQL database that stores data as flexible BSON documents (binary JSON). It was chosen for the product catalog because products naturally vary in structure — some have SKUs, some have tags, some have image arrays — and a schema-flexible document store can accommodate this without NULL-heavy tables. MongoDB's text indexes also power the full-text product search.

**How it is used here:**

**In the Product Service**, Mongoose connects to `mongodb://mongodb:27017/products_db`. The `Product` model schema (`src/models/Product.js`) defines:

- `name` (String, max 200 chars), `description` (String, max 2000 chars)
- `price` (Number, min 0), `inventory` (Number, min 0, default 0)
- `category` (String, enum: `electronics`/`clothing`/`books`/`home`/`sports`/`toys`/`other`)
- `images` (array of URLs), `tags` (array of strings), `sku` (unique, sparse)
- `isActive` (Boolean, default true) — soft-delete equivalent for products
- `rating` (sub-document: `average` and `count`)
- `reviews` (array of sub-documents: `userId`, `userName`, `rating`, `comment`, `createdAt`)
- Mongoose `timestamps: true` automatically manages `createdAt` and `updatedAt`

A `pre('save')` hook recalculates `rating.average` and `rating.count` from the `reviews` array every time the document is saved, keeping the aggregate in sync without a separate aggregation query on every read.

**Indexes** defined on the schema improve query performance:
- Text index on `name` + `description` enables `$text: { $search: '...' }` full-text search
- Compound index on `{ category: 1, price: 1 }` accelerates category-filtered and price-sorted queries
- Index on `{ 'rating.average': -1 }` supports top-rated product queries
- Indexes on `createdAt` and `isActive` for listing and filtering

**In the Order Service**, Mongoose connects to `mongodb://mongodb:27017/orders_db` for the soft-delete and restoration request workflow introduced in the `orderDeletion` routes. This allows the Order Service to use both PostgreSQL (for transactional order data) and MongoDB (for the softer, request-based deletion lifecycle) simultaneously.

---

## 7. Cache & Message Store — Redis 7

**Docker image:** `redis:7-alpine`
**Client library:** `redis ^4.6.12` (all five services)
**Port mapping:** `6379:6379`

Redis is an in-memory data structure server. It is extraordinarily fast (sub-millisecond reads and writes) because all data lives in RAM, and it supports rich data types beyond plain key-value: strings, sorted sets, hashes, lists, and more.

**How it is used here across each service:**

**Session store (User Service):** On login, the User Service stores the JWT token as a Redis key `session:<token>` with a TTL matching the token's expiry. The `authenticate` middleware checks for this key's existence on every protected request — if the key is absent (expired or explicitly deleted on logout), the request is rejected as `401`. This makes token invalidation possible: calling `/logout` runs `cacheDel('session:<token>')`, instantly revoking the session even though JWTs are otherwise stateless.

The Redis config module (`src/config/redis.js`) exposes `cacheSet(key, value, expiryInSeconds)`, `cacheGet(key)`, and `cacheDel(key)` helper functions used throughout the User Service. `cacheSet` uses `setEx` (set with expiry), `cacheGet` parses JSON automatically.

**Rate limiting (API Gateway):** The gateway uses `redis.incr('ratelimit:<ip>')` to atomically increment a per-IP request counter. On the first request (`incr` returns `1`), `expire` is called to set a 1-minute TTL on the key. If the counter exceeds `RATE_LIMIT_MAX_REQUESTS`, the request receives a `429 Too Many Requests` response. Because the counter lives in Redis (not in the Node.js process memory), rate limiting works correctly even if multiple gateway instances are running. The response includes `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers.

**Analytics counters (Analytics Service):** Redis is the sole data store for the Analytics Service. The service manages these keys:
- `analytics:orders:total` — all-time order count, incremented via `INCR`
- `analytics:revenue:total` — all-time revenue, incremented via `INCR BY FLOAT`
- `analytics:orders:today` / `analytics:revenue:today` — daily counters, reset by the `/reset/daily` endpoint
- `analytics:orders:<YYYY-MM-DD>` / `analytics:revenue:<YYYY-MM-DD>` — per-day buckets for the 7d/30d/90d revenue chart
- `analytics:products:top` — a **Redis Sorted Set** where each member is a `productId` and the score is total units sold. `ZINCRBY` adds to a product's score on each order. `ZRANGE ... REV WITHSCORES` retrieves the top 10 products in descending order.

Using Redis for analytics avoids expensive aggregation queries on the order database for every dashboard refresh.

**Connection handling:** Each service creates a Redis client using the `redis` v4 library with the `socket: { host, port }` configuration. The client emits `'error'`, `'connect'`, and `'ready'` events that are all logged via Winston. The `getRedisClient()` factory checks `isOpen` before returning the client, providing a clear error if the connection is not yet established.

---

## 8. Reverse Proxy — Nginx

**Docker image:** `nginx:alpine`
**Port mapping:** `80:80`
**Config file:** `nginx/nginx.conf` (mounted read-only into the container)

Nginx is a high-performance HTTP server and reverse proxy. It was chosen over alternatives (HAProxy, Traefik) for its simplicity, zero-dependency Alpine image, and ubiquity in production deployments.

**How it is used here:**

The `nginx.conf` defines a single `server` block listening on port 80 with two `upstream` groups and three `location` blocks:

```nginx
upstream api_gateway { server api-gateway:8000; }
upstream frontend    { server frontend:3000; }
```

**`location /`** — proxies all non-API traffic to the React frontend container. WebSocket upgrade headers (`Upgrade`, `Connection`) are forwarded so hot-module-replacement works in development. `X-Real-IP` and `X-Forwarded-For` headers pass the client's true IP address through to the backend (important for rate limiting, which keys on the client IP).

**`location /api/`** — proxies all API traffic to the API Gateway. CORS preflight responses (`OPTIONS`) are handled at the Nginx layer with a `204` response, avoiding an unnecessary round-trip to the gateway. The `Access-Control-Allow-Origin: *` headers added here provide a secondary CORS layer — the primary being the `cors()` middleware in each Express service.

**`location /health`** — returns a static `200 healthy` response for load balancer health checks without proxying to any container, reducing overhead.

Nginx uses HTTP/1.1 for upstream connections and sets `proxy_cache_bypass $http_upgrade`, ensuring upgrade requests bypass the cache. In production this same Nginx container would be the TLS termination point (with an SSL certificate from AWS Certificate Manager or Let's Encrypt), after which traffic flows as plain HTTP inside the VPC.

---

## 9. Containerisation — Docker

**Engine version required:** `20.10+` (recommended, per QUICKSTART.md)

Docker packages each service, its runtime, and its dependencies into a self-contained, reproducible image. The same image runs identically on a developer's MacBook and on an Ubuntu EC2 instance, eliminating environment drift.

**How it is used here:**

Every component has its own `Dockerfile`. The service Dockerfiles follow a common pattern:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production         # Install only prod deps (no devDependencies)
COPY . .
RUN mkdir -p logs
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/health', ...)"
CMD ["node", "src/index.js"]
```

Key decisions: `--production` install reduces image size by excluding test and build tools. The non-root `nodejs` user ensures the process cannot write outside `/app`. The `HEALTHCHECK` instruction makes Docker report the container as `healthy` only after the service's own `/health` endpoint responds with `200`, which Docker Compose uses as the readiness signal before starting dependent services.

The **frontend Dockerfile** uses a **multi-stage build**:
- Stage 1 (`build`): installs all dependencies (including devDependencies like `react-scripts`) and runs `npm run build` to produce a static bundle.
- Stage 2 (production): starts from a fresh `node:18-alpine` image, installs only `serve`, and copies only the `/app/build` directory from stage 1. This keeps the final image lean — the build toolchain (webpack, Babel, etc.) is discarded.

---

## 10. Container Orchestration — Docker Compose

**Version:** `3.8` (Compose file format)
**CLI version required:** `v2.0+`

Docker Compose defines and runs the full multi-container application from a single `docker-compose.yml` file. It manages networking, volumes, startup order, environment variables, and health checks across all 10 containers.

**How it is used here:**

The Compose file defines 10 services: `mysql`, `postgres`, `mongodb`, `redis`, `user-service`, `product-service`, `order-service`, `analytics-service`, `api-gateway`, `frontend`, and `nginx`.

**Dependency ordering** uses the `depends_on` with `condition: service_healthy` syntax:

```yaml
user-service:
  depends_on:
    mysql:
      condition: service_healthy
    redis:
      condition: service_healthy
```

This means Docker Compose waits for `mysqladmin ping` to succeed before starting the User Service — preventing the Node.js process from crashing on startup because the database isn't ready yet.

**Networking:** All containers share a single `ecommerce-network` bridge network (`driver: bridge`). Inside this network, containers address each other by service name (e.g., `http://user-service:8001`), not by IP address. This is why the environment variables use hostnames like `DB_HOST=mysql` and `REDIS_HOST=redis`.

**Named volumes** (`mysql_data`, `postgres_data`, `mongodb_data`, `redis_data`) persist database data across `docker-compose down` and `docker-compose up` cycles. Without named volumes, all data would be lost every time containers are restarted.

**Environment variables** are injected inline in the Compose file for local development. In production, the `docker-compose.prod.yml` (generated by the EC2 setup script) uses `env_file:` to load variables from `.env` files containing real RDS endpoints and secrets.

---

## 11. Cloud Hosting — AWS EC2

**Recommended:** Ubuntu 22.04, `t3.medium` (2 vCPU, 4 GB RAM)
**Storage:** 30 GB gp3 EBS volume

EC2 (Elastic Compute Cloud) provides resizable virtual machines on AWS. The entire Docker stack runs on a single EC2 instance, which is the deployment target for this project.

**How it is used here:**

The `infrastructure/ec2/setup-script.sh` automates the full instance setup: updating system packages, installing Docker Engine (CE) from Docker's official repository via GPG-verified apt, installing Docker Compose standalone, installing Node.js 18 via NodeSource for debugging, creating the application directory, and generating environment file stubs.

The script also generates a `docker-compose.prod.yml` (written to disk during setup) that references Docker Hub images (e.g., `${DOCKER_USERNAME}/user-service:latest`) rather than building locally — pulling pre-built images is faster and more reliable than building on the EC2 instance.

**Security groups** restrict inbound traffic: only ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) are open to the internet. RDS instances are in a separate security group that allows MySQL (3306) and PostgreSQL (5432) only from the EC2 instance's security group ID, blocking all public internet access to the databases.

**Instance sizing guidance** documented in `docs/DEPLOYMENT.md`:
- `t3.medium` — 2 vCPU, 4 GB RAM, ~$30/month: adequate for development and light production
- `t3.large` — 2 vCPU, 8 GB RAM, ~$60/month: recommended for sustained production traffic
- `t3.xlarge` — 4 vCPU, 16 GB RAM, ~$120/month: for high-traffic scenarios

---

## 12. Managed Databases — AWS RDS

**MySQL instance:** `db.t3.micro`, MySQL `8.0`, `users_db`
**PostgreSQL instance:** `db.t3.micro`, PostgreSQL `15`, `orders_db`

RDS (Relational Database Service) manages the operational overhead of running relational databases: automated backups (7-day retention), point-in-time restore, minor version patching, multi-AZ failover, and CloudWatch monitoring. This offloads the most failure-prone and time-consuming part of production database management.

**How it is used here:**

In production, the `DB_HOST` environment variables for the User Service (MySQL) and Order Service (PostgreSQL) point to the RDS endpoint hostnames (e.g., `ecommerce-mysql.xxxxx.us-east-1.rds.amazonaws.com`) rather than the Docker service names. The application code is identical — only the connection string changes.

Both RDS instances are created with `--publicly-accessible false`, meaning they have no public IP address and can only be reached from within the VPC. The EC2 instance's security group is granted inbound access to each RDS security group on the appropriate port.

The `docs/DEPLOYMENT.md` provides the AWS CLI commands to provision both instances, retrieve their endpoints, and set up the security group rules.

---

## 13. Object Storage — AWS S3

**AWS SDK version:** `^2.1520.0`
**Used by:** Product Service (`multer` + `aws-sdk`)

S3 (Simple Storage Service) is AWS's object storage service: infinitely scalable, durable (11 nines), and inexpensive. It stores product images and other static assets uploaded through the platform.

**How it is used here:**

The Product Service has `multer` and `aws-sdk` installed for handling file uploads and storing them in S3. `multer` is an Express middleware that parses `multipart/form-data` requests (the standard encoding for file uploads in HTML forms) and makes the uploaded file available at `req.file`. The service then uses the `AWS.S3` client to call `putObject` with the file buffer, content type, and a generated key (typically `products/<uuid>.<ext>`).

In production, the S3 bucket is configured with:
- **Versioning enabled** — allows recovery of accidentally overwritten or deleted objects
- **Block public access** — the bucket has no public bucket policy; images are accessed via pre-signed URLs that expire after a set duration
- **CORS** — configured to allow `GET`, `PUT`, `POST`, `DELETE` from the application's origin domain, required for browser-based file uploads using pre-signed PUT URLs

AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`) are passed as environment variables to the Product Service container.

---

## 14. CI/CD — GitHub Actions

**Workflow files:** `.github/workflows/ci.yml` (CI) and `.github/workflows/deploy.yml` (CD)

GitHub Actions is GitHub's built-in automation platform. Workflows are defined in YAML and triggered by repository events (push, pull request, manual dispatch).

**CI Pipeline (`ci.yml`)** — triggers on push or PR to `main` or `develop`. It runs four parallel jobs:

1. **`test`** — uses a matrix strategy over all five backend services. Each matrix cell: checks out code, sets up Node.js 18 with npm caching, runs `npm ci` (deterministic install from `package-lock.json`), runs `npm run lint` (ESLint), and runs `npm test` (Jest with coverage).

2. **`build`** — runs after `test` passes (via `needs: test`). Builds Docker images for all six components (five services + frontend) using `docker/build-push-action@v4` with GitHub Actions Cache (`cache-from: type=gha`) to reuse unchanged layers between runs. Images are not pushed to Docker Hub in this job — it's a build verification only.

3. **`lint-frontend`** — independently checks out and lints the React frontend with its own Node.js setup.

4. **`security-scan`** — runs **Trivy** (see section 32) against the full repository filesystem and uploads the SARIF results to the GitHub Security tab for review.

**CD Pipeline (`deploy.yml`)** — triggers on push to `main` or via `workflow_dispatch` (manual trigger). It runs one job:

1. Checks out code and sets up Docker Buildx.
2. Logs into Docker Hub using `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets.
3. Builds and pushes images for all six components to Docker Hub: `docker build -t $DOCKER_USERNAME/<service>:latest` then `docker push`.
4. SSHes into the EC2 instance using `appleboy/ssh-action@master` with the `EC2_HOST` and `EC2_SSH_KEY` secrets, then runs: `git pull`, `docker-compose pull`, `docker-compose down`, `docker-compose up -d`, `docker image prune -af`.
5. Runs smoke tests in a second SSH step — `curl -f http://localhost:<port>/health` for all five services — and exits with code 1 if any fail, making the deployment step fail and alerting the team.

---

## 15. HTTP Client — Axios

**Version:** `^1.6.5` (all five services)

Axios is a promise-based HTTP client for Node.js (and browsers). It is used for all inter-service HTTP calls within the microservice network.

**How it is used here:**

The **API Gateway** uses Axios in its `proxyRequest` helper to forward incoming requests to downstream services:

```js
const response = await axios({
  method, url: `${serviceUrl}${path}`,
  data, headers: { ...headers, 'Content-Type': 'application/json' },
  timeout: 30000
});
```

A 30-second timeout prevents the gateway from hanging indefinitely if a downstream service is unresponsive. If the request fails with an `error.response` (the downstream service returned an error status), the gateway re-throws the status and body so the client receives the original error. If the request fails without a response (network error, timeout), the gateway returns `503 Service Unavailable`.

The **Order Service** uses Axios to call the Product Service's `PATCH /api/products/:id/inventory` endpoint during order creation, cancellation, and deletion. A dedicated `adjustProductInventory(productId, change)` function wraps the Axios call and returns `{ success, error?, status? }` — a structured result rather than a raw exception — so the calling code can handle partial inventory roll-backs without a try-catch at every call site.

The **Order Service** also uses Axios to proxy review submissions to the Product Service (`POST /api/products/:id/reviews`) after validating that the reviewing user actually received the product.

---

## 16. Authentication — JSON Web Tokens (JWT)

**Library:** `jsonwebtoken ^9.0.2` (User Service, Order Service)
**Algorithm:** HS256 (HMAC-SHA256, symmetric signing)
**Expiry:** `7d` (configurable via `JWT_EXPIRY` environment variable)

JWTs are a compact, self-contained way to securely transmit claims between parties as a JSON object signed with a secret key. The token encodes a payload and is signed; the server can verify authenticity without a database lookup.

**How it is used here:**

On login or registration, the User Service calls `jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY })` and includes the resulting token in the response. The client stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on every subsequent request.

The **User Service `authenticate` middleware** does two things: it calls `jwt.verify(token, JWT_SECRET)` (which validates the signature and checks the `exp` claim), then checks Redis for `session:<token>` to confirm the session has not been explicitly logged out. Both checks must pass.

The **Order Service and Product Service** have lighter-weight JWT handling: they manually decode the token's middle segment (base64url-decoded JSON) without signature verification — a pragmatic decision since all traffic routes through the trusted internal Docker network where the gateway has already validated the token. The decoded payload provides the `userId`, `email`, and `role` needed for access control.

The **frontend AuthContext** parses the JWT payload client-side (no signature check, just decoding) to read the `exp` claim and display the user's name and role in the navigation.

---

## 17. Password Security — bcryptjs

**Library:** `bcryptjs ^2.4.3` (User Service)

bcrypt is a deliberately slow password hashing algorithm designed to be computationally expensive, making brute-force attacks infeasible even if the hash database is compromised. The `bcryptjs` package is a pure-JavaScript implementation that does not require native compilation.

**How it is used here:**

On registration, the User Service calls `bcrypt.hash(password, 10)` where `10` is the cost factor (salt rounds). This produces a 60-character hash that includes the algorithm identifier, cost factor, salt, and digest — everything needed to verify a future login in a single string.

On login, `bcrypt.compare(submittedPassword, storedHash)` is called. bcrypt extracts the salt from the stored hash, applies the same number of rounds to the submitted password, and compares the results in constant time (preventing timing attacks).

Plain-text passwords are never stored, logged, or included in any API response. The password column in MySQL stores only the bcrypt hash.

---

## 18. Input Validation — express-validator

**Version:** `^7.0.1` (all five services)

`express-validator` is an Express middleware wrapper around the `validator.js` library. It provides a declarative chain API for validating and sanitising request data.

**How it is used here:**

Validation chains are defined inline on route arrays before the handler function:

```js
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body('name').trim().isLength({ min: 2 })
], authController.register);
```

A shared `validateRequest` middleware is applied after the chain:

```js
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};
```

`validationResult(req)` collects all validation failures accumulated by the chain. If any exist, the handler never runs — the request is rejected immediately with a structured `400` response listing every failing field and the reason. This ensures that no malformed data reaches the database or business logic.

`param()` validators protect `:id` path parameters (e.g., `param('id').isInt({ min: 1 })`), preventing string injection into integer-expecting database queries. `query()` validators sanitise pagination parameters (`isInt({ min: 1 }).toInt()` converts the string query param to a real integer and rejects non-numeric values).

---

## 19. Security Middleware — Helmet.js

**Version:** `^7.1.0` (all five services)

Helmet is a collection of Express middleware functions that set HTTP security headers, protecting against common web vulnerabilities with minimal configuration.

**How it is used here:**

`app.use(helmet())` is the first middleware applied in every service's middleware chain, before `cors()`, `express.json()`, or any route handler. This ensures security headers are set on every response including error responses.

The headers set by the default `helmet()` configuration include:
- `Content-Security-Policy` — restricts which sources the browser can load scripts, styles, and other resources from
- `X-Frame-Options: SAMEORIGIN` — prevents the page from being embedded in an iframe on a different origin (clickjacking protection)
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing, ensuring browsers respect the declared `Content-Type`
- `Strict-Transport-Security` — instructs browsers to use HTTPS for all future requests to this domain (once HTTPS is configured)
- `X-XSS-Protection: 0` — disables the old browser XSS filter (Helmet intentionally turns this off because it can introduce vulnerabilities in some browsers)
- `Referrer-Policy: no-referrer` — prevents the `Referer` header from leaking URL information to third-party origins

---

## 20. Logging — Winston

**Version:** `^3.11.0` (all five services)

Winston is the most widely used structured logging library for Node.js. It supports multiple transports (destinations), log levels, and formats.

**How it is used here:**

Each service has its own `src/utils/logger.js` that creates a Winston logger instance. The format pipeline combines:

```js
winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),   // includes stack traces on Error objects
  winston.format.splat(),                    // printf-style string interpolation
  winston.format.json()                      // serialises the log entry as JSON
)
```

In development (`NODE_ENV !== 'production'`), the Console transport uses a custom formatter that produces human-readable colourised output: `2026-01-15 14:23:01 [user-service] info: MySQL connection pool created`. In production, two File transports are added: `logs/error.log` for `error` level and above, and `logs/combined.log` for all levels. Both rotate at 5 MB with a maximum of 5 files.

`defaultMeta: { service: 'user-service' }` stamps every log entry with the service name, so when logs are aggregated to CloudWatch or a log management system, the source service is immediately identifiable.

Usage across services follows a consistent pattern: `logger.info('message')`, `logger.error('message', errorObject)`, `logger.warn('message')`. Error objects with stack traces are logged at the `error` level; normal operational events at `info`.

---

## 21. ODM — Mongoose

**Version:** `^8.0.3` (Product Service, Order Service)

Mongoose is an Object Document Mapper (ODM) for MongoDB and Node.js. It provides schema definition, validation, type casting, and middleware hooks on top of the native `mongodb` driver.

**How it is used here:**

In the **Product Service**, Mongoose provides the `Product` model with schema-level constraints (required fields, string length limits, numeric minimums, enum categories), a `pre('save')` middleware hook that recalculates the rating aggregate, and compound text + field indexes that are created automatically when the model is first used.

`mongoose.connect(mongoUri)` establishes the connection. Event listeners on `mongoose.connection` for `'error'` and `'disconnected'` log warnings via Winston so connection failures are visible in the logs.

`Product.find(query).sort(...).skip(...).limit(...).lean()` is the standard pattern for paginated product listings. `.lean()` returns plain JavaScript objects instead of Mongoose Document instances, which is faster (no hydration overhead) and appropriate for read-only responses.

In the **Order Service**, Mongoose connects to a separate `orders_db` database in the same MongoDB instance for the soft-delete and restoration workflow. The `Order` Mongoose model here defines the extended order schema with soft-delete fields (`isDeleted`, `deletedAt`, `deletionExpiresAt`, `restorationRequestedAt`, `restorationReason`).

---

## 22. PostgreSQL Driver — node-postgres (pg)

**Version:** `^8.11.3` (Order Service)
**Companion:** `pg-hstore ^2.3.4`

`pg` is the most widely used PostgreSQL client for Node.js. It provides connection pooling, parameterised queries, and transaction support.

**How it is used here:**

`new Pool({ ... })` creates a connection pool with `max: 20` connections, `idleTimeoutMillis: 30000` (connections idle for 30 seconds are closed), and `connectionTimeoutMillis: 2000` (acquiring a connection times out after 2 seconds).

Every route handler that needs database access calls `pool.connect()` to borrow a connection from the pool, performs its queries, and calls `client.release()` in the `finally` block — guaranteeing the connection is returned even if the handler throws. Multi-step operations (order creation, cancellation approval) bracket their queries in `BEGIN`/`COMMIT`/`ROLLBACK` for ACID atomicity.

Parameterised queries use `$1`, `$2`, etc. as positional placeholders:

```js
await client.query(
  'INSERT INTO orders (user_id, total_amount, ...) VALUES ($1, $2, ...)',
  [userId, totalAmount, ...]
);
```

`pg-hstore` is a companion package that serialises/deserialises PostgreSQL `hstore` key-value types to JavaScript objects. It is listed as a dependency for potential use with `hstore` columns (the project currently uses `JSONB` and `TEXT` for structured data, but `pg-hstore` is a common pairing with `pg`).

---

## 23. MySQL Driver — mysql2

**Version:** `^3.6.5` (User Service)

`mysql2` is the modern MySQL client for Node.js, fully compatible with `mysql` (v1) but with Promise support, prepared statements, and improved performance.

**How it is used here:**

`mysql.createPool({ ..., waitForConnections: true, connectionLimit: 10 })` creates a pool of up to 10 MySQL connections. `waitForConnections: true` queues requests if all connections are in use rather than failing immediately. `enableKeepAlive: true` sends TCP keepalive packets to prevent idle connections from being silently dropped by the RDS connection timeout.

`pool.getConnection()` is used at startup to acquire a connection for table initialisation, then `connection.release()` returns it to the pool. For normal request handling, `pool.execute(sql, params)` (prepared statement shortcut) and `pool.query(sql, params)` are used directly on the pool — the pool internally acquires, uses, and releases a connection.

---

## 24. Task Scheduling — node-cron

**Version:** `^3.0.3` (Order Service)

`node-cron` runs functions on a cron schedule within the Node.js process. It uses standard cron syntax (`* * * * *` — minute, hour, day, month, weekday).

**How it is used here:**

The Order Service uses `node-cron` to schedule the nightly cleanup of permanently expired deleted orders:

```js
cron.schedule('0 2 * * *', async () => {
  const result = await Order.deleteMany({
    isDeleted: true,
    deletionExpiresAt: { $lt: new Date() }
  });
  logger.info(`Cleanup: permanently deleted ${result.deletedCount} orders`);
});
```

This runs at 2:00 AM every day, permanently removing soft-deleted orders whose 30-day restoration window has expired. Running at an off-peak hour minimises the impact on database performance.

The Analytics Service's daily counter reset (`/api/analytics/reset/daily`) is designed to be called by a similar scheduled job (or an external cron managed via `crontab` on the EC2 instance, calling the endpoint at midnight).

---

## 25. File Uploads — Multer

**Version:** `^1.4.5-lts.1` (Product Service)

Multer is Express middleware for handling `multipart/form-data` — the encoding type used for HTML file upload forms.

**How it is used here:**

The Product Service uses Multer to process product image uploads. Multer intercepts the `multipart/form-data` request, buffers the uploaded file(s) in memory, and attaches them to `req.file` (single file) or `req.files` (multiple files). The route handler then reads `req.file.buffer` and `req.file.mimetype` to construct an S3 `putObject` call.

Memory storage (`multer.memoryStorage()`) is used rather than disk storage, since the file is immediately forwarded to S3 without needing to persist it on the container's filesystem — appropriate for a stateless container environment.

---

## 26. AWS SDK

**Version:** `^2.1520.0` (Product Service, v2 SDK)

The AWS SDK for JavaScript (v2) provides clients for every AWS service. Version 2 uses a callback/promise API and is a single monolithic package.

**How it is used here:**

The Product Service creates an `AWS.S3` client configured with `region`, `accessKeyId`, and `secretAccessKey` from environment variables. It uses `s3.putObject({ Bucket, Key, Body, ContentType })` to upload product images. `s3.getSignedUrl('getObject', { Bucket, Key, Expires })` generates time-limited pre-signed URLs so the frontend can display images without exposing the bucket publicly.

---

## 27. Data Visualisation — Recharts

**Version:** `^2.10.3` (Frontend)

Recharts is a composable chart library built on top of React and D3. It provides declarative React components for common chart types.

**How it is used here:**

The Dashboard page uses Recharts to display the revenue and order trend data fetched from the Analytics Service. The composable API means charts are built by nesting components:

```jsx
<LineChart data={revenueData}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
</LineChart>
```

Recharts handles all SVG rendering, axis scaling, tooltip positioning, and responsive resizing via the `ResponsiveContainer` wrapper.

---

## 28. Icon Library — react-icons

**Version:** `^5.0.1` (Frontend)

`react-icons` bundles icons from over 40 popular icon sets (Font Awesome, Material Icons, Feather, etc.) as individual React components. Only the icons actually imported are included in the final bundle (tree-shaking).

**How it is used here:**

Icons are used throughout the UI for navigation links, action buttons, status badges, and empty-state illustrations — replacing the need for an icon font (which would load all glyphs regardless of usage) or custom SVG files.

---

## 29. Routing — react-router-dom

**Version:** `^6.21.1` (Frontend)

React Router v6 is the standard client-side routing library for React SPAs. It renders different components based on the current URL without triggering a full page reload.

**How it is used here:**

The app is wrapped in `<BrowserRouter>` (inside `AuthProvider`). `<Routes>` and `<Route>` components map URL paths to page components. The `AuthContext`'s `isAuthenticated` state gates rendering: unauthenticated users see only the `<LoginPage />`, and authenticated users see the `<MainLayout />` which contains the navigation sidebar and a nested `<Routes>` block for all protected pages.

`useNavigate()` hooks are used in the login and logout handlers to programmatically redirect after authentication state changes. `<Link>` components replace standard `<a>` tags for in-app navigation to prevent full page reloads.

---

## 30. External Image API — Unsplash

**Integration type:** REST API (client-side fetch from browser)
**Endpoint:** `https://api.unsplash.com/search/photos`
**Authentication:** `Authorization: Client-ID <access_key>` header

Unsplash provides a free API for high-quality, royalty-free photography. It is used to dynamically source contextually relevant product images.

**How it is used here:**

`src/services/imageService.js` defines an `ImageService` class. Its `getProductImage(productName, category, width, height)` method:

1. Checks an in-memory `Map` cache keyed by `"${productName}-${category}-${width}x${height}"` — if a URL was already fetched for this combination, it returns it instantly.
2. If Unsplash is configured (`UNSPLASH_ACCESS_KEY` is set and not the placeholder), it calls `fetchFromUnsplash()` which builds a search query from the product name and category (e.g., `"laptop computer electronics"`), fetches from the Unsplash Search Photos endpoint, and extracts the `urls.regular` field with `?w=${width}&h=${height}&fit=crop` appended.
3. If Unsplash is not configured or the request fails, it falls back to `generatePlaceholder()` which produces a deterministic `https://via.placeholder.com/{width}x{height}` URL.
4. Caches and returns the URL.

A `LazyProductImage` React component is also exported, which renders the image with a skeleton loading animation (CSS `@keyframes` gradient sweep) while the async URL fetch is in progress.

---

## 31. Development Tools

### Nodemon (`^3.0.2`)
Nodemon is a development-time wrapper for Node.js that watches the `src/` directory for file changes and automatically restarts the server. The `dev` npm script in every service runs `nodemon src/index.js`. This eliminates the need to manually stop and restart the server after every code change.

### ESLint (`^8.56.0`)
ESLint statically analyses JavaScript for potential errors and style inconsistencies. Every service has `lint` and `lint:fix` npm scripts. ESLint rules are defined per-service (`.eslintrc` or `eslintConfig` in `package.json`). The CI pipeline runs `npm run lint` as part of the test job.

### Jest (`^29.7.0`)
Jest is the testing framework used across all backend services. The `test` npm script runs `jest --coverage`, which executes all `*.test.js` files and produces a coverage report. `supertest ^6.3.3` is the companion library that allows testing Express routes without starting a real HTTP server — it creates an in-process HTTP server and sends requests directly.

### `npm ci`
The CI pipeline uses `npm ci` instead of `npm install` for dependency installation. `npm ci` installs exactly the versions in `package-lock.json` (deterministic), fails if `package-lock.json` is out of sync with `package.json`, and is faster than `npm install` in CI because it skips lockfile resolution.

### `dotenv` (`^16.3.1`)
`dotenv` reads `.env` files and populates `process.env` at runtime. Every service calls `require('dotenv').config()` as its first statement. In Docker, environment variables are injected by Compose, so `.env` files are not used inside containers — `dotenv` simply has no file to read and falls back to the existing `process.env` values, making it safe to call regardless.

---

## 32. Security Scanning — Trivy

**GitHub Action:** `aquasecurity/trivy-action@master`
**Scan type:** Filesystem (`fs`)
**Output format:** SARIF (GitHub Security tab integration)

Trivy is an open-source vulnerability scanner that detects known CVEs in OS packages, language-specific dependencies (npm, pip, gem, etc.), and infrastructure-as-code files. It is maintained by Aqua Security.

**How it is used here:**

The `security-scan` job in `ci.yml` runs Trivy against the entire repository filesystem on every push:

```yaml
- uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'

- uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

Trivy scans all `package.json` / `package-lock.json` files in the repository, cross-references every dependency version against the National Vulnerability Database (NVD) and GitHub Advisory Database, and outputs findings in SARIF format. The `upload-sarif` action uploads results to the GitHub Security tab's "Code scanning alerts" view, where findings are annotated by file, severity, and CVE ID. This gives the team a continuous view of dependency vulnerabilities without a separate security tooling subscription.

---

## Dependency Matrix

| Technology | Version | Services |
|---|---|---|
| Node.js | 18 LTS | All 5 services, Frontend |
| Express.js | ^4.18.2 | All 5 services |
| React | ^18.2.0 | Frontend |
| MySQL | 8.0 | User Service (via RDS in prod) |
| PostgreSQL | 15 | Order Service (via RDS in prod) |
| MongoDB | 7.0 | Product Service, Order Service |
| Redis | 7-alpine | All 5 services |
| Nginx | alpine | Reverse proxy container |
| mysql2 | ^3.6.5 | User Service |
| pg | ^8.11.3 | Order Service |
| mongoose | ^8.0.3 | Product, Order Services |
| redis (client) | ^4.6.12 | All 5 services |
| jsonwebtoken | ^9.0.2 | User, Order Services |
| bcryptjs | ^2.4.3 | User Service |
| express-validator | ^7.0.1 | All 5 services |
| helmet | ^7.1.0 | All 5 services |
| winston | ^3.11.0 | All 5 services |
| axios | ^1.6.5 | All 5 services |
| node-cron | ^3.0.3 | Order Service |
| multer | ^1.4.5-lts.1 | Product Service |
| aws-sdk | ^2.1520.0 | Product Service |
| dotenv | ^16.3.1 | All 5 services |
| recharts | ^2.10.3 | Frontend |
| react-router-dom | ^6.21.1 | Frontend |
| react-icons | ^5.0.1 | Frontend |
| nodemon | ^3.0.2 | All (devDependency) |
| jest | ^29.7.0 | All (devDependency) |
| supertest | ^6.3.3 | All (devDependency) |
| eslint | ^8.56.0 | All (devDependency) |

---

*Last updated: February 2026*