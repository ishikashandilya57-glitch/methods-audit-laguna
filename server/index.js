const express = require('express');
const compression = require('compression');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

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

// Routes
app.use('/api/auth', authLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/checklists', require('./routes/checklists'));
app.use('/api/roadmap', require('./routes/roadmap'));
app.use('/api/operator-uploads', require('./routes/operatorUploads'));

// Health check
app.get('/', (req, res) => res.json({ message: 'Methods Audit API running' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || err.statusCode || (err.type === 'entity.too.large' ? 413 : 500);
  res.status(status).json({
    message: status === 413 ? 'Uploaded file data is too large' : 'Server error',
    error: err.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
