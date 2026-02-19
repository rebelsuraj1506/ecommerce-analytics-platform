# 🛍️ E-Commerce Analytics Platform — Feature Reference

A complete description of every feature available in the platform, organized by domain. The platform follows a microservices architecture: each capability is owned by a dedicated service (User, Product, Order, Analytics, API Gateway) and surfaced through a React.js admin/customer dashboard.

---

## 1. Authentication & Session Management

### User Registration
New accounts are created via `POST /api/auth/register`. The request is validated server-side: email format, password strength (minimum 8 characters, must include uppercase, lowercase, digit, and special character), and name length. Roles at registration time can be `customer` (default) or `admin`.

### Login & JWT Issuance
`POST /api/auth/login` validates credentials, compares the submitted password against a `bcrypt`-hashed value stored in MySQL, and returns a signed JWT on success. The token encodes the user's ID, email, and role, and is used as a Bearer token on all subsequent authenticated requests.

### Token Refresh
`POST /api/auth/refresh` accepts a valid (or recently expired) token and issues a new one, allowing sessions to persist across browser sessions without requiring the user to log in again.

### Persistent Authentication (Frontend)
The React frontend uses an `AuthContext` provider that reads the JWT from `localStorage` on page load. As long as the token is valid, the user stays logged in across page refreshes and new tabs. Logout in one tab propagates to all open tabs via a storage event listener.

### Logout
`POST /api/auth/logout` invalidates the server-side session reference (via Redis) and the frontend clears all auth state and local storage.

### Current User Profile Fetch
`GET /api/auth/me` returns the authenticated user's profile without requiring a database round-trip — the user data is decoded from the JWT and returned directly.

### Role-Based Access Control (RBAC)
Every protected endpoint checks the `role` claim in the JWT. The platform has three roles: `customer`, `merchant`, and `admin`. Admin-only endpoints (user management, order deletion, analytics, status updates, cancellation approval) respond with `403 Forbidden` when accessed by non-admins.

---

## 2. User Management (Admin)

### List All Users
Admins can retrieve a paginated list of all registered users via `GET /api/users`. Results include user ID, name, email, role, and creation timestamp.

### Create User Manually
`POST /api/users` lets admins create accounts directly — useful for seeding test data or onboarding staff — with full validation of email, password strength, and role.

### View User Details
`GET /api/users/:id/details` returns enriched profile data for a specific user, visible only to admins.

### Update User
`PUT /api/users/:id` allows updating name and email for any user account (admin action). Users can also update their own profiles via the Profile feature.

### Update User Role
`PATCH /api/users/:id/role` lets admins promote or demote a user's role between `customer`, `merchant`, and `admin`.

### Delete User
`DELETE /api/users/:id` permanently removes a user account. A separate bulk endpoint `DELETE /api/users/all` wipes all users (intended for development resets).

### Search, Sort & Filter (Admin Panel UI)
The AdminPanel page in the frontend includes a live search bar that filters the user list by name or email, and a sort control to order by most recent, oldest, or alphabetical.

---

## 3. User Profile & Address Book

### View & Edit Profile
`GET /api/users/profile` returns the authenticated user's full profile. `PUT /api/users/profile` lets users update their display name and phone number. Password changes are supported via the same endpoint using the existing password for verification and a strength-validated new password.

### Address Management
Users can maintain a personal address book with full CRUD:
- `GET /api/users/addresses` — list all saved addresses
- `POST /api/users/addresses` — add a new address (street, city, state, zip code, phone)
- `PUT /api/users/addresses/:id` — edit an existing address
- `DELETE /api/users/addresses/:id` — remove an address
- `PUT /api/users/addresses/:id/default` — mark one address as the default (the system enforces that only one address per user can be the default at a time)

The frontend Profile page presents these as a tabbed interface — one tab for personal info and one for the address book — with a responsive card grid for addresses. Default addresses are visually marked with a green badge.

---

## 4. Product Catalog

### Browse Products
`GET /api/products` returns a paginated product list with support for `page` and `limit` query parameters. Publicly accessible — no token required for browsing.

### Get Single Product
`GET /api/products/:id` returns full product details including name, description, price, inventory count, category, tags, and any submitted reviews.

