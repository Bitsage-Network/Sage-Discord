import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from './logger';

// PostgreSQL connection pool
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initializeDatabase(connectionString: string): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    max: 20, // Maximum number of clients
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database error', err);
  });

  pool.on('connect', () => {
    logger.debug('New database client connected');
  });

  logger.info('Database connection pool initialized');

  return pool;
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const db = getPool();
  const start = Date.now();

  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Database query error', {
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const db = getPool();
  return await db.connect();
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}
