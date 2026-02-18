const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const connectDB = async () => {
  try {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    logger.info('PostgreSQL connection pool created');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(100) NOT NULL,
        product_name VARCHAR(255),
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        transaction_id VARCHAR(255) UNIQUE,
        payment_method VARCHAR(50),
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add tracking and cancellation columns if they don't exist (for existing DBs)
    const alterColumns = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(255)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_images JSONB DEFAULT '[]'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_approved_by INTEGER`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_rejected BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_rejection_reason TEXT`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_rejected_by INTEGER`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_rejected_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_processing_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT false`,
      // Soft-delete + retention / access-control for order details
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by INTEGER`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS deletion_reason TEXT`,
      // Per-user sequential order number (starts at 1 for each user's first order)
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_order_number INTEGER`
    ];

    // First, add all the columns
    for (const sql of alterColumns) {
      await client.query(sql);
    }

    // Then backfill user_order_number for any existing orders that don't have it yet
    await client.query(`
      UPDATE orders o
      SET user_order_number = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
        FROM orders
        WHERE user_order_number IS NULL
      ) sub
      WHERE o.id = sub.id
    `);

    // Order detail requests (user requests details within 30 days; admin approves/rejects)
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_detail_requests (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        reason VARCHAR(255) NOT NULL,
        other_reason TEXT,
        status VARCHAR(20) DEFAULT 'pending', -- pending|approved|rejected
        admin_id INTEGER,
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_odr_order_id ON order_detail_requests(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_odr_user_id ON order_detail_requests(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_odr_status ON order_detail_requests(status)`);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id)`);

    client.release();
    logger.info('Database tables initialized');

    return pool;
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB first.');
  }
  return pool;
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

module.exports = {
  connectDB,
  getPool,
  closeDB
};