### Create Product (Admin)
`POST /api/products` creates a new product. Required fields: name, description, price, inventory, and category. Tags are optional. Products are stored in MongoDB for schema flexibility.

### Update Product (Admin)
`PUT /api/products/:id` allows full replacement of product data. All fields from the creation schema are accepted.

### Inventory Adjustment
`PATCH /api/products/:id/inventory` accepts a signed `change` value — negative to deduct, positive to restore. This endpoint is called internally by the Order Service when orders are placed, cancelled, or deleted, ensuring stock levels stay accurate. It enforces that inventory never drops below zero (returns an "insufficient stock" error, which the Order Service surfaces to the user as "This item is sold out. Will be back soon.").

### Delete Product (Admin)
`DELETE /api/products/:id` removes a product from the catalog.

### Product Reviews
`POST /api/products/:id/reviews` allows users to submit a rating (1–5 stars) and optional comment for a product. Reviews are stored on the product document in MongoDB. The Order Service validates that the reviewing user actually received the product (order must be in `delivered` status and must contain the reviewed product ID) before proxying the review to the Product Service. Each user can review a given product from a given order only once.

### Category Management
`GET /api/categories` returns a flat list of all product categories derived from the products stored in MongoDB. Categories are used for product filtering and organization in the frontend.

### Dynamic Product Images (Unsplash Integration)
The frontend `imageService.js` fetches contextually relevant images from the Unsplash API using the product name and category as search terms. Results are cached in memory to avoid redundant API calls during a session. If the Unsplash API key is not configured or the request fails, the service falls back to a deterministic placeholder image so the UI always renders gracefully. Images use a skeleton loading animation while fetching.

---

## 5. Order Management

### Place an Order
`POST /api/orders` creates a new order. The request includes an `items` array (product ID, name, quantity, price), a payment method, and a full shipping address with phone number. Before the order is persisted, the Order Service contacts the Product Service to atomically deduct inventory for each item. If any item has insufficient stock, already-deducted items are rolled back and the order is rejected with a clear error. Orders are inserted into PostgreSQL inside a transaction with `inventory_deducted = true`.

