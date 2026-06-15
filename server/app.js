const express = require('express');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const createApp = (dbReady) => {
  const app = express();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many attempts, try again later',
  });

  const defaultAllowedOrigins = [
    'https://methods-audit-laguna.web.app',
    'https://methods-audit-laguna.firebaseapp.com',
  ];

  const allowedOrigins = (process.env.CLIENT_URL || defaultAllowedOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  if (dbReady) {
    app.use(async (req, res, next) => {
      try {
        await dbReady;
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  app.use('/api/auth', authLimiter);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/audits', require('./routes/audits'));
  app.use('/api/checklists', require('./routes/checklists'));
  app.use('/api/roadmap', require('./routes/roadmap'));
  app.use('/api/operator-uploads', require('./routes/operatorUploads'));

  app.get('/', (req, res) => res.json({ message: 'Methods Audit API running' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || err.statusCode || (err.type === 'entity.too.large' ? 413 : 500);
    res.status(status).json({
      message: status === 413 ? 'Uploaded file data is too large' : 'Server error',
      error: err.message,
    });
  });

  return app;
};

module.exports = createApp;
