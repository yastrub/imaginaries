import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as generateRouter } from './routes/generate.js';
import { authRouter } from './routes/auth.js';
import { quotesRouter } from './routes/quotes.js';
import { likesRouter } from './routes/likes.js';
import { usersRouter } from './routes/users.js';
import { feedbackRouter } from './routes/feedback.js';
import { ordersRouter } from './routes/orders.js';
import { terminalsRouter } from './routes/terminals.js';
import { imagesRouter } from './routes/images.js';
import { plansRouter } from './routes/plans.js';
import { billingRouter, registerStripeWebhook } from './routes/billing.js';
import { profileRouter } from './routes/profile.js';
import { errorHandler } from './middleware/errorHandler.js';
import { limiter } from './middleware/rateLimiter.js';
import { loadEnv } from './config/env.js';
import { connectDB, closeDB, query } from './config/db.js';
import { runMigrations } from './config/migrations.js';
import { verifyCloudinaryConfig } from './config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  try {
    loadEnv();
    console.log('Initializing server...');
    // Stable build identifier for this server instance/deploy
    const SERVER_BUILD_ID = process.env.BUILD_ID
      || process.env.RENDER_GIT_COMMIT
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.GIT_COMMIT
      || new Date().toISOString();

    let connected = false;
    let retries = 3;

    while (!connected && retries > 0) {
      try {
        await connectDB();
        connected = true;
        console.log('Database connection successful');
        
        // Run migrations after successful connection
        await runMigrations();

        // Verify Cloudinary configuration
        if (process.env.NODE_ENV === 'production') {
          const cloudinaryVerified = await verifyCloudinaryConfig();
          if (!cloudinaryVerified) {
            throw new Error('Failed to verify Cloudinary configuration');
          }
          console.log('Cloudinary configuration verified');
        }
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to connect to database after all retries');
          throw error;
        }
        console.log(`Connection failed. Retrying... (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const app = express();
    const PORT = process.env.PORT || 3000;
    const isDevelopment = process.env.NODE_ENV === 'development';

    app.set('trust proxy', 1);

    // CORS configuration
    app.use(cors({
      origin: isDevelopment ? ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005'] : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Register Stripe webhook BEFORE JSON parser to preserve raw body for signature verification
    registerStripeWebhook(app);

    // Middleware
    // Increase JSON body limit to handle base64 images (50MB)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(cookieParser());

    if (!isDevelopment) {
      // Apply rate limiter to all routes except /api/auth/me
      app.use((req, res, next) => {
        if (req.path !== '/api/auth/me') {
          return limiter(req, res, next);
        }
        next();
      });
    }

    // API Routes
    app.use('/api/auth', authRouter);
    app.use('/api/generate', generateRouter);
    app.use('/api/quotes', quotesRouter);
    app.use('/api/likes', likesRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/feedback', feedbackRouter);
    app.use('/api/images', imagesRouter);
    app.use('/api/plans', plansRouter);
    app.use('/api/profile', profileRouter);
    app.use('/api/billing', billingRouter);
    app.use('/api/orders', ordersRouter);
    app.use('/api/terminals', terminalsRouter);

    // Version endpoint for clients/terminals to detect new deploys
    app.get('/api/version', (req, res) => {
      res.set('Cache-Control', 'no-cache, must-revalidate');
      res.set('ETag', SERVER_BUILD_ID);
      res.json({ buildId: SERVER_BUILD_ID, timestamp: new Date().toISOString() });
    });

    // Health check endpoint with detailed status
    app.get('/api/health', async (req, res) => {
      try {
        // Test database connection
        const dbTest = await query('SELECT 1');
        
        // Test Cloudinary connection in production
        let cloudinaryStatus = 'not_configured';
        if (!isDevelopment) {
          const cloudinaryVerified = await verifyCloudinaryConfig();
          cloudinaryStatus = cloudinaryVerified ? 'connected' : 'error';
        }
        
        // Basic health check response
        const healthStatus = {
          status: 'ok',
          database: dbTest.rows.length > 0 ? 'connected' : 'disconnected',
          cloudinary: cloudinaryStatus,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        };

        res.json(healthStatus);
      } catch (error) {
        console.error('Health check failed:', error);
        
        res.status(503).json({
          status: 'error',
          database: 'disconnected',
          cloudinary: 'error',
          error: error.message,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Static file serving
    if (!isDevelopment) {
      app.use(express.static(path.join(__dirname, '../dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      });
    }

    // Error handling
    app.use((req, res, next) => {
      res.status(404).json({ error: 'Not Found' });
    });

    app.use(errorHandler);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      try {
        await new Promise((resolve) => server.close(resolve));
        await closeDB();
        console.log('Server closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Global error handlers
process.on('uncaught Exception', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

startServer().catch(error => {
  console.error('Unhandled server error:', error);
  process.exit(1);
});