### Per-User Sequential Order Numbers
Each order is assigned both a global integer `id` and a `userOrderNumber` — a sequential counter scoped to that user (order #1, #2, #3 for each customer). This gives customers a friendly order reference independent of the global database ID.

### Supported Payment Methods
The platform accepts: `credit_card`, `debit_card`, `paypal`, `cash`, `cod`, `card`, `upi`, `netbanking`, and `wallet`.

### List Orders
`GET /api/orders` returns paginated orders. For customers, only their own orders are returned. For admins, all orders across all users are returned. Supports optional `status` filtering and configurable `page`/`limit` parameters.

### Order Details
`GET /api/orders/:id` returns full order details including items, shipping address, payment method, all timestamps, tracking info, cancellation data, and refund status. Access rules for cancelled or deleted orders are enforced (see the Retention Policy section below).

### Order Status Lifecycle
Admins update order status via `PUT /api/orders/:id/status`. Valid transitions and the timestamps they record are:

| Status | Timestamp Recorded |
|---|---|
| `pending` | `created_at` (set at order creation) |
| `processing` | `processing_at` |
| `shipped` | `shipped_at` + optional `tracking_number`, `courier_name`, `estimated_delivery` |
| `out_for_delivery` | `out_for_delivery_at` |
| `delivered` | `delivered_at` |
| `cancelled` | `cancelled_at` + optional `cancellation_reason` |
| `refund_processing` | `refund_processing_at` |
| `refunded` | `refunded_at` |

When an order is moved to `cancelled`, the service automatically restores product inventory (if `inventory_deducted` is true and the order wasn't already delivered/refunded), then sets `inventory_deducted = false` to prevent double-restores.

### Order Tracking Timeline
`GET /api/orders/:id/tracking` returns a structured timeline of all status transitions for an order, with the timestamp of each step. This powers the delivery tracking view in the frontend ("Order Placed → Processing → Shipped → Out for Delivery → Delivered").

### Cancellation Request Flow
Customers submit a cancellation request via `POST /api/orders/:id/cancel-request` with a required reason and optional image attachments. Cancellations are permitted for orders in `pending` or `processing` status, or within **7 days of delivery** (post-delivery return window). The order moves to `cancel_requested` status pending admin review.

Admins can then:
- **Approve** via `PUT /api/orders/:id/approve-cancel` — sets status to `cancelled`, records the approving admin's ID and timestamp, initiates refund flow (`refund_status = pending`), and restores inventory.
- **Reject** via `PUT /api/orders/:id/reject-cancel` — reverts status to `processing` with a rejection reason and records the rejecting admin's ID and timestamp.

### Soft Delete (Admin)
`DELETE /api/orders/:id` performs a soft delete: the order's status is set to `deleted`, `deleted_at` and `deleted_by` (admin ID) are recorded, and a `deletion_reason` can be attached. Inventory is restored if applicable. The order record is retained in the database and the customer can still request access to it for 30 days (see Retention Policy).

### User-Facing Soft Delete
Customers can also soft-delete their own orders via `DELETE /api/orders/:id/soft`. This is the MongoDB-backed deletion flow defined in the `orderDeletion` routes, which maintains a separate restoration request lifecycle (see below).

### Order Restoration Requests (User-Initiated)
After a customer soft-deletes an order, they can request restoration via `POST /api/orders/:id/restore-request` (must be submitted within 30 days). Admins view pending requests at `GET /api/orders/restoration-requests`, and can approve via `POST /api/orders/:id/restoration/approve` or reject via `POST /api/orders/:id/restoration/reject` with an optional rejection reason.

### Order Detail Requests (30-Day Retention Policy)
After an order is cancelled or admin-deleted, full order details (items, shipping address, images) are hidden from the customer. The customer can submit a detail access request via `POST /api/orders/:id/detail-request` within **30 days** of the cancellation or deletion. Valid request reasons are a controlled set: "Need invoice / billing proof", "Warranty / service claim", "Bank / payment dispute", "Return / replacement reference", "Tax / accounting", or "Other" (with a free-text `otherReason` field). Admins review these requests at `GET /api/orders/detail-requests/list` and can approve or reject them via `PUT /api/orders/detail-requests/:requestId/:action`, with an optional admin note. Once approved, the order details become visible to the customer again.

### Inventory Sync Utilities (Admin)
Two admin-only utility endpoints handle historical data corrections:
- `POST /api/orders/sync-inventory` — for orders placed before inventory deduction was implemented. Deducts quantities from products for all orders with `inventory_deducted = false`, then marks them synced. Reports counts of synced, skipped, and errored orders.
- `POST /api/orders/undo-sync-inventory` — reverses a sync run (e.g. if it was run multiple times and zeroed inventory). Restores inventory for all `inventory_deducted = true` orders. After undoing, `sync-inventory` can be safely re-run once.

### Bulk Order Deletion (Admin Panel UI)
The Admin Panel frontend provides checkbox selection across the order list and a "Delete Selected" action that deletes multiple orders in a single interaction.

---

## 6. Analytics

### Dashboard Metrics
`GET /api/analytics/dashboard` returns an aggregated snapshot of platform health: total order count, total revenue (excluding cancelled/refunded orders), units sold, and a breakdown of orders and revenue by status. The frontend refreshes this data automatically every 15 seconds.

### Revenue Analytics
`GET /api/analytics/revenue?period=7d` returns revenue data broken down over a specified time window, suitable for populating trend charts. Supported periods include `7d` and can be extended.

### Order Tracking (Event Ingestion)
`POST /api/analytics/track/order` accepts an order event payload and writes counters and aggregates to Redis. This is called by the Order Service whenever an order is created, allowing real-time analytics updates without polling the database.

### Daily Reset
`POST /api/analytics/reset/daily` clears the daily analytics keys in Redis. Intended to be called by a scheduled job at midnight to start a fresh daily counter.

### Frontend Dashboard Charts
The React Dashboard page visualises analytics data using Recharts:
- **KPI cards** — total orders, total revenue (formatted with Indian locale number formatting), total units sold, and counts per status.
- **Status breakdown** — orders grouped by status (pending, processing, shipped, out for delivery, delivered, cancelled, refund processing, refunded) with associated revenue per group.
- **Order list view** — the dashboard also doubles as an order management table. Admins can switch between a summary view and a status-filtered view, see shipping addresses, and delete orders directly from the table with a confirmation dialog.

---

## 7. API Gateway

### Unified Entry Point
All client traffic should be routed through the API Gateway on port 8000. The gateway proxies requests to the appropriate microservice based on the URL prefix: `/api/auth*` and `/api/users*` → User Service, `/api/products*` and `/api/categories*` → Product Service, `/api/orders*` → Order Service, `/api/analytics*` → Analytics Service.

### Rate Limiting
The gateway enforces a rate limit of **100 requests per 15-minute window** per IP address, backed by Redis for distributed counter storage. Requests that exceed the limit receive a `429 Too Many Requests` response. The window duration and max requests are configurable via environment variables (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`).

### Request Logging
Every request passing through the gateway is logged with method, URL, status code, and response time, providing a central audit trail.

### Health Check
`GET /health` on the gateway (and on each individual service) returns a `200 OK` with a status payload. These endpoints are used by Docker health checks to determine container readiness and are the basis for the `docker-compose ps` status column.

---

## 8. Frontend Application

### Login Page
The entry point when unauthenticated. Collects email and password, calls the login API, stores the JWT, and transitions to the main layout. Displays validation errors and API error messages inline.

### Main Navigation (Role-Aware)
The sidebar navigation adapts based on the authenticated user's role. Customers see: Dashboard, My Orders, Products, and My Profile. Admins additionally see: Orders (full admin view), Users (Admin Panel), and Analytics controls.

### Dashboard Page
Displays real-time KPIs and a live-refreshing (every 15s) order table. Admins can view all orders; customers see only their own. Includes status filter tabs, badge-coloured status pills, shipping address display, and per-order delete actions with a confirmation modal.

### My Orders Page
A customer-facing order history page. Shows each order's sequential number, items purchased, total, status badge, shipping address (street, city, state, phone), and all cancellation/refund fields. Supports requesting cancellation for eligible orders and submitting detail requests for cancelled or deleted orders with a reason picker.

### Orders Page (Admin)
A full admin-facing order management table with status filtering, bulk selection, bulk delete, inline status update controls, cancellation approval/rejection buttons, and a detail-request review panel.

### Products Page
Displays the product catalog with dynamic Unsplash images. Admins see Create, Edit, and Delete controls per product. All users can see product name, category, price, and inventory. Product forms include all fields with client-side validation.

### Categories Page
Lists all product categories with their associated product counts. Provides a quick navigation into category-filtered product views.

### Admin Panel Page
A tabbed admin-only page with three views: Users, Orders (with filtering and bulk delete), and a Detail Requests queue. The Users tab supports live search, sort, role display, user detail drill-down, manual user creation, role change, and deletion. The Add User sub-view presents a form with full validation matching the backend's rules.

### User Profile Page
A tabbed profile management page. The "Personal Info" tab shows current name, email, and phone with an edit form and a separate password change form (requiring the current password). The "Addresses" tab shows saved addresses as cards in a responsive grid, with add, edit, delete, and set-default actions. Default addresses are highlighted with a green border and badge.

### Toast Notifications
All user-initiated actions (order placed, product created, cancellation submitted, etc.) display a non-blocking toast notification that auto-dismisses after 3 seconds. Toasts have `info`, `success`, and `error` variants with appropriate colour coding.

### Back to Top Button
A floating scroll-to-top button appears when the user scrolls down on long pages, providing a one-click return to the top of the page.

---

## 9. Security

### Password Hashing
All passwords are hashed with `bcrypt` before storage. Plain-text passwords are never persisted or logged.

### JWT Authentication
Tokens are signed with a server-side `JWT_SECRET`. The User Service verifies the signature and expiry on every protected request. The token payload is minimal (user ID, email, role) to limit exposure.

### Helmet.js
All Express services use `helmet()` middleware, which sets a collection of security-related HTTP response headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, etc.) on every response.

### CORS Protection
CORS is configured explicitly on every service with an allowed origins whitelist controlled via the `CORS_ORIGIN` environment variable, preventing cross-site requests from unexpected origins.

### Input Validation
`express-validator` is used at every route that accepts user input. Validation errors are collected and returned as structured `400 Bad Request` responses with an `errors` array — never passed raw to a database query.

### SQL Injection Prevention
All PostgreSQL queries use parameterised queries via the `pg` driver (`$1`, `$2` placeholders). No string interpolation is used in query construction.

### Rate Limiting
The API Gateway enforces per-IP rate limits backed by Redis to mitigate brute-force and abuse scenarios.

### Environment Variable Management
All secrets (JWT secret, database passwords, AWS credentials) are managed via `.env` files excluded from version control. `.env.example` files document the required variables without exposing values.

---

## 10. Infrastructure & DevOps

### Docker Containerisation
Every service, database, and the frontend has its own `Dockerfile`. Images are lightweight Node.js Alpine-based builds for the services and a multi-stage React build for the frontend.

### Docker Compose (Local)
`docker-compose.yml` defines and wires all containers: MySQL, PostgreSQL, MongoDB, Redis, the five Node.js services, the React frontend, and Nginx — all connected via a shared `ecommerce-network` bridge network with named volumes for data persistence.

### Nginx Reverse Proxy
Nginx runs on port 80 and routes traffic to the appropriate container by path prefix. It serves as the single public-facing entry point in production and handles connection keep-alive and basic load distribution.

### AWS EC2 Deployment
The application is designed to run on a single EC2 instance (Ubuntu 22.04, t3.medium recommended). An `infrastructure/ec2/setup-script.sh` installs Docker, Docker Compose, and all prerequisites. A `user-data.sh` script can automate setup at instance launch.

### AWS RDS
MySQL (for the User Service) and PostgreSQL (for the Order Service) run as managed RDS instances in production. RDS handles automated backups, snapshots, and multi-AZ failover. The containers connect to RDS endpoints via environment variables, with security groups restricting inbound access to the EC2 instance only.

### AWS S3
Product images and static assets are stored in S3 with versioning enabled. Access is via pre-signed URLs (bucket public access is blocked). CORS is configured on the bucket to allow `PUT`/`GET` from the application origin.

### Terraform
`infrastructure/terraform/` contains Infrastructure as Code for provisioning the EC2 instance, RDS instances, S3 bucket, VPC, security groups, and IAM roles. Running `terraform apply` reproduces the full AWS environment from scratch.

### GitHub Actions CI/CD
`.github/workflows/` defines automated pipelines:
- **On push / pull request**: linting and unit tests run for all services.
- **On merge to `main`**: Docker images are built, tagged, and pushed to Docker Hub, then the EC2 instance is SSHed into and `docker-compose pull && docker-compose up -d` is executed.

Required GitHub Secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `EC2_HOST`, `EC2_SSH_KEY`.

### Structured Logging
All services use **Winston** for structured JSON logging. Request/response cycles, database connection events, errors, and service-specific events (order created, inventory deducted, analytics tracked) are all logged with consistent severity levels.

### Health Checks
Every service exposes `GET /health`. Docker Compose configures health checks for all database containers (MySQL `mysqladmin ping`, PostgreSQL `pg_isready`) and waits for them to pass before starting dependent services, preventing race conditions on startup.

---

## 11. Scaling & Production Considerations

### Horizontal Scaling
Multiple EC2 instances can be placed behind an AWS Application Load Balancer (ALB). Redis-backed sessions (rather than in-process state) ensure that any instance can serve any request.

### Read Replicas
RDS read replicas can be provisioned for MySQL and PostgreSQL to offload read-heavy workloads from the primary instance.

### CDN for Static Assets
S3 can be paired with CloudFront to serve product images and frontend assets from edge locations globally, reducing latency and EC2 egress costs.

### Connection Pooling
PostgreSQL connections use `pg.Pool` to reuse database connections across requests, preventing connection exhaustion under load.

### CloudWatch Monitoring
The deployment guide includes steps to install and configure the CloudWatch agent on EC2 for metric collection, log shipping, and alerting on anomalies.

---

*Last updated: February 2026*