import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function testPostgresConnection() {
  console.log('\n🔍 Testing PostgreSQL Connection...\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined in environment variables');
    process.exit(1);
  }

  // Prefer new flag DATABASE_USE_SSL; fall back to legacy DATABASE_SSL
  const sslRaw = (process.env.DATABASE_USE_SSL ?? process.env.DATABASE_SSL ?? '').toString();
  const sslEnv = sslRaw.toLowerCase();
  const sslOption = (
    sslEnv === 'true' || sslEnv === 'require'
  ) ? { rejectUnauthorized: false }
    : (sslEnv === 'false' || sslEnv === 'disable') ? undefined
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ...(sslOption ? { ssl: sslOption } : {})
  });

  try {
    console.log('Attempting to connect with shorter timeouts...');
    
    const client = await pool.connect();
    console.log('\n✅ Successfully connected to PostgreSQL!');
    
    // Quick test query
    console.log('\nTesting database operations...');
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query successful:', result.rows[0].now);

    client.release();
    await pool.end();

    console.log('\n🎉 Connection test passed successfully!\n');
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    
    if (error.code === '28P01') {
      console.log('\n🔍 Authentication failed. Check your database credentials.');
    } else if (error.code === '3D000') {
      console.log('\n🔍 Database does not exist.');
    }
  }
}

// Add process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

testPostgresConnection().catch(error => {
  console.error('Top level error:', error);
  process.exit(1);
});
